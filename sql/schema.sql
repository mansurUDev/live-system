-- Хранилище документов «Система жизни» — один JSON-блок на пользователя.
--
-- Выполнить один раз в Supabase → SQL Editor нового проекта, прежде чем
-- прописывать DATABASE_URL в переменных окружения Vercel.

create table if not exists docs (
  user_id    text primary key,
  doc        jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);
