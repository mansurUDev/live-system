/**
 * Хранилище документа в облаке.
 *
 * Обычная serverless-функция Vercel — Next.js для этого не нужен, папка `api`
 * работает в любом проекте. Данные лежат в Upstash Redis: у нас один JSON на
 * пользователя, и ключ-значение подходит под это лучше базы с таблицами.
 *
 * Доступ — по коду из ACCESS_CODES вида «mansur:1234,friend:5678». Это не
 * защита секретов, а разделение пользователей: без верного кода нельзя
 * прочитать или перезаписать чужой документ.
 */

const env = process.env as Record<string, string | undefined>

/**
 * Адрес и ключ хранилища.
 *
 * Vercel даёт переменным префикс, который выбирают при подключении базы:
 * KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_REST_API_URL — всё это одно
 * и то же. Вместо перечисления вариантов ищем любую пару «…REST_API_URL» и
 * «…REST_API_TOKEN» с общим префиксом, чтобы выбор в диалоге ничего не ломал.
 */
function redisCredentials(): { url: string; token: string } {
  // Ищем ключ, у которого есть парный TOKEN с тем же именем. Сначала среди
  // REST-адресов: обычный REDIS_URL — это строка подключения по сокету, по ней
  // из edge-функции не сходить.
  const keys = Object.keys(env).filter((k) => k.endsWith('URL') && env[k])
  const ordered = [...keys.filter((k) => k.includes('REST')), ...keys.filter((k) => !k.includes('REST'))]

  for (const key of ordered) {
    const token = env[key.replace(/URL$/, 'TOKEN')]
    if (token && env[key]!.startsWith('http')) return { url: env[key]!, token }
  }
  return { url: '', token: '' }
}

const { url: REDIS_URL, token: REDIS_TOKEN } = redisCredentials()

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

async function redis(command: unknown[]): Promise<unknown> {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!res.ok) throw new Error(`redis ${res.status}`)
  const body = (await res.json()) as { result?: unknown }
  return body.result
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return json({ error: 'Хранилище не подключено' }, 503)
  }

  const user = userFor(request)
  if (!user) return json({ error: 'Неверный код доступа' }, 401)

  const key = `doc:${user}`

  if (request.method === 'GET') {
    const raw = await redis(['GET', key])
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
    const raw = await redis(['GET', key])
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
    await redis(['SET', key, JSON.stringify({ doc: body.doc, version })])
    return json({ ok: true, version })
  }

  return json({ error: 'Метод не поддерживается' }, 405)
}
