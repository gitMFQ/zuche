import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { CustomerRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

interface CustomerWithSource extends CustomerRow {
  source_color: string | null;
}

/** 图片字段在库里是 JSON 字符串，解析失败降级为空数组 */
function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

interface CustomerBody {
  name?: string;
  phone?: string;
  id_card?: string;
  license_number?: string;
  license_expiry?: string;
  address?: string;
  remarks?: string;
  status?: number;
  id_card_images?: string[];
  license_images?: string[];
  source_id?: string;
}

// 获取客户列表
export async function getCustomers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '' } = c.req.query();

    let sql = `
      SELECT c.*, s.color as source_color
      FROM customers c
      LEFT JOIN order_sources s ON c.source_id = s.id
      WHERE 1=1
    `;
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status !== '') {
      sql += ' AND c.status = ?';
      params.push(Number(status));
    }

    sql += ' ORDER BY c.created_at DESC';

    const result = await queryWithPagination<CustomerWithSource>(db, sql, params, Number(page), Number(pageSize));

    const data = result.data.map((customer) => ({
      ...customer,
      id_card_images: parseImages(customer.id_card_images),
      license_images: parseImages(customer.license_images)
    }));

    return c.json({ success: true, data: { ...result, data } });
  } catch (error) {
    return handleError(c, '获取客户列表错误:', error);
  }
}

// 获取单个客户
export async function getCustomer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const customer = await queryOne<CustomerWithSource>(
      db,
      `SELECT c.*, s.color as source_color
       FROM customers c
       LEFT JOIN order_sources s ON c.source_id = s.id
       WHERE c.id = ?`,
      [id]
    );

    if (!customer) {
      return c.json({ success: false, message: '客户不存在' }, 404);
    }

    // 获取该客户的订单记录
    const orders = await query(
      db,
      `SELECT o.*, v.plate_number, v.brand, v.model
       FROM orders o
       LEFT JOIN vehicles v ON o.vehicle_id = v.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [id]
    );

    return c.json({
      success: true,
      data: {
        ...customer,
        id_card_images: parseImages(customer.id_card_images),
        license_images: parseImages(customer.license_images),
        orders
      }
    });
  } catch (error) {
    return handleError(c, '获取客户错误:', error);
  }
}

// 创建客户
export async function createCustomer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<CustomerBody>();
    const { name, phone, id_card, source_id } = body;

    if (!name || !phone) {
      return c.json({ success: false, message: '姓名和手机号不能为空' }, 400);
    }

    // 检查手机号是否已存在
    const existing = await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE phone = ?', [phone]);
    if (existing) {
      return c.json({ success: false, message: '该手机号已存在' }, 400);
    }

    // 检查身份证是否已存在
    if (id_card) {
      const existingIdCard = await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE id_card = ?', [
        id_card
      ]);
      if (existingIdCard) {
        return c.json({ success: false, message: '该身份证号已存在' }, 400);
      }
    }

    // 获取来源名称
    let sourceName: string | null = null;
    if (source_id) {
      const source = await queryOne<{ name: string }>(
        db,
        'SELECT name FROM order_sources WHERE id = ? AND status = 1',
        [source_id]
      );
      sourceName = source?.name ?? null;
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO customers (id, name, phone, id_card, license_number, license_expiry, address, remarks, id_card_images, license_images, source_id, source_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        name,
        phone,
        id_card ?? null,
        body.license_number ?? null,
        body.license_expiry ?? null,
        body.address ?? null,
        body.remarks ?? null,
        body.id_card_images ? JSON.stringify(body.id_card_images) : null,
        body.license_images ? JSON.stringify(body.license_images) : null,
        source_id ?? null,
        sourceName,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建客户',
      entityType: 'customer',
      entityId: id,
      details: `创建客户 ${name}，手机：${phone}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id, name, phone }, message: '客户创建成功' });
  } catch (error) {
    return handleError(c, '创建客户错误:', error);
  }
}

// 更新客户
export async function updateCustomer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<CustomerBody>();
    const { phone, source_id } = body;

    const customer = await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return c.json({ success: false, message: '客户不存在' }, 404);
    }

    // 检查手机号是否被其他客户使用
    if (phone) {
      const existingPhone = await queryOne<{ id: string }>(
        db,
        'SELECT id FROM customers WHERE phone = ? AND id != ?',
        [phone, id]
      );
      if (existingPhone) {
        return c.json({ success: false, message: '该手机号已被其他客户使用' }, 400);
      }
    }

    // 获取来源名称
    let sourceName: string | null = null;
    if (source_id) {
      const source = await queryOne<{ name: string }>(
        db,
        'SELECT name FROM order_sources WHERE id = ? AND status = 1',
        [source_id]
      );
      sourceName = source?.name ?? null;
    }

    await execute(
      db,
      `UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, license_expiry = ?, address = ?, remarks = ?, status = ?, id_card_images = ?, license_images = ?, source_id = ?, source_name = ?, updated_at = ? WHERE id = ?`,
      [
        body.name,
        phone,
        body.id_card ?? null,
        body.license_number ?? null,
        body.license_expiry ?? null,
        body.address ?? null,
        body.remarks ?? null,
        body.status,
        body.id_card_images ? JSON.stringify(body.id_card_images) : null,
        body.license_images ? JSON.stringify(body.license_images) : null,
        source_id ?? null,
        sourceName,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新客户',
      entityType: 'customer',
      entityId: id,
      details: `更新客户 ${body.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '客户更新成功' });
  } catch (error) {
    return handleError(c, '更新客户错误:', error);
  }
}

// 删除客户
export async function deleteCustomer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    // 检查是否有未完成的订单
    const activeOrders = await queryOne<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND status IN ('pending', 'active')",
      [id]
    );

    if (activeOrders && activeOrders.count > 0) {
      return c.json({ success: false, message: '该客户有未完成的订单，无法删除' }, 400);
    }

    const customer = await queryOne<{ name: string }>(db, 'SELECT name FROM customers WHERE id = ?', [id]);
    await execute(db, 'DELETE FROM customers WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除客户',
      entityType: 'customer',
      entityId: id,
      details: `删除客户 ${customer?.name || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '客户删除成功' });
  } catch (error) {
    return handleError(c, '删除客户错误:', error);
  }
}

// 获取常用客户列表
export async function getRegularCustomers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const customers = await query(
      db,
      `SELECT id, name, phone, id_card, license_number, license_expiry, is_regular
       FROM customers
       WHERE status = 1 AND is_regular = 1
       ORDER BY name ASC`
    );

    return c.json({ success: true, data: customers });
  } catch (error) {
    return handleError(c, '获取常用客户列表错误:', error);
  }
}

// 设置/取消常用客户
export async function setRegularCustomer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { is_regular } = await c.req.json<{ is_regular?: boolean }>();

    const customer = await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return c.json({ success: false, message: '客户不存在' }, 404);
    }

    await execute(db, 'UPDATE customers SET is_regular = ?, updated_at = ? WHERE id = ?', [
      is_regular ? 1 : 0,
      now(),
      id
    ]);

    return c.json({
      success: true,
      message: is_regular ? '已设为常用客户' : '已取消常用客户'
    });
  } catch (error) {
    return handleError(c, '设置常用客户错误:', error);
  }
}
