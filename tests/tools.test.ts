import { describe, expect, it, vi } from "vitest";
import type { MemoryStore } from "../lib/memory-store";
import { createTools } from "../lib/tools";

function fakeStore(overrides: Partial<MemoryStore> = {}): MemoryStore {
  return {
    saveMemory: vi.fn(async () => true),
    recallMemories: vi.fn(async () => []),
    logMood: vi.fn(async () => {}),
    ...overrides,
  };
}

// execute ต้องการ options ตัวที่สอง แต่ tools ของเราไม่ได้ใช้
const opts = { toolCallId: "t1", messages: [] };

async function run(tools: ReturnType<typeof createTools>, name: string, input: unknown) {
  const t = tools[name];
  if (!t?.execute) throw new Error(`ไม่มี tool ${name}`);
  return t.execute(input, opts);
}

describe("createTools", () => {
  it("มี tools ครบ 3 ตัวเมื่อไม่ติดด่านคำเสี่ยง", () => {
    const tools = createTools({ userId: "owner", crisis: false, store: fakeStore() });
    expect(Object.keys(tools).sort()).toEqual(["log_mood", "recall_memory", "save_memory"]);
  });

  it("ไม่มี save_memory เมื่อข้อความติดด่านคำเสี่ยง", () => {
    const tools = createTools({ userId: "owner", crisis: true, store: fakeStore() });
    expect(Object.keys(tools)).not.toContain("save_memory");
  });
});

describe("save_memory", () => {
  it("บันทึกด้วย userId จาก closure", async () => {
    const store = fakeStore();
    const tools = createTools({ userId: "owner", crisis: false, store });
    const result = await run(tools, "save_memory", { kind: "goal", content: "สอบ TOEIC ให้ได้ 700" });
    expect(result).toEqual({ ok: true });
    expect(store.saveMemory).toHaveBeenCalledWith("owner", { kind: "goal", content: "สอบ TOEIC ให้ได้ 700" });
  });

  it("บอก LLM เมื่อเคยจดไว้แล้ว", async () => {
    const store = fakeStore({ saveMemory: vi.fn(async () => false) });
    const tools = createTools({ userId: "owner", crisis: false, store });
    const result = await run(tools, "save_memory", { kind: "goal", content: "x" });
    expect(result).toMatchObject({ ok: true, note: expect.any(String) });
  });

  it("DB พังแล้วคืน ok: false ไม่โยน error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = fakeStore({ saveMemory: vi.fn(async () => Promise.reject(new Error("down"))) });
    const tools = createTools({ userId: "owner", crisis: false, store });
    expect(await run(tools, "save_memory", { kind: "fact", content: "x" })).toEqual({ ok: false });
  });
});

describe("recall_memory", () => {
  it("ส่งตัวกรองและขีดจำกัดไปที่ store", async () => {
    const memories = [{ kind: "goal" as const, content: "สอบ TOEIC", createdAt: "2026-10-08T00:00:00.000Z" }];
    const store = fakeStore({ recallMemories: vi.fn(async () => memories) });
    const tools = createTools({ userId: "owner", crisis: false, store });
    const result = await run(tools, "recall_memory", { kind: "goal" });
    expect(result).toEqual({ ok: true, memories });
    expect(store.recallMemories).toHaveBeenCalledWith("owner", { kind: "goal", limit: 20 });
  });
});

describe("log_mood", () => {
  it("บันทึกได้ครั้งเดียวต่อข้อความ", async () => {
    const store = fakeStore();
    const tools = createTools({ userId: "owner", crisis: false, store });
    expect(await run(tools, "log_mood", { score: 2, label: "เหนื่อย" })).toEqual({ ok: true });
    expect(await run(tools, "log_mood", { score: 2, label: "เหนื่อย" })).toMatchObject({ ok: false });
    expect(store.logMood).toHaveBeenCalledTimes(1);
  });
});
