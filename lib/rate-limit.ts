// Rate limit แบบนับในหน่วยความจำ (sliding window)
// พอสำหรับใช้คนเดียว: บน Vercel แต่ละ instance นับแยกกันและรีเซ็ตเมื่อ instance ถูกปิด
// ถ้าวันหนึ่งเปิดให้หลายคนใช้ ควรย้ายไปเก็บใน database หรือ Redis

import { RATE_LIMIT } from "./config";

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  now = Date.now(),
  limit = RATE_LIMIT,
): { ok: boolean; retryAfterSeconds: number } {
  const windowStart = now - limit.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit.max) {
    hits.set(key, recent);
    const retryAfterMs = recent[0] + limit.windowMs - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

/** ใช้ในเทสต์เท่านั้น */
export function resetRateLimit(): void {
  hits.clear();
}
