// 生成UUID（Workers 运行时提供 Web Crypto）
export function generateId(): string {
  return crypto.randomUUID();
}

// 生成订单号
export function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `R${year}${month}${day}${random}`;
}
