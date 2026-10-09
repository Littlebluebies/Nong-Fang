# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

น้องฟัง (Nong Fang): a single-user Thai-language companion chatbot (venting + motivation). Next.js 16 App Router, Vercel AI SDK v6 with OpenAI, optional PostgreSQL (Neon), Vitest. Deployed on Vercel.

Code comments, docs, user-facing strings, error messages and test names are written in Thai. Keep that convention.

## Commands

```bash
npm run dev                          # local dev server (http://localhost:3000)
npm test                             # vitest run (all unit tests)
npx vitest run tests/safety.test.ts  # single test file
npx vitest run -t "<test name>"      # single test by name
npm run typecheck                    # tsc --noEmit
npm run build                        # production build
npm run db:migrate                   # apply db/migrations/*.sql (reads DATABASE_URL from .env.local)
```

Env vars are documented in `.env.example` (`OPENAI_API_KEY`, `OPENAI_MODEL`, `APP_PASSWORD`, `SESSION_SECRET`, optional `DATABASE_URL`). There is no vitest config; tests import from `../lib/...` with relative paths and use fake stores, so they need no DB or API key.

## Architecture

**Single channel-agnostic pipeline.** Every channel calls `runChat` in `lib/chat-pipeline.ts` (web now, LINE planned for phase 3 via `/api/line-webhook`). Don't put chat logic in route handlers. Order is fixed: (1) crisis keyword check on the latest user message, (2) trim history to `MAX_HISTORY_MESSAGES` and keep only text parts, (3) `streamText` with system prompt and tools.

**Phase 2 is toggled by `DATABASE_URL`.** `isDatabaseConfigured()` (`lib/db.ts`) gates everything: without it there are no tools and no chat persistence, and the app behaves as phase 1. Preserve this fallback when touching DB code.

**Server-side history.** When the DB is on, `POST /api/chat` uses only the last message from the client; `prepareChatHistory` (`lib/chat-store.ts`) saves it and loads history from the DB (so the client can't forge assistant turns). The assistant reply is saved in `onFinish`, and `result.consumeStream()` ensures it completes even if the client disconnects. `GET` loads the latest chat, `DELETE ?id=` removes a chat (memories are kept).

**Crisis safety is code, not LLM.** `lib/safety.ts` normalizes text and matches `CRISIS_KEYWORDS` (prefer false positives). On a hit: the prompt gets a crisis addendum, `save_memory` is removed from the toolset, and `{ crisis }` is sent as message metadata so the UI shows the 1323 hotline card. `components/chat.tsx` also re-runs `detectCrisis` client-side as a fallback so the card shows even if the LLM fails. Adding a keyword should come with a test case in `tests/safety.test.ts`.

**Memory tools** (`lib/tools.ts`): `save_memory`, `recall_memory`, `log_mood`, capped at `MAX_TOOL_STEPS`. `userId` comes from a closure, never from LLM input. Storage goes through the `MemoryStore`/`ChatStore` interfaces (`lib/memory-store.ts`, `lib/chat-store.ts`) using raw SQL with `@neondatabase/serverless` (no ORM) so tests can inject fakes.

**Versioned system prompt.** `lib/prompt.ts` loads `prompts/system-${PROMPT_VERSION}.md` and substitutes `{{BOT_NAME}}`. To change the prompt, create a new `system-vN.md` and bump `PROMPT_VERSION` rather than editing the old file; then run the manual conversation suite in `tests/conversations.md`. The section between `<!-- memory -->` and `<!-- /memory -->` is stripped when tools are unavailable.

**Auth.** Single password (`APP_PASSWORD`) issues an HMAC-signed cookie (`lib/auth.ts`). `proxy.ts` (Next.js 16's replacement for `middleware.ts`) guards all routes; API routes re-verify the cookie themselves. `/api/chat` also has an in-memory rate limit (`lib/rate-limit.ts`) and a zod schema that only accepts `user`/`assistant` roles and text parts.

**Config.** All limits and the bot name live in `lib/config.ts`.

## Rules

- Never log chat content or tool inputs. Logs are single-line JSON with metadata only (event, token counts, crisis flag, prompt version, tool names).
- Schema changes go in a new numbered file in `db/migrations/`; applied files are tracked in `schema_migrations` and never re-run.
- Record scope or stack decisions in `docs/decisions.md` (newest first). Keep `docs/ARCHITECTURE.md` and the README's AI-collaboration table in sync when finishing a piece of work.
