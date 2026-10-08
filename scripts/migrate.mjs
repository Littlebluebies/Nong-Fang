// รันไฟล์ใน db/migrations ตามลำดับชื่อ ไฟล์ที่รันแล้วจะถูกจดไว้ในตาราง schema_migrations และไม่รันซ้ำ
// ใช้: DATABASE_URL=... npm run db:migrate  (หรือใส่ DATABASE_URL ไว้ใน .env.local)

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

try {
  process.loadEnvFile(".env.local");
} catch {
  // ไม่มีไฟล์ก็ใช้ env ที่ตั้งไว้แล้ว
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ยังไม่ได้ตั้งค่า DATABASE_URL");
  process.exit(1);
}

const dir = path.join(process.cwd(), "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const { rows } = await client.query("select name from schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    // แต่ละไฟล์อยู่ใน transaction เดียว พังกลางทางจะไม่ค้างครึ่งๆ
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  console.log("migrations up to date");
} finally {
  client.release();
  await pool.end();
}
