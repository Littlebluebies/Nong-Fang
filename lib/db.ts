// การเชื่อมต่อ PostgreSQL (Neon) ใช้ driver แบบ HTTP เหมาะกับ serverless ไม่ต้องดูแล connection pool

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

/** เฟส 2 เปิดใช้เมื่อมี DATABASE_URL ถ้าไม่มี แอปทำงานแบบเฟส 1 (ไม่มีความจำ) */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า DATABASE_URL");
  sql ??= neon(url);
  return sql;
}
