-- เฟส 2: ตารางเริ่มต้น (ดูเหตุผลใน docs/phase-2-plan.md)

create table chats (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  channel     text not null,
  created_at  timestamptz not null default now()
);

create table messages (
  id          text primary key,
  chat_id     uuid not null references chats(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  parts       jsonb not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index messages_chat_created_idx on messages (chat_id, created_at);

create table memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null check (kind in ('goal', 'fact', 'preference', 'person')),
  content     text not null check (char_length(content) <= 200),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index memories_user_created_idx on memories (user_id, created_at desc) where deleted_at is null;

create table mood_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  score       smallint not null check (score between 1 and 5),
  label       text not null check (char_length(label) <= 30),
  created_at  timestamptz not null default now()
);
create index mood_logs_user_created_idx on mood_logs (user_id, created_at desc);
