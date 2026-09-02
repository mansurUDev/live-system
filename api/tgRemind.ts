import pg from 'pg'

// именованный импорт из 'pg' в ESM-сборке (в package.json "type": "module")
// падает при инициализации функции: пакет отдаёт CommonJS-объект
const { Pool } = pg
type Pool = pg.Pool
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pruneSentKeys, remindPlan, tashkentNow, type RemindDoc } from './tgRemindLogic'

/**
 * Напоминалка статусов трекера: дёргается снаружи по расписанию (GitHub
 * Actions cron — Vercel Hobby умеет только раз в сутки, этой фиче нужно чаще)
 * и решает, не пора ли попросить обновить трекер — подъём, дорога на работу,
 * сам приход, дорога домой, отбой. Молчит, если статус уже соответствует.
 *
 * Переменные окружения:
 *  - REMIND_SECRET      — свой секрет для заголовка x-remind-secret; если не
 *    задан, используется TELEGRAM_SECRET (но лучше свой — ротируется отдельно
 *    от вебхука, которому вслед за сменой TELEGRAM_SECRET нужен setWebhook);
 *  - TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, TELEGRAM_DOC_USER — те же, что и
 *    у вебхука (api/telegram.ts).
 *
 * Анти-дубль хранится второй строкой в той же таблице docs, с user_id вида
 * "<TELEGRAM_DOC_USER>:remind" — коллизия с настоящим кодом входа исключена:
 * при заданном ACCESS_CODES имя пользователя обрывается на первом двоеточии
 * при разборе, а без ACCESS_CODES владелец сам выбирает свои коды.
 *
 * Секрет и запись состояния — до отправки сообщения: если Telegram не ответит
 * после этого, слот в худшем случае пропущен, а не продублирован задним числом.
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
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      ssl: { rejectUnauthorized: false },
    })
    pool.on('error', () => {
      pool = null
    })
  }
  return pool
}

async function sendMessage(chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(4000),
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Метод не поддерживается' })
    return
  }

  const wantSecret = env.REMIND_SECRET || env.TELEGRAM_SECRET
  const secret = req.headers['x-remind-secret']
  if (!wantSecret || secret !== wantSecret) {
    res.status(401).json({ error: 'Неверный секрет' })
    return
  }

  const docUser = env.TELEGRAM_DOC_USER
  const ownerId = Number(env.TELEGRAM_OWNER_ID)
  if (!docUser || !Number.isFinite(ownerId) || !DATABASE_URL || !env.TELEGRAM_BOT_TOKEN) {
    console.error('Напоминалка: не заданы переменные окружения')
    res.status(500).json({ error: 'Не настроено' })
    return
  }

  const stateUser = docUser + ':remind'

  try {
    const pg = db()
    const rows = (
      await pg.query<{ user_id: string; doc: unknown; version: number }>(
        'select user_id, doc, version from docs where user_id = any($1)',
        [[docUser, stateUser]],
      )
    ).rows

    const mainRow = rows.find((r) => r.user_id === docUser)
    if (!mainRow?.doc) {
      res.status(200).json({ ok: true, note: 'нет документа' })
      return
    }

    const stateRow = rows.find((r) => r.user_id === stateUser)
    const stateDoc = (stateRow?.doc ?? {}) as { sent?: unknown }
    const sent = Array.isArray(stateDoc.sent) ? stateDoc.sent.filter((k): k is string => typeof k === 'string') : []

    const raw = mainRow.doc as { acts?: unknown; entries?: unknown }
    const view: RemindDoc = {
      acts: Array.isArray(raw.acts) ? (raw.acts as RemindDoc['acts']) : [],
      entries: Array.isArray(raw.entries) ? (raw.entries as RemindDoc['entries']) : [],
    }

    const now = tashkentNow(Date.now())
    const plan = remindPlan(view, now, new Set(sent))
    if (!plan) {
      res.status(200).json({ ok: true, sent: null })
      return
    }

    // Ключ застолблён раньше отправки: требование «не слать дважды» важнее,
    // чем «не потерять слот», если Telegram не ответит следующим шагом.
    let staked = false
    let incoming = stateRow?.version ?? 0
    // На конфликте перечитанный список — новая база для следующей попытки, а
    // не исходный sent: иначе повторная запись стирала бы ключ, который в эту
    // же секунду застолбил параллельный прогон с другим слотом, и его
    // напоминание могло бы уйти второй раз на следующем тике.
    let base = sent
    for (let attempt = 0; attempt < 3; attempt++) {
      const nextSent = pruneSentKeys([...base, plan.key], now.dayKey)
      const upsert = await pg.query<{ version: number }>(
        `insert into docs (user_id, doc, version, updated_at)
         values ($1, $2::jsonb, 1, now())
         on conflict (user_id) do update
           set doc = excluded.doc, version = docs.version + 1, updated_at = now()
           where docs.version = $3
         returning version`,
        [stateUser, JSON.stringify({ sent: nextSent }), incoming],
      )
      if (upsert.rows.length > 0) {
        staked = true
        break
      }
      // версия уехала — перечитываем; если ключ уже там, значит параллельный
      // прогон успел раньше нас, и слать второе сообщение не нужно
      const fresh = await pg.query<{ doc: { sent?: unknown }; version: number }>(
        'select doc, version from docs where user_id = $1',
        [stateUser],
      )
      const freshSent = Array.isArray(fresh.rows[0]?.doc?.sent)
        ? (fresh.rows[0]!.doc.sent as unknown[]).filter((k): k is string => typeof k === 'string')
        : []
      if (freshSent.includes(plan.key)) {
        res.status(200).json({ ok: true, note: 'уже отправлено' })
        return
      }
      base = freshSent
      incoming = fresh.rows[0]?.version ?? 0
    }

    if (!staked) {
      console.error('Напоминалка: не удалось застолбить ключ', plan.key)
      res.status(500).json({ error: 'Не удалось записать' })
      return
    }

    const ok = await sendMessage(ownerId, plan.text)
    if (!ok) {
      console.error('Напоминалка: Telegram не ответил', plan.key)
      res.status(500).json({ error: 'Telegram не ответил' })
      return
    }

    res.status(200).json({ ok: true, sent: plan.key })
  } catch (e) {
    console.error('Напоминалка: ошибка обработки:', e)
    res.status(500).json({ error: 'Сбой сервера' })
  }
}
