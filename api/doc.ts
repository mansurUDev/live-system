import { createClient, type RedisClientType } from 'redis'

/**
 * Хранилище документа в облаке.
 *
 * Обычная serverless-функция Vercel — Next.js для этого не нужен, папка `api`
 * работает в любом проекте. Данные лежат в Redis: у нас один JSON на
 * пользователя, и ключ-значение подходит под это лучше базы с таблицами.
 *
 * Подключение идёт по обычному протоколу Redis, а не по HTTP: именно такую
 * строку выдаёт Vercel при создании базы. Поэтому функция работает в среде
 * Node — из edge-окружения сокет не открыть.
 *
 * Доступ — по коду из ACCESS_CODES вида «mansur:1234,friend:5678». Это не
 * защита секретов, а разделение пользователей: без верного кода нельзя
 * прочитать или перезаписать чужой документ.
 */

const env = process.env as Record<string, string | undefined>

/**
 * Строка подключения.
 *
 * Vercel даёт переменным префикс, который выбирают при подключении базы:
 * REDIS_URL, KV_URL, STORAGE_URL — это одно и то же. Вместо перечисления
 * вариантов берём первую подходящую, чтобы выбор в диалоге ничего не ломал.
 */
function redisUrl(): string {
  const keys = Object.keys(env).filter((k) => k.endsWith('URL') && env[k])
  for (const key of keys) {
    const value = env[key]!
    if (value.startsWith('redis://') || value.startsWith('rediss://')) return value
  }
  return ''
}

const REDIS_URL = redisUrl()

// Клиент переиспользуется между вызовами: соединение переживает тёплый старт,
// и каждый запрос не платит за рукопожатие заново.
let clientPromise: Promise<RedisClientType> | null = null

async function client(): Promise<RedisClientType> {
  if (!clientPromise) {
    clientPromise = createClient({ url: REDIS_URL })
      .on('error', () => {
        // соединение оборвалось — следующий вызов поднимет новое
        clientPromise = null
      })
      .connect() as Promise<RedisClientType>
  }
  return clientPromise
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

function userFor(request: Request): string | null {
  const code = request.headers.get('x-access-code')?.trim()
  if (!code) return null
  const map = accessMap()
  // Пока коды не заданы, любое непустое значение считается своим — так
  // приложение работает сразу после деплоя, до настройки переменных.
  if (map.size === 0) return code.slice(0, 40)
  return map.get(code) ?? null
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (!REDIS_URL) return json({ error: 'Хранилище не подключено' }, 503)

  const user = userFor(request)
  if (!user) return json({ error: 'Неверный код доступа' }, 401)

  const key = `doc:${user}`

  try {
    const redis = await client()

    if (request.method === 'GET') {
      const raw = await redis.get(key)
      if (typeof raw !== 'string') return json({ doc: null, version: 0 })
      try {
        return json(JSON.parse(raw))
      } catch {
        return json({ doc: null, version: 0 })
      }
    }

    if (request.method === 'PUT') {
      let body: { doc?: unknown; version?: unknown }
      try {
        body = (await request.json()) as typeof body
      } catch {
        return json({ error: 'Тело запроса не разобрано' }, 400)
      }
      if (!body.doc || typeof body.doc !== 'object') {
        return json({ error: 'Нет документа' }, 400)
      }

      // Версия защищает от затирания: если на другом устройстве уже сохранили
      // свежее, клиент сначала должен забрать чужие правки.
      const incoming = Number(body.version) || 0
      const raw = await redis.get(key)
      let stored = 0
      if (typeof raw === 'string') {
        try {
          stored = Number((JSON.parse(raw) as { version?: number }).version) || 0
        } catch {
          stored = 0
        }
      }
      if (incoming < stored) {
        return json({ error: 'Есть более свежая версия', version: stored }, 409)
      }

      const version = stored + 1
      await redis.set(key, JSON.stringify({ doc: body.doc, version }))
      return json({ ok: true, version })
    }

    return json({ error: 'Метод не поддерживается' }, 405)
  } catch {
    return json({ error: 'Хранилище недоступно' }, 503)
  }
}
