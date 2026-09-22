-- 「公司自营」受益人记录 + 自营车回填
--
-- 背景：settlement_lines.owner_id 是 NOT NULL（结算必须属于某个受益人），
-- 但自营车（ownership_type='company'）没有挂靠车主，票面上的「车主结算金额」
-- 其实归公司自己。台账 file-2 的哈弗H6 就是这种车 —— 那张表没有「公司管理费」列，
-- 等价于公司费率 0。
--
-- 处理方式：给公司自己建一条 owner 记录（费率 0），自营车全部挂到它下面。
-- 好处是整套结算逻辑不用为自营车分叉：
--   * 单车月报对所有车口径一致
--   * 「公司自营」的对账单天然就是公司自有车队的收益表
--   * resolveCompanyRate 查到这条费率 0 的记录，与之前「查不到返回 0」结果相同
--
-- 注：这两条 UPDATE 只回填 owner_id 为空的行，不会覆盖用户已经手工指定的车主。

INSERT OR IGNORE INTO owners (id, name, phone, role, company_fee_rate, opening_balance, status, remarks, created_at, updated_at) VALUES
  ('owner-self', '公司自营', NULL, 'partner', 0, 0, 1, '自有车辆，无公司管理费', datetime('now','+8 hours'), datetime('now','+8 hours'));

UPDATE vehicles SET owner_id = 'owner-self', updated_at = datetime('now','+8 hours')
WHERE ownership_type = 'company' AND (owner_id IS NULL OR owner_id = '');
