-- 权限加固、令牌吊销、登录限流、订单车牌快照所需的 schema 变更

-- ==================== A6 用户模块 ====================
-- 首次登录强制改密：seed 里的 admin/admin123 是公开的默认口令，上线后必须改掉。
-- 用标记位而不是直接改密码，避免把已部署环境的密码重置掉。
ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;

-- 种子管理员标记为需要改密
UPDATE users SET must_change_password = 1 WHERE id = 'user-admin' AND username = 'admin';

-- ==================== B2 令牌吊销 ====================
-- 改密码 / 重置密码 / 禁用用户 / 删除用户时自增，使该用户已签发的 JWT 立即失效。
-- 之前 JWT 有效期 1 年且无法吊销，改密码也拦不住旧 token。
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0;

-- ==================== B3 登录限流 ====================
-- 按 username:IP 维度计数，15 分钟内失败 5 次锁定 15 分钟。
-- 门店常共用出口 IP，所以 key 里带上 username，避免同事之间互相影响。
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  first_at TEXT NOT NULL,
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_first ON login_attempts(first_at);

-- ==================== C2 订单车牌快照 ====================
-- orders.vehicle_id 刻意不声明外键（允许删除已完成订单的车辆），
-- 删除车辆后历史订单的 LEFT JOIN 会取到 NULL，列表与日志里的车牌就空了。
-- 落一份快照字段，读取时优先用快照、JOIN 兜底。
ALTER TABLE orders ADD COLUMN plate_number TEXT;

UPDATE orders
SET plate_number = (SELECT v.plate_number FROM vehicles v WHERE v.id = orders.vehicle_id)
WHERE plate_number IS NULL;
