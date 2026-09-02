import type { Pool } from 'pg'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyAction, classify, type TgDoc } from './tgLogic.js'



/**
 * Вебхук телеграм-бота: сообщение из группы-«избранного» превращается в запись
 * документа — youtube-ссылки в очередь видео, остальное в идеи с категорией по
 * названию группы.
 *
 * Переменные окружения (задаются в Vercel):
 *  - TELEGRAM_BOT_TOKEN — токен бота от BotFather;
 *  - TELEGRAM_SECRET    — свой секрет, тот же передаётся в setWebhook: чужой
 *    POST на этот адрес без секрета отбрасывается;
 *  - TELEGRAM_OWNER_ID  — числовой id владельца: бот слушает только его
 *    сообщения, даже если кто-то добавит бота в свою группу;
 *  - TELEGRAM_DOC_USER  — user_id строки в docs (имя из ACCESS_CODES, либо сам
 *    код, если ACCESS_CODES не задан).
 *
 * Telegram повторяет доставку при не-200, поэтому ответ всегда 200 — иначе
 * одна ошибка превратилась бы в бесконечный повтор одного и того же апдейта.
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
/**
 * Пул соединений. Модуль `pg` подгружается лениво: он собран как CommonJS, и
 * статический импорт в ESM-функции падает на старте — с Node 24 это стоило
 * пятисотых на всех эндпоинтах, ходящих в базу.
 */
async function db(): Promise<Pool> {
  if (!pool) {
    const { default: pg } = await import('pg')
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 3,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

interface TgMessage {
  message_id?: number
  from?: { id?: number }
  chat?: { id?: number; type?: string; title?: string }
  text?: string
  caption?: string
}

/** Название ролика через oEmbed — без ключей API; не ответил за 4с — обойдёмся без названия */
async function fetchOembed(url: string): Promise<{ title?: string; channel?: string; thumbnail?: string }> {
  try {
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url), {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return {}
    const body = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
    return { title: body.title, channel: body.author_name, thumbnail: body.thumbnail_url }
  } catch {
    return {}
  }
}

async function sendReply(chatId: number, text: string, replyTo?: number): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyTo ? { reply_parameters: { message_id: replyTo } } : null),
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    /* ответ в группу — вежливость, а не обязанность; запись уже сделана */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Метод не поддерживается' })
    return
  }

  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (!env.TELEGRAM_SECRET || secret !== env.TELEGRAM_SECRET) {
    // не наш вызов; 200 без обработки, чтобы не подсказывать перебором
    res.status(200).json({ ok: true })
    return
  }

  const docUser = env.TELEGRAM_DOC_USER
  const ownerId = Number(env.TELEGRAM_OWNER_ID)
  if (!docUser || !Number.isFinite(ownerId) || !DATABASE_URL || !env.TELEGRAM_BOT_TOKEN) {
    console.error('Телеграм-бот: не заданы переменные окружения')
    res.status(200).json({ ok: true })
    return
  }

  let update: { message?: TgMessage }
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(200).json({ ok: true })
    return
  }

  const msg = update.message
  const chatId = msg?.chat?.id
  // каналы мимо: у постов канала нет автора, проверить владельца нечем
  const chatOk = msg?.chat?.type === 'group' || msg?.chat?.type === 'supergroup' || msg?.chat?.type === 'private'
  if (!msg || !chatId || !chatOk || msg.from?.id !== ownerId) {
    res.status(200).json({ ok: true })
    return
  }

  const action = classify(msg.text ?? msg.caption ?? '', msg.chat?.title ?? '')

  try {
    const pg = await db()
    const meta =
      action.kind === 'video'
        ? { ...(await fetchOembed(action.url)) }
        : ({} as { title?: string; channel?: string; thumbnail?: string })

    // как в api/doc.ts: версия защищает от гонки с устройствами; при конфликте
    // перечитываем и накатываем действие на свежий документ ещё раз
    let reply = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = (
        await pg.query<{ doc: TgDoc; version: number }>('select doc, version from docs where user_id = $1', [docUser])
      ).rows[0]
      if (!row?.doc) {
        reply = 'В облаке ещё нет документа — открой приложение хотя бы раз'
        break
      }

      const result = applyAction(row.doc, action, {
        id: `tg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        nowIso: new Date().toISOString(),
        ...meta,
      })
      reply = result.reply
      if (!result.changed) break

      const upsert = await pg.query(
        `update docs set doc = $2::jsonb, version = version + 1, updated_at = now()
         where user_id = $1 and version = $3
         returning version`,
        [docUser, JSON.stringify(row.doc), row.version],
      )
      if (upsert.rows.length > 0) break
      // версия уехала — устройство успело сохранить; последний круг не молчит
      if (attempt === 2) reply = 'Не получилось записать — попробуй переслать ещё раз'
    }

    await sendReply(chatId, reply, msg.message_id)
  } catch (e) {
    console.error('Телеграм-бот: ошибка обработки:', e)
    await sendReply(chatId, 'Что-то сломалось на сервере — попробуй позже')
  }

  res.status(200).json({ ok: true })
}
