import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkPassword, createSessionToken } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

// กันเดารหัสผ่าน: ลองได้ 10 ครั้งต่อ 15 นาที
const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkRateLimit(`login:${ip}`, Date.now(), LOGIN_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "ลองหลายครั้งเกินไป รอสักพักแล้วลองใหม่" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "กรุณาใส่รหัสผ่าน" }, { status: 400 });
  }

  const secret = process.env.SESSION_SECRET;
  let ok: boolean;
  try {
    ok = await checkPassword(parsed.data.password, process.env.APP_PASSWORD, secret);
  } catch (error) {
    // มักเกิดจาก SESSION_SECRET ไม่ได้ตั้งหรือสั้นเกินไป
    console.error(JSON.stringify({ event: "login_config_error", message: String(error) }));
    return NextResponse.json({ error: "ระบบยังตั้งค่าไม่ครบ ดู server log" }, { status: 500 });
  }
  if (!ok) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

/** ออกจากระบบ */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
