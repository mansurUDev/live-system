import { Pool } from 'pg'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyShare, classifyShare, SHARE_MAX_TITLE, SHARE_MAX_URL, type ShareDoc, type ShareHint } from './shareLogic'

/**
 * Приём ссылки с телефона: «Поделиться» → приложение.
 *
 * На iOS веб-приложение не может попасть в системное меню «Поделиться», зато
 * туда попадает Быстрая команда — она и стучится сюда, а ответ показывает
 * уведомлением. Android отдаёт ссылку прямо в приложение через share_target,
 * и этот эндпоинт ему не нужен.
 *
 * Пишет напрямую в облако тем же способом, что и телеграм-бот: читает строку,
 * применяет действие, сохраняет по версии. Приложение узнает о записи, когда
 * в следующий раз вернётся на вкладку.
 */

const env = process.env as Record<string, string | undefined>

function databaseUrl(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL
  for (const key of Object.keys(env)) {
    const value = env[key]
    if (value && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) return value
  }
  return ''
}

const DATABASE_URL = databaseUrl()

let pool: Pool | null = null

function db(): Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } })
  return pool
}

/** Тот же разбор кодов, что и в api/doc.ts: разделение пользователей, не защита секретов */
function userFor(req: VercelRequest): string {
  const raw = req.headers['x-access-code']
  const code = (Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!code) return ''

  const list = (env.ACCESS_CODES ?? '').trim()
  if (!list) return code.slice(0, 40)

  for (const pair of list.split(',')) {
    const [name, value] = pair.split(':').map((x) => x.trim())
    if (name && value && value === code) return name
  }
  return ''
}

/** Название ролика: публичный oEmbed YouTube, ключ не нужен */
async function fetchOembed(url: string): Promise<{ title?: string; channel?: string; thumbnail?: string }> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 4000)
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: ctl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return {}
    const body = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
    return { title: body.title, channel: body.author_name, thumbnail: body.thumbnail_url }
  } catch {
    return {}
  }
}

/**
 * Название страницы для «Смотреть» — только с известных сайтов: ходить по
 * произвольному адресу с сервера значит превратить эндпоинт в чужой прокси.
 */
const TITLE_HOSTS = ['kinopoisk.ru', 'imdb.com', 'myanimelist.net', 'shikimori.one', 'doramy.club']

async function fetchPageTitle(url: string): Promise<string> {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, '')
    if (!TITLE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return ''
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 4000)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0' } })
    clearTimeout(t)
    if (!res.ok) return ''
    const html = (await res.text()).slice(0, 200_000)
    const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
    return m ? m[1]!.trim().slice(0, SHARE_MAX_TITLE) : ''
  } catch {
    return ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Только POST' })
    return
  }
  if (!DATABASE_URL) {
    res.status(503).json({ error: 'Хранилище не подключено' })
    return
  }

  const user = userFor(req)
  if (!user) {
    res.status(401).json({ error: 'Неверный код доступа' })
    return
  }

  let body: { url?: unknown; kind?: unknown; title?: unknown; text?: unknown }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ error: 'Тело запроса не разобрано' })
    return
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, 4000) : ''
  const rawUrl = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : firstUrl(text)
  if (!rawUrl || rawUrl.length > SHARE_MAX_URL || !/^https?:\/\//i.test(rawUrl)) {
    res.status(400).json({ error: 'Нужна ссылка http(s)' })
    return
  }

  const hint: ShareHint =
    body.kind === 'video' || body.kind === 'show' || body.kind === 'idea' ? body.kind : 'auto'
  const target = classifyShare(rawUrl, hint)
  const givenTitle = typeof body.title === 'string' ? body.title.trim().slice(0, SHARE_MAX_TITLE) : ''

  try {
    const meta = target.kind === 'video' ? await fetchOembed(rawUrl) : {}
    const title =
      givenTitle ||
      meta.title ||
      (target.kind === 'show' ? await fetchPageTitle(rawUrl) : '')

    const pg = db()
    let message = ''
    let kind = target.kind

    // как в api/doc.ts и телеграм-боте: при гонке перечитываем и применяем заново
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = (
        await pg.query<{ doc: ShareDoc; version: number }>('select doc, version from docs where user_id = $1', [user])
      ).rows[0]
      if (!row?.doc) {
        message = 'В облаке ещё нет документа — открой приложение хотя бы раз'
        break
      }

      const result = applyShare(
        row.doc,
        target,
        { url: rawUrl, title, note: title && text.includes(rawUrl) ? '' : text.replace(rawUrl, '').trim() },
        {
          id: `sh${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          nowIso: new Date().toISOString(),
          channel: meta.channel,
          thumbnail: meta.thumbnail,
        },
      )
      message = result.message
      kind = result.kind
      if (!result.changed) break

      const saved = await pg.query(
        `update docs set doc = $2::jsonb, version = version + 1, updated_at = now()
         where user_id = $1 and version = $3
         returning version`,
        [user, JSON.stringify(row.doc), row.version],
      )
      if (saved.rows.length > 0) break
      if (attempt === 2) message = 'Не получилось записать — попробуй ещё раз'
    }

    res.status(200).json({ ok: true, kind, title, message })
  } catch (e) {
    console.error('Поделиться: ошибка обработки:', e)
    res.status(503).json({ error: 'Хранилище недоступно' })
  }
}

/** Из текста «посмотри https://… потом» достаём сам адрес */
function firstUrl(text: string): string {
  const m = /https?:\/\/[^\s<>]+/.exec(text)
  if (!m) return ''
  return m[0].replace(/[.,;:!?)\]»"'’]+$/, '')
}
