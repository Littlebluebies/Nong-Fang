import { describe, expect, it, vi } from "vitest";
import { prepareChatHistory, type ChatStore } from "../lib/chat-store";
import type { ChatMessage } from "../lib/types";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ID = "22222222-2222-4222-8222-222222222222";

const message: ChatMessage = { id: "m1", role: "user", parts: [{ type: "text", text: "สวัสดี" }] };

function fakeStore(overrides: Partial<ChatStore> = {}): ChatStore {
  return {
    createChat: vi.fn(async () => NEW_ID),
    chatExists: vi.fn(async () => true),
    latestChatId: vi.fn(async () => null),
    appendUserMessage: vi.fn(async () => {}),
    saveMessage: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => [message]),
    deleteChat: vi.fn(async () => true),
    ...overrides,
  };
}

const base = { userId: "owner", channel: "web" as const, message, limit: 20 };

describe("prepareChatHistory", () => {
  it("ไม่มี chatId → สร้างแชทใหม่", async () => {
    const store = fakeStore();
    const result = await prepareChatHistory({ ...base, store, chatId: undefined });
    expect(result.chatId).toBe(NEW_ID);
    expect(store.createChat).toHaveBeenCalledWith("owner", "web");
    expect(store.appendUserMessage).toHaveBeenCalledWith(NEW_ID, message);
  });

  it("แชทเดิมยังอยู่ → ใช้แชทเดิมและโหลดประวัติจาก DB", async () => {
    const history = [message, { ...message, id: "m2" }];
    const store = fakeStore({ loadMessages: vi.fn(async () => history) });
    const result = await prepareChatHistory({ ...base, store, chatId: CHAT_ID });
    expect(result).toEqual({ chatId: CHAT_ID, history });
    expect(store.createChat).not.toHaveBeenCalled();
    expect(store.loadMessages).toHaveBeenCalledWith(CHAT_ID, 20);
  });

  it("แชทถูกลบไปแล้วหรือเป็นของคนอื่น → เริ่มแชทใหม่ ไม่เขียนลงแชทนั้น", async () => {
    const store = fakeStore({ chatExists: vi.fn(async () => false) });
    const result = await prepareChatHistory({ ...base, store, chatId: CHAT_ID });
    expect(result.chatId).toBe(NEW_ID);
    expect(store.appendUserMessage).not.toHaveBeenCalledWith(CHAT_ID, expect.anything());
  });
});
