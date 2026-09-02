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

-- История версий: по строке на сохранение, чтобы можно было откатиться.
-- Таблица необязательная — без неё приложение работает как раньше, просто
-- история выключена. Добавлена позже основной, поэтому выполняется отдельно.
create table if not exists doc_versions (
  id       bigserial primary key,
  user_id  text not null,
  version  integer not null,
  doc      jsonb not null,
  saved_at timestamptz not null default now(),
  unique (user_id, version)
);
