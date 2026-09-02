import pg from 'pg'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { planRetention, shouldCoalesce, type VersionRow } from './docHistoryLogic'

/**
 * Именованный импорт `{ Pool } from 'pg'` в ESM-сборке функций (в package.json
 * "type": "module") падает при инициализации: пакет отдаёт CommonJS-объект.
 */
const { Pool } = pg
type Pool = pg.Pool


/**
 * Хранилище документа в облаке.
 *
 * Обычная serverless-функция Vercel — Next.js для этого не нужен, папка `api`
 * работает в любом проекте. Данные лежат в Postgres (Supabase): один JSON на
 * пользователя, версия для оптимистичной конкурентности и время последнего
 * изменения — всё в одной строке одной таблицы (см. sql/schema.sql).
 *
 * Сравнение-и-запись — один атомарный SQL-запрос (`INSERT ... ON CONFLICT DO
 * UPDATE ... WHERE version = $incoming`): если между чтением клиентом своей
 * версии и этой записью кто-то уже сохранил более новую, WHERE не совпадёт и
 * обновление не пройдёт — Postgres гарантирует это сам, без ручной блокировки
 * или скриптов.
 *
 * Доступ — по коду из ACCESS_CODES вида «mansur:1234,friend:5678». Это не
 * защита секретов, а разделение пользователей: без верного кода нельзя
 * прочитать или перезаписать чужой документ.
 */

const env = process.env as Record<string, string | undefined>

/**
 * Строка подключения.
 *
 * Supabase и подобные сервисы обычно кладут её в DATABASE_URL, но ищем и
 * любую другую переменную, похожую на адрес Postgres, — так выбор имени в
 * диалоге хостинга ничего не ломает.
 */
function databaseUrl(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL
  for (const key of Object.keys(env)) {
    const value = env[key]
    if (value && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) return value
  }
  return ''
}

const DATABASE_URL = databaseUrl()

/**
 * Таблица истории появилась позже основной, и её может не быть: пользователь
 * подключил облако раньше. Первая же ошибка «нет такой таблицы» переводит
 * историю в выключенное состояние до следующего холодного старта — иначе
 * каждый PUT платил бы за неудачный запрос.
 */
let historyOff = false

// Пул переиспользуется между вызовами: соединения переживают тёплый старт,
// и каждый запрос не платит за рукопожатие заново.
let pool: Pool | null = null

function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      // Supabase (как и большинство управляемых Postgres) ждёт TLS — без этой
      // опции pg пытается открыть соединение в открытую, и сервер его рвёт.
      // rejectUnauthorized: false — сертификат пула не всегда есть в доверенных
      // корнях Node; для managed-БД это стандартный и достаточный компромисс.
      ssl: { rejectUnauthorized: false },
    })
    pool.on('error', () => {
      // соединение оборвалось — следующий вызов поднимет пул заново
      pool = null
    })
  }
  return pool
}

/** Разбирает «имя:код,имя:код» в соответствие код → имя пользователя */
function accessMap(): Map<string, string> {
  const out = new Map<string, string>()
  for (const pair of (env.ACCESS_CODES ?? '').split(',')) {
    const [user, code] = pair.split(':').map((s) => s?.trim())
    if (user && code) out.set(code, user)
  }
  return out
}

function userFor(req: VercelRequest): string | null {
  const raw = req.headers['x-access-code']
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim()
  if (!code) return null
  const map = accessMap()
  // Пока коды не заданы, любое непустое значение считается своим — так
  // приложение работает сразу после деплоя, до настройки переменных.
  if (map.size === 0) return code.slice(0, 40)
  return map.get(code) ?? null
}

/** Postgres: «отношение не существует» — таблицы истории просто нет */
function isMissingTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '42P01'
}

/**
 * Записать версию в историю. Никогда не мешает основному сохранению: документ
 * уже сохранён, и любая беда с историей — повод промолчать, а не потерять
 * правку. Отдельными запросами, а не транзакцией: пул работает через pgbouncer
 * в режиме транзакций, где BEGIN требует отдельного соединения.
 */
async function saveVersion(pg: Pool, user: string, version: number, doc: string): Promise<void> {
  if (historyOff) return
  try {
    const last = await pg.query<{ id: string; saved_at: string }>(
      'select id, saved_at from doc_versions where user_id = $1 order by version desc limit 1',
      [user],
    )
    const row = last.rows[0]
    if (row && shouldCoalesce(new Date(row.saved_at).toISOString(), Date.now())) {
      await pg.query('update doc_versions set doc = $1::jsonb, version = $2, saved_at = now() where id = $3', [
        doc,
        version,
        row.id,
      ])
    } else {
      await pg.query('insert into doc_versions (user_id, doc, version) values ($1, $2::jsonb, $3)', [
        user,
        doc,
        version,
      ])
    }

    const all = await pg.query<{ id: string; version: number; saved_at: string }>(
      'select id, version, saved_at from doc_versions where user_id = $1 order by version desc',
      [user],
    )
    const rows: VersionRow[] = all.rows.map((r) => ({
      id: Number(r.id),
      version: r.version,
      savedAt: new Date(r.saved_at).toISOString(),
    }))
    const drop = planRetention(rows, Date.now())
    if (drop.length) await pg.query('delete from doc_versions where id = any($1::bigint[])', [drop])
  } catch (e) {
    if (isMissingTable(e)) {
      historyOff = true
      return
    }
    console.error('История версий не записана:', e)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (!DATABASE_URL) {
    res.status(503).json({ error: 'Хранилище не подключено' })
    return
  }

  const user = userFor(req)
  if (!user) {
    res.status(401).json({ error: 'Неверный код доступа' })
    return
  }

  try {
    const pg = db()

    if (req.method === 'GET' && req.query.history) {
      if (historyOff) {
        res.status(200).json({ enabled: false, versions: [] })
        return
      }
      try {
        const list = await pg.query<{ version: number; saved_at: string; bytes: number }>(
          `select version, saved_at, pg_column_size(doc) as bytes
             from doc_versions where user_id = $1 order by version desc`,
          [user],
        )
        res.status(200).json({
          enabled: true,
          versions: list.rows.map((r) => ({
            version: r.version,
            savedAt: new Date(r.saved_at).toISOString(),
            bytes: Number(r.bytes) || 0,
          })),
        })
      } catch (e) {
        if (!isMissingTable(e)) throw e
        historyOff = true
        res.status(200).json({ enabled: false, versions: [] })
      }
      return
    }

    if (req.method === 'GET' && req.query.version) {
      const wanted = Number(req.query.version)
      if (!Number.isFinite(wanted)) {
        res.status(400).json({ error: 'Версия не разобрана' })
        return
      }
      try {
        const one = await pg.query<{ doc: unknown; version: number }>(
          'select doc, version from doc_versions where user_id = $1 and version = $2',
          [user, wanted],
        )
        const row = one.rows[0]
        if (!row) {
          res.status(404).json({ error: 'Такой версии нет' })
          return
        }
        res.status(200).json({ doc: row.doc, version: row.version })
      } catch (e) {
        if (!isMissingTable(e)) throw e
        historyOff = true
        res.status(404).json({ error: 'История выключена' })
      }
      return
    }

    if (req.method === 'GET') {
      const result = await pg.query<{ doc: unknown; version: number }>(
        'select doc, version from docs where user_id = $1',
        [user],
      )
      const row = result.rows[0]
      res.status(200).json(row ? { doc: row.doc, version: row.version } : { doc: null, version: 0 })
      return
    }

    if (req.method === 'PUT') {
      // тело может приехать уже разобранным или строкой — зависит от заголовков
      let body: { doc?: unknown; version?: unknown }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        res.status(400).json({ error: 'Тело запроса не разобрано' })
        return
      }
      if (!body.doc || typeof body.doc !== 'object') {
        res.status(400).json({ error: 'Нет документа' })
        return
      }

      // Версия защищает от затирания: если на другом устройстве уже сохранили
      // свежее, клиент сначала должен забрать чужие правки. WHERE version = $3
      // совпадёт только если ничего не изменилось между чтением и записью —
      // при первой вставке (ON CONFLICT ещё не сработал) он не применяется
      // вовсе, поэтому самый первый документ пользователя всегда принимается.
      const incoming = Number(body.version) || 0
      const upsert = await pg.query<{ version: number }>(
        `insert into docs (user_id, doc, version, updated_at)
         values ($1, $2::jsonb, 1, now())
         on conflict (user_id) do update
           set doc = excluded.doc, version = docs.version + 1, updated_at = now()
           where docs.version = $3
         returning version`,
        [user, JSON.stringify(body.doc), incoming],
      )

      if (upsert.rows.length === 0) {
        const current = await pg.query<{ version: number }>('select version from docs where user_id = $1', [user])
        res.status(409).json({ error: 'Есть более свежая версия', version: current.rows[0]?.version ?? 0 })
        return
      }

      const version = upsert.rows[0]!.version
      await saveVersion(pg, user, version, JSON.stringify(body.doc))
      res.status(200).json({ ok: true, version })
      return
    }

    // Смена кода: данные уже скопированы под новый, старую запись убираем,
    // иначе прежний код так и остался бы рабочим ключом к ним.
    if (req.method === 'DELETE') {
      await pg.query('delete from docs where user_id = $1', [user])
      // историю тоже: иначе старый код остался бы ключом к прежним версиям
      try {
        await pg.query('delete from doc_versions where user_id = $1', [user])
      } catch (e) {
        if (!isMissingTable(e)) throw e
        historyOff = true
      }
      res.status(200).json({ ok: true })
      return
    }

    res.status(405).json({ error: 'Метод не поддерживается' })
  } catch (e) {
    // текст ошибки виден в логах Vercel — по нему понятно, что с хранилищем
    console.error('Хранилище недоступно:', e)
    res.status(503).json({ error: 'Хранилище недоступно' })
  }
}
