import { randomUUID, createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Хранилище фото идей — Supabase Storage.
 *
 * Самодостаточный файл, как api/doc.ts: код доступа проверяется той же
 * схемой, скопированной сюда напрямую, а не импортированной, — чтобы не
 * тащить `pg` в функцию, которая с Postgres не работает вовсе.
 *
 * Фото не проходят через Postgres-документ — там хранятся только их
 * публичные URL. Бакет создаётся сам при первой загрузке, руками в Supabase
 * ничего заводить не нужно.
 */

const env = process.env as Record<string, string | undefined>

/**
 * Адрес проекта Supabase.
 *
 * Каноничное имя — SUPABASE_URL, но диалоги хостингов и привычки из других
 * фреймворков подсовывают свои (NEXT_PUBLIC_SUPABASE_URL и т.п.) — поэтому,
 * как и с DATABASE_URL в api/doc.ts, подойдёт любая переменная, значение
 * которой выглядит как адрес проекта Supabase.
 */
function supabaseUrl(): string {
  if (env.SUPABASE_URL) return env.SUPABASE_URL.replace(/\/+$/, '')
  for (const key of Object.keys(env)) {
    const value = (env[key] ?? '').trim().replace(/\/+$/, '')
    if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value)) return value
  }
  return ''
}

const SUPABASE_URL = supabaseUrl()
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BUCKET = env.MEDIA_BUCKET || 'media'

/** Раза в полтора ниже жёсткого лимита тела запроса на Vercel (4.5МБ) — с запасом на заголовки */
const MAX_BYTES = 4 * 1024 * 1024

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

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
  if (map.size === 0) return code.slice(0, 40)
  return map.get(code) ?? null
}

/** Папка пользователя в бакете: имя как есть, если оно безопасно для пути, иначе его хэш */
function userSeg(user: string): string {
  return /^[A-Za-z0-9_-]{1,40}$/.test(user) ? user : createHash('sha256').update(user).digest('hex')
}

function param(req: VercelRequest, key: string): string {
  const v = req.query[key]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

/** Бакет мог ещё не существовать — создаём публичным (публичные URL и есть контракт этого API) */
async function ensureBucket(): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(503).json({ error: 'Хранилище фото не настроено' })
    return
  }

  const user = userFor(req)
  if (!user) {
    res.status(401).json({ error: 'Неверный код доступа' })
    return
  }
  const seg = userSeg(user)

  if (req.method === 'POST') {
    const ext = param(req, 'ext').toLowerCase()
    const mime = MIME[ext]
    if (!mime) {
      res.status(400).json({ error: 'Неподдерживаемый формат фото' })
      return
    }

    // raw binary: Vercel парсит application/octet-stream сам, req.body — Buffer
    const body = req.body as unknown
    const buf = Buffer.isBuffer(body) ? body : null
    if (!buf || buf.length === 0) {
      res.status(400).json({ error: 'Пустое фото' })
      return
    }
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'Фото слишком большое' })
      return
    }

    const path = `${seg}/${randomUUID()}.${ext}`
    const upload = () =>
      fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'content-type': mime,
        },
        body: buf,
      })

    try {
      let upstream = await upload()
      if (!upstream.ok) {
        const firstError = await upstream.text()
        // «Бакета нет» Storage отдаёт как HTTP 400 со statusCode «404» лишь в
        // теле ответа — по коду его не поймать, только по тексту.
        if (/bucket not found|nosuchbucket/i.test(firstError)) {
          await ensureBucket()
          upstream = await upload()
        }
        if (!upstream.ok) {
          console.error('Загрузка фото не удалась:', upstream.status, upstream.bodyUsed ? firstError : await upstream.text())
          res.status(502).json({ error: 'Не удалось сохранить фото' })
          return
        }
      }
      res.status(200).json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` })
    } catch (e) {
      console.error('Хранилище фото недоступно:', e)
      res.status(502).json({ error: 'Не удалось сохранить фото' })
    }
    return
  }

  if (req.method === 'DELETE') {
    const raw = param(req, 'url')
    let pathname: string
    try {
      pathname = new URL(raw).pathname
    } catch {
      res.status(400).json({ error: 'Некорректная ссылка' })
      return
    }

    // Путь должен строго лежать в папке запрашивающего — чужие файлы недостижимы
    const prefix = `/storage/v1/object/public/${BUCKET}/${seg}/`
    const rest = pathname.slice(prefix.length)
    if (!pathname.startsWith(prefix) || !/^[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(rest)) {
      res.status(403).json({ error: 'Нет доступа к этому файлу' })
      return
    }

    try {
      const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${seg}/${rest}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      })
      // 404 — файла и так уже нет, удаление всё равно достигло цели
      if (!upstream.ok && upstream.status !== 404) {
        res.status(502).json({ error: 'Не удалось удалить фото' })
        return
      }
      res.status(200).json({ ok: true })
    } catch (e) {
      console.error('Хранилище фото недоступно:', e)
      res.status(502).json({ error: 'Не удалось удалить фото' })
    }
    return
  }

  res.status(405).json({ error: 'Метод не поддерживается' })
}
