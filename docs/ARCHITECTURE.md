# Architecture

ทุกช่องทางส่งข้อความเข้า `runChat` (`lib/chat-pipeline.ts`) ตัวเดียว ด่านคำเสี่ยงทำงานก่อนเสมอ แล้วจึงรวม context และเรียก LLM

```mermaid
flowchart LR
  Web["เว็บแชท<br/>/api/chat"] --> Safety
  LINE["LINE<br/>/api/line-webhook · เฟส 3"] -.-> Safety
  subgraph runChat
    Safety["1. ด่านคำเสี่ยง<br/>โค้ดล้วน"] --> Context["2. รวม context<br/>system prompt + 20 ข้อความล่าสุด"]
    Context --> LLM["3. LLM + tool loop<br/>สูงสุด 3 step"]
  end
  LLM --> OpenAI["OpenAI API"]
  LLM -- "save_memory · recall_memory · log_mood" --> DB[("PostgreSQL")]
  Web <-- "ประวัติแชท" --> DB
```

เฟส 2 ทำงานเมื่อมี `DATABASE_URL` ถ้าไม่มี ทุกอย่างทำงานแบบเฟส 1 (ไม่มี tools ไม่เก็บแชท)

## Request flow (เฟส 1)

1. `proxy.ts` ตรวจ cookie ก่อนทุก request ไม่มี → หน้าเว็บไป `/login`, API ตอบ 401
2. `/api/chat` ตรวจ cookie ซ้ำ → rate limit 20 ครั้ง / 5 นาที → ตรวจรูปแบบข้อมูลด้วย zod (รับเฉพาะ role user/assistant และ part ข้อความ)
3. `runChat` ตรวจคำเสี่ยงจากข้อความล่าสุด → ตัดประวัติเหลือ 20 ข้อความ → เรียก LLM พร้อม system prompt (เพิ่มคำแนะนำพิเศษเมื่อเจอคำเสี่ยง)
4. ตอบกลับเป็น stream พร้อม metadata `{ crisis }` หน้าเว็บใช้ค่านี้แสดงการ์ดสายด่วน 1323
5. Server log เก็บเฉพาะ metadata (token, crisis, เวอร์ชัน prompt, ชื่อ tool ที่ถูกเรียก) ไม่เก็บเนื้อหาแชท

## เพิ่มในเฟส 2 (เมื่อมี DB)

- `GET /api/chat` โหลดแชทล่าสุดมาแสดง, `DELETE /api/chat?id=` ลบแชท (ความจำไม่ถูกลบ)
- `POST /api/chat` รับ `chatId` ด้วย server บันทึกข้อความผู้ใช้ แล้วโหลดประวัติจาก DB แทนประวัติที่หน้าเว็บส่งมา กด "ลองอีกครั้ง" จะลบคำตอบเดิมที่ตามหลังข้อความนั้น
- คำตอบของบอทบันทึกตอน stream จบ (บันทึกแม้ผู้ใช้ปิดหน้าเว็บกลางทาง)
- ข้อความที่ติดด่านคำเสี่ยงไม่มี `save_memory` ให้เรียก

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
| --- | --- |
| `lib/chat-pipeline.ts` | `runChat` ใช้ร่วมทุกช่องทาง |
| `lib/safety.ts` | ด่านคำเสี่ยงและข้อความสายด่วน |
| `lib/prompt.ts` + `prompts/system-v1.md` | system prompt แบบมีเวอร์ชัน |
| `lib/auth.ts` | session cookie แบบ HMAC สำหรับผู้ใช้คนเดียว |
| `lib/config.ts` | ชื่อบอทและขีดจำกัดทั้งหมด |
| `proxy.ts` | กันทุกหน้าด้วยรหัสผ่าน |
| `lib/tools.ts` | tools ความจำ 3 ตัว (เฟส 2) |
| `lib/memory-store.ts`, `lib/chat-store.ts` | query ความจำ อารมณ์ และประวัติแชท (เฟส 2) |
| `db/migrations/` + `scripts/migrate.mjs` | schema และคำสั่ง `npm run db:migrate` |
