import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySessionToken } from "@/lib/auth";
import { getMessageText, runChat } from "@/lib/chat-pipeline";
import { MAX_MESSAGE_CHARS, SESSION_COOKIE } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// รับเฉพาะ role user/assistant และ part ชนิดข้อความ กันการยัด system message จากฝั่ง client
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.object({ type: z.string(), text: z.string().optional() })),
      }),
    )
    .min(1)
    .max(200),
});

function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(req: NextRequest) {
  // proxy.ts กันไว้แล้ว ตรวจซ้ำอีกชั้นเผื่อ matcher พลาด
  const authorized = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
  if (!authorized) return errorResponse(401, "กรุณาเข้าสู่ระบบก่อน");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkRateLimit(`chat:${ip}`);
  if (!limit.ok) {
    return errorResponse(429, "ส่งข้อความถี่ไปหน่อย พักสักครู่แล้วลองใหม่นะ", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "รูปแบบข้อมูลไม่ถูกต้อง");

  const messages: ChatMessage[] = parsed.data.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts.flatMap((p) =>
      p.type === "text" && typeof p.text === "string" ? [{ type: "text" as const, text: p.text }] : [],
    ),
  }));

  const last = messages.at(-1);
  if (last?.role !== "user") return errorResponse(400, "ข้อความล่าสุดต้องมาจากผู้ใช้");

  const lastText = getMessageText(last);
  if (!lastText.trim()) return errorResponse(400, "ข้อความว่างเปล่า");
  if (lastText.length > MAX_MESSAGE_CHARS) {
    return errorResponse(400, `ข้อความยาวเกิน ${MAX_MESSAGE_CHARS} ตัวอักษร`);
  }

  try {
    const { crisis, result } = await runChat({ channel: "web", userId: "owner", messages });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => (part.type === "start" ? { crisis } : undefined),
      onError: () => "ตอนนี้น้องฟังตอบไม่ได้ ลองส่งใหม่อีกครั้งนะ",
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "chat_route_error", message: String(error) }));
    return errorResponse(502, "ตอนนี้น้องฟังตอบไม่ได้ ลองส่งใหม่อีกครั้งนะ");
  }
}
