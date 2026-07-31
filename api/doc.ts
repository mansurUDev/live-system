import { createClient, type RedisClientType } from 'redis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Хранилище документа в облаке.
 *
 * Обычная serverless-функция Vercel — Next.js для этого не нужен, папка `api`
 * работает в любом проекте. Данные лежат в Redis: у нас один JSON на
 * пользователя, и ключ-значение подходит под это лучше базы с таблицами.
 *
 * Подключение идёт по обычному протоколу Redis: именно такую строку выдаёт
 * Vercel при создании базы, а из edge-окружения сокет не открыть — поэтому
 * функция живёт в среде Node и написана в её классической форме.
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
 * вариантов ищем первую, похожую на адрес Redis, чтобы выбор в диалоге ничего
 * не ломал.
 */
function redisUrl(): string {
  for (const key of Object.keys(env)) {
    const value = env[key]
    if (value && (value.startsWith('redis://') || value.startsWith('rediss://'))) return value
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (!REDIS_URL) {
    res.status(503).json({ error: 'Хранилище не подключено' })
    return
  }

  const user = userFor(req)
  if (!user) {
    res.status(401).json({ error: 'Неверный код доступа' })
    return
  }

  const key = `doc:${user}`

  try {
    const redis = await client()

    if (req.method === 'GET') {
      const raw = await redis.get(key)
      if (typeof raw !== 'string') {
        res.status(200).json({ doc: null, version: 0 })
        return
      }
      try {
        res.status(200).json(JSON.parse(raw))
      } catch {
        res.status(200).json({ doc: null, version: 0 })
      }
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
        res.status(409).json({ error: 'Есть более свежая версия', version: stored })
        return
      }

      const version = stored + 1
      await redis.set(key, JSON.stringify({ doc: body.doc, version }))
      res.status(200).json({ ok: true, version })
      return
    }

    // Смена кода: данные уже скопированы под новый, старую запись убираем,
    // иначе прежний код так и остался бы рабочим ключом к ним.
    if (req.method === 'DELETE') {
      await redis.del(key)
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
