import { type Bind, batchExecute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { InsuranceRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { parseStringArray, stringifyArray } from '../lib/json';
import { dateOffset, now, today as todayDate, yearRange } from '../lib/time';
import { buildMirrorDeleteStmts, buildMirrorSyncStmts, findPaidMirror } from '../lib/expenseMirror';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import type { AppContext } from '../types';

// 保险类型映射
const INSURANCE_TYPE_MAP: Record<string, string> = {
  compulsory: '交强险',
  commercial: '商业险',
  seat: '座位险'
};

// 保险状态映射
const STATUS_MAP: Record<string, string> = {
  active: '生效中',
  expired: '已过期',
  pending: '待生效'
};

function getTypeText(typeStr: string): string {
  return parseStringArray(typeStr).map((t) => INSURANCE_TYPE_MAP[t] || t).join('、') || '-';
}

interface InsuranceWithVehicle extends InsuranceRow {
  brand: string | null;
  model: string | null;
}

/** 保险附件：前端上传时带 type 一起存，历史数据只有纯 URL 字符串 */
export interface InsuranceDocument {
  url: string;
  type: 'image' | 'pdf';
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

// documents 历史上存过纯 URL 数组，也存过 { url, type } 对象数组，读出来统一成对象
function parseDocuments(raw: string | null): InsuranceDocument[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const documents: InsuranceDocument[] = [];
  for (const item of parsed) {
    if (typeof item === 'string') {
      if (item) documents.push({ url: item, type: isPdfUrl(item) ? 'pdf' : 'image' });
      continue;
    }
    if (typeof item !== 'object' || item === null || !('url' in item)) continue;

    const url = item.url;
    if (typeof url !== 'string' || !url) continue;

    const type = 'type' in item && item.type === 'pdf' ? 'pdf' : isPdfUrl(url) ? 'pdf' : 'image';
    documents.push({ url, type });
  }
  return documents;
}

// 获取保险列表
export async function getInsuranceList(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '', insurance_type = '', vehicle_id = '' } =
      c.req.query();

    let sql = `SELECT i.*, v.brand, v.model FROM insurance i
               LEFT JOIN vehicles v ON i.vehicle_id = v.id WHERE 1=1`;
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (i.plate_number LIKE ? OR i.policy_number LIKE ? OR i.insurance_company LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (insurance_type) {
      sql += ' AND i.insurance_type = ?';
      params.push(insurance_type);
    }

    if (vehicle_id) {
      sql += ' AND i.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY i.end_date DESC';

    const result = await queryWithPagination<InsuranceWithVehicle>(db, sql, params, Number(page), Number(pageSize));

    const today = todayDate();
    const data = result.data.map((i) => {
      let actualStatus = i.status;
      if (i.end_date < today) {
        actualStatus = 'expired';
      } else if (i.start_date > today) {
        actualStatus = 'pending';
      } else {
        actualStatus = 'active';
      }

      return {
        ...i,
        status: actualStatus,
        type_text: getTypeText(i.insurance_type),
        status_text: STATUS_MAP[actualStatus] || actualStatus,
        insurance_types: parseStringArray(i.insurance_type),
        documents: parseDocuments(i.documents)
      };
    });

    return c.json({ success: true, data: { ...result, data } });
  } catch (error) {
    return handleError(c, '获取保险列表错误:', error);
  }
}

// 获取保险统计
export async function getInsuranceStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const today = todayDate();
    const thirtyDaysLater = dateOffset(30);

    const [expiringSoon, expiredCount, activeCount, thisYearPremium] = await Promise.all([
      query<InsuranceWithVehicle>(
        db,
        `SELECT i.*, v.brand, v.model FROM insurance i
         LEFT JOIN vehicles v ON i.vehicle_id = v.id
         WHERE i.end_date >= ? AND i.end_date <= ?
         AND i.end_date = (
           SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
         )
         ORDER BY i.end_date ASC`,
        [today, thirtyDaysLater]
      ),
      queryOne<{ count: number }>(
        db,
        `SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
         WHERE i.end_date < ?
         AND i.end_date = (
           SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
         )`,
        [today]
      ),
      queryOne<{ count: number }>(
        db,
        `SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
         WHERE i.start_date <= ? AND i.end_date >= ?
         AND i.end_date = (
           SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
         )`,
        [today, today]
      ),
      queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(premium), 0) as total FROM insurance
         WHERE start_date >= ? AND start_date < ?`,
        [yearRange().start, yearRange().end]
      )
    ]);

    return c.json({
      success: true,
      data: {
        expiringSoon: expiringSoon.map((i) => ({
          ...i,
          type_text: getTypeText(i.insurance_type),
          status_text: '即将到期'
        })),
        expiredCount: expiredCount?.count || 0,
        activeCount: activeCount?.count || 0,
        thisYearPremium: thisYearPremium?.total || 0
      }
    });
  } catch (error) {
    return handleError(c, '获取保险统计错误:', error);
  }
}

// 获取单个保险记录
export async function getInsurance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const insurance = await queryOne<
      InsuranceRow & { brand: string | null; model: string | null; color: string | null; year: number | null }
    >(
      db,
      `SELECT i.*, v.brand, v.model, v.color, v.year
       FROM insurance i
       LEFT JOIN vehicles v ON i.vehicle_id = v.id
       WHERE i.id = ?`,
      [id]
    );

    if (!insurance) {
      return c.json({ success: false, message: '保险记录不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...insurance,
        type_text: INSURANCE_TYPE_MAP[insurance.insurance_type] || insurance.insurance_type
      }
    });
  } catch (error) {
    return handleError(c, '获取保险记录错误:', error);
  }
}

interface InsuranceBody {
  vehicle_id?: string;
  plate_number?: string;
  insurance_type?: string;
  insurance_types?: string[] | string;
  insurance_company?: string;
  policy_number?: string;
  start_date?: string;
  end_date?: string;
  premium?: number;
  coverage_amount?: number;
  beneficiary?: string;
  documents?: InsuranceDocument[];
  remarks?: string;
  status?: string;
  /** 车辆费用台账侧的信息，可选 */
  invoice_status?: string;
  account_id?: string | null;
  paid_at?: string | null;
  /** 保费按月分摊进单车月报，默认 12（年险） */
  amortize_months?: number;
}

// 创建保险记录
export async function createInsurance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<InsuranceBody>();
    const { vehicle_id, start_date, end_date } = body;

    // 支持数组或单个值
    const typeStr = stringifyArray(body.insurance_types) ?? body.insurance_type ?? '';

    if (!vehicle_id || !typeStr || !body.insurance_company || !start_date || !end_date) {
      return c.json({ success: false, message: '车辆、保险类型、保险公司、生效日期和到期日期不能为空' }, 400);
    }

    // 未传车牌号时从车辆表取
    let plateNum = body.plate_number ?? null;
    if (!plateNum) {
      const vehicle = await queryOne<{ plate_number: string }>(db, 'SELECT plate_number FROM vehicles WHERE id = ?', [
        vehicle_id
      ]);
      plateNum = vehicle?.plate_number ?? null;
    }

    const id = generateId();
    const currentTime = now();

    // 计算状态
    const today = todayDate();
    let status = 'active';
    if (start_date > today) {
      status = 'pending';
    } else if (end_date < today) {
      status = 'expired';
    }

    const vehicle = await queryOne<{ owner_id: string | null }>(db, 'SELECT owner_id FROM vehicles WHERE id = ?', [
      vehicle_id
    ]);
    // 保费按年缴，默认分 12 个月摊进单车月报 —— 否则续保那个月的「结余」会是一条巨大的负数
    const mirror = await buildMirrorSyncStmts(
      db,
      {
        sourceType: 'insurance',
        sourceId: id,
        vehicleId: vehicle_id,
        plateNumber: plateNum,
        ownerId: vehicle?.owner_id ?? null,
        expenseDate: start_date,
        expenseType: 'insurance',
        expenseTypeName: '保险',
        incomeAmount: 0,
        expenseAmount: body.premium || 0,
        amortizeMonths: Number.isFinite(body.amortize_months) ? Number(body.amortize_months) : 12,
        invoiceStatus: body.invoice_status,
        remarks: body.remarks ?? null
      },
      { operatorId: getAuthUser(c)?.id ?? null, currentTime },
      { id, paidAccountId: body.account_id ?? null, paidAt: body.paid_at ?? start_date }
    );

    await batchExecute(db, [
      {
        sql: `INSERT INTO insurance (
          id, vehicle_id, plate_number, insurance_type, insurance_company, policy_number,
          start_date, end_date, premium, coverage_amount, beneficiary, documents, remarks, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          vehicle_id,
          plateNum,
          typeStr,
          body.insurance_company,
          body.policy_number ?? null,
          start_date,
          end_date,
          body.premium || 0,
          body.coverage_amount || 0,
          body.beneficiary ?? null,
          body.documents ? JSON.stringify(body.documents) : null,
          body.remarks ?? null,
          status,
          currentTime,
          currentTime
        ]
      },
      ...mirror.stmts
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建保险记录',
      entityType: 'insurance',
      entityId: id,
      details: `创建保险记录 ${plateNum ?? ''} ${body.insurance_company}，保费 ${body.premium || 0}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { id, plate_number: plateNum },
      message: '保险记录创建成功'
    });
  } catch (error) {
    return handleError(c, '创建保险记录错误:', error);
  }
}

// 更新保险记录
export async function updateInsurance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<InsuranceBody>();

    const insurance = await queryOne<InsuranceRow>(db, 'SELECT * FROM insurance WHERE id = ?', [id]);
    if (!insurance) {
      return c.json({ success: false, message: '保险记录不存在' }, 404);
    }

    const typeStr = stringifyArray(body.insurance_types) ?? body.insurance_type ?? insurance.insurance_type;

    const currentTime = now();
    const vehicleId = body.vehicle_id || insurance.vehicle_id;
    const startDate = body.start_date || insurance.start_date;
    const premium = body.premium ?? 0;

    const vehicle = await queryOne<{ owner_id: string | null }>(db, 'SELECT owner_id FROM vehicles WHERE id = ?', [
      vehicleId
    ]);
    const mirror = await buildMirrorSyncStmts(
      db,
      {
        sourceType: 'insurance',
        sourceId: id ?? '',
        vehicleId,
        plateNumber: insurance.plate_number,
        ownerId: vehicle?.owner_id ?? null,
        expenseDate: startDate,
        expenseType: 'insurance',
        expenseTypeName: '保险',
        incomeAmount: 0,
        expenseAmount: premium,
        amortizeMonths: Number.isFinite(body.amortize_months) ? Number(body.amortize_months) : undefined,
        invoiceStatus: body.invoice_status,
        remarks: body.remarks ?? null
      },
      { operatorId: getAuthUser(c)?.id ?? null, currentTime }
    );
    if (mirror.blocked) {
      return c.json({ success: false, message: mirror.blocked }, 400);
    }

    await batchExecute(db, [
      {
        sql: `UPDATE insurance SET
          vehicle_id = ?, insurance_type = ?, insurance_company = ?, policy_number = ?,
          start_date = ?, end_date = ?, premium = ?, coverage_amount = ?,
          beneficiary = ?, documents = ?, remarks = ?, status = ?, updated_at = ?
        WHERE id = ?`,
        params: [
          vehicleId,
          typeStr,
          body.insurance_company,
          body.policy_number ?? null,
          startDate,
          body.end_date,
          premium,
          body.coverage_amount ?? 0,
          body.beneficiary ?? null,
          body.documents ? JSON.stringify(body.documents) : null,
          body.remarks ?? null,
          body.status || insurance.status,
          currentTime,
          id
        ]
      },
      ...mirror.stmts
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新保险记录',
      entityType: 'insurance',
      entityId: id,
      details: `更新保险记录 ${insurance.plate_number ?? ''}，保费 ${premium}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '保险记录更新成功' });
  } catch (error) {
    return handleError(c, '更新保险记录错误:', error);
  }
}

// 删除保险记录
export async function deleteInsurance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const insurance = await queryOne<InsuranceRow>(db, 'SELECT * FROM insurance WHERE id = ?', [id]);
    if (!insurance) {
      return c.json({ success: false, message: '保险记录不存在' }, 404);
    }

    const paid = await findPaidMirror(db, 'insurance', id);
    if (paid) {
      return c.json({ success: false, message: '该保险的费用已在车辆费用台账标记付款，请先撤销付款再删除' }, 400);
    }

    await batchExecute(db, [
      ...buildMirrorDeleteStmts('insurance', id),
      { sql: 'DELETE FROM insurance WHERE id = ?', params: [id] }
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除保险记录',
      entityType: 'insurance',
      entityId: id,
      details: `删除保险记录 ${insurance.plate_number ?? ''} ${insurance.insurance_company}，保费 ${insurance.premium}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '保险记录删除成功' });
  } catch (error) {
    return handleError(c, '删除保险记录错误:', error);
  }
}
