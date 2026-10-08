"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { APP_NAME, MAX_MESSAGE_CHARS } from "@/lib/config";
import { CRISIS_MESSAGE, detectCrisis } from "@/lib/safety";
import type { ChatMessage } from "@/lib/types";

const STARTERS = [
  { label: "อยากระบายหน่อย", text: "อยากระบายหน่อย ขอแค่มีคนฟัง" },
  { label: "อยากได้ไฟทำงาน", text: "ช่วยหาไฟทำงานให้หน่อย ช่วงนี้ไม่มีแรงเลย" },
];

function textOf(message: ChatMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** error จาก API เป็น JSON { error: "..." } ดึงข้อความภาษาไทยออกมาแสดง */
function readError(error: Error | undefined): string {
  if (!error) return "";
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // ไม่ใช่ JSON ใช้ข้อความกลางด้านล่าง
  }
  return "ตอนนี้น้องฟังตอบไม่ได้ ลองส่งใหม่อีกครั้งนะ";
}

export default function Chat() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate, stop, setMessages } = useChat<ChatMessage>();

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const errorText = readError(error);
  const tooLong = input.length > MAX_MESSAGE_CHARS;
  const lastUser = messages.findLast((m) => m.role === "user");
  const lastUserInCrisis = lastUser ? detectCrisis(textOf(lastUser)) : false;

  // session หมดอายุ → กลับไปหน้า login
  useEffect(() => {
    if (errorText === "กรุณาเข้าสู่ระบบก่อน") router.replace("/login");
  }, [errorText, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || trimmed.length > MAX_MESSAGE_CHARS) return;
    setInput("");
    requestAnimationFrame(resizeInput);
    await sendMessage({ text: trimmed });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent-soft text-lg">
            🌿
          </span>
          <div className="leading-tight">
            <h1 className="font-semibold">{APP_NAME}</h1>
            <p className="text-xs text-muted">{busy ? "กำลังพิมพ์…" : "เพื่อนคุยของคุณ"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                stop();
                setMessages([]);
              }}
              className="rounded-full px-3 py-1.5 text-muted hover:bg-surface hover:text-ink"
            >
              เริ่มใหม่
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-full px-3 py-1.5 text-muted hover:bg-surface hover:text-ink"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center pb-10 text-center">
            <p className="text-2xl font-semibold">วันนี้เป็นยังไงบ้าง</p>
            <p className="mt-2 max-w-sm text-muted">
              เล่าอะไรก็ได้ จะระบายเฉยๆ หรืออยากได้แรงใจทำงานต่อ น้องฟังอยู่ตรงนี้
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() => void send(starter.text)}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-accent hover:text-accent"
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4 py-4">
            {messages.map((message) => {
              const text = textOf(message);
              return message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-accent-ink">
                    {text}
                  </p>
                </li>
              ) : (
                <li key={message.id} className="flex flex-col items-start gap-2">
                  {text && (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-2.5">
                      {text}
                    </p>
                  )}
                  {message.metadata?.crisis && (
                    <aside
                      role="note"
                      className="max-w-[85%] rounded-2xl border border-care-line bg-care px-4 py-3 text-sm text-care-ink"
                    >
                      <p className="font-semibold">ไม่ต้องผ่านเรื่องนี้คนเดียวนะ</p>
                      <p className="mt-1">{CRISIS_MESSAGE}</p>
                      <a
                        href="tel:1323"
                        className="mt-2 inline-block rounded-full bg-care-ink px-3 py-1 font-medium text-care"
                      >
                        โทร 1323
                      </a>
                    </aside>
                  )}
                </li>
              );
            })}

            {status === "submitted" && (
              <li className="flex" aria-label="น้องฟังกำลังพิมพ์">
                <span className="flex gap-1 rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="nf-dot size-1.5 rounded-full bg-muted"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </li>
            )}

            {error && (
              <li className="flex flex-col items-start gap-2 text-sm">
                {/* LLM ล่มก็ยังต้องเห็นเบอร์สายด่วน ถ้าข้อความล่าสุดมีคำเสี่ยง */}
                {lastUserInCrisis && (
                  <aside
                    role="note"
                    className="max-w-[85%] rounded-2xl border border-care-line bg-care px-4 py-3 text-care-ink"
                  >
                    {CRISIS_MESSAGE}
                  </aside>
                )}
                <p className="text-muted">{errorText}</p>
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  className="rounded-full border border-line px-3 py-1 hover:border-accent hover:text-accent"
                >
                  ลองอีกครั้ง
                </button>
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </main>

      <footer className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-1.5 focus-within:border-accent"
        >
          <label htmlFor="message" className="sr-only">
            ข้อความ
          </label>
          <textarea
            id="message"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resizeInput();
            }}
            onKeyDown={onKeyDown}
            placeholder="พิมพ์เล่าได้เลย…"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-muted"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-full border border-line px-4 py-2 text-sm"
            >
              หยุด
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || tooLong}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
            >
              ส่ง
            </button>
          )}
        </form>
        <p className="mt-2 px-2 text-center text-xs text-muted">
          {tooLong
            ? `ยาวเกินไป ${input.length}/${MAX_MESSAGE_CHARS} ตัวอักษร`
            : `${APP_NAME}เป็น AI ไม่ใช่ผู้เชี่ยวชาญ ถ้ารู้สึกหนักมาก โทร 1323 ได้ตลอด 24 ชม.`}
        </p>
      </footer>
    </div>
  );
}
