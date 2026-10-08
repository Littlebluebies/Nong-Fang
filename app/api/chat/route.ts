import { generateId } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySessionToken } from "@/lib/auth";
import { getMessageText, runChat } from "@/lib/chat-pipeline";
import { createPostgresChatStore, prepareChatHistory } from "@/lib/chat-store";
import { MAX_DISPLAY_MESSAGES, MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, SESSION_COOKIE } from "@/lib/config";
import { isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatMessage, ChatState } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** เฟส 2 ยังมีผู้ใช้คนเดียว */
const USER_ID = "owner";

// รับเฉพาะ role user/assistant และ part ชนิดข้อความ กันการยัด system message จากฝั่ง client
const bodySchema = z.object({
  /** เฟส 2: แชทที่กำลังคุยอยู่ ไม่มี = เริ่มแชทใหม่ */
  chatId: z.uuid().nullish(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
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

// proxy.ts กันไว้แล้ว ตรวจซ้ำอีกชั้นเผื่อ matcher พลาด
function isAuthorized(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
}

/** โหลดแชทล่าสุดมาแสดงตอนเปิดหน้าเว็บ */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) return errorResponse(401, "กรุณาเข้าสู่ระบบก่อน");
  if (!isDatabaseConfigured()) return NextResponse.json({ persistent: false } satisfies ChatState);

  try {
    const store = createPostgresChatStore();
    const chatId = await store.latestChatId(USER_ID, "web");
    const messages = chatId ? await store.loadMessages(chatId, MAX_DISPLAY_MESSAGES) : [];
    return NextResponse.json({ persistent: true, chatId, messages } satisfies ChatState);
  } catch (error) {
    console.error(JSON.stringify({ event: "chat_load_error", message: String(error) }));
    return errorResponse(502, "โหลดแชทเดิมไม่ได้ ลองรีเฟรชอีกครั้งนะ");
  }
}

/** ลบแชททั้งแชท (ความจำที่จดผ่าน save_memory ไม่ถูกลบ) */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized(req))) return errorResponse(401, "กรุณาเข้าสู่ระบบก่อน");
  if (!isDatabaseConfigured()) return errorResponse(404, "ไม่ได้เก็บแชทไว้");

  const chatId = z.uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!chatId.success) return errorResponse(400, "รูปแบบข้อมูลไม่ถูกต้อง");

  try {
    const deleted = await createPostgresChatStore().deleteChat(USER_ID, chatId.data);
    return deleted ? new NextResponse(null, { status: 204 }) : errorResponse(404, "ไม่พบแชทนี้");
  } catch (error) {
    console.error(JSON.stringify({ event: "chat_delete_error", message: String(error) }));
    return errorResponse(502, "ลบแชทไม่สำเร็จ ลองอีกครั้งนะ");
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return errorResponse(401, "กรุณาเข้าสู่ระบบก่อน");

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
    // เฟส 2: มี DB = ใช้ประวัติจาก DB และใช้จากหน้าเว็บแค่ข้อความล่าสุด
    const chatStore = isDatabaseConfigured() ? createPostgresChatStore() : null;
    let chatId: string | undefined;
    let history = messages;
    if (chatStore) {
      ({ chatId, history } = await prepareChatHistory({
        store: chatStore,
        userId: USER_ID,
        channel: "web",
        chatId: parsed.data.chatId ?? undefined,
        message: last,
        limit: MAX_HISTORY_MESSAGES,
      }));
    }

    const { crisis, result } = await runChat({ channel: "web", userId: USER_ID, messages: history });

    // บันทึกคำตอบให้ครบแม้ผู้ใช้ปิดหน้าเว็บกลางทาง
    if (chatStore) void result.consumeStream();

    return result.toUIMessageStreamResponse<ChatMessage>({
      originalMessages: history,
      generateMessageId: generateId,
      messageMetadata: ({ part }) => (part.type === "start" ? { crisis, chatId } : undefined),
      onError: () => "ตอนนี้น้องฟังตอบไม่ได้ ลองส่งใหม่อีกครั้งนะ",
      onFinish: async ({ responseMessage }) => {
        if (!chatStore || !chatId) return;
        if (!getMessageText(responseMessage).trim()) return;
        try {
          await chatStore.saveMessage(chatId, responseMessage);
        } catch (error) {
          console.error(JSON.stringify({ event: "chat_save_error", message: String(error) }));
        }
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "chat_route_error", message: String(error) }));
    return errorResponse(502, "ตอนนี้น้องฟังตอบไม่ได้ ลองส่งใหม่อีกครั้งนะ");
  }
}
