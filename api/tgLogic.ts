/**
 * Чистая логика телеграм-бота: что сделать с сообщением из группы.
 *
 * Правило одно и не требует настройки: ссылка на YouTube уходит в очередь
 * видео, всё остальное становится идеей, а названием категории служит имя
 * группы — группы-«избранное» и есть категории. Книги и покупки потом
 * переносятся из идей существующими кнопками «В книги» и «В расходы».
 *
 * Файл самодостаточен: серверные функции Vercel собираются отдельно от
 * приложения, поэтому несколько констант продублированы из src/constants —
 * с теми же значениями, о расхождении скажет тест.
 */

export const TG_MAX_VIDEOS = 40
export const TG_MAX_IDEAS = 100
export const TG_MAX_IDEA_TITLE = 80
export const TG_MAX_IDEA_CATEGORY = 24
export const TG_MAX_IDEA_TEXT = 4000
export const TG_MAX_VIDEO_NOTE = 200

export const TG_PAL = [
  '#22d3ee',
  '#34d399',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#60a5fa',
  '#2dd4bf',
  '#fb923c',
  '#f87171',
  '#e2e8f0',
]

/** Знаки, прилипшие к концу адреса: «смотри https://x.ru, потом» */
const TRAILING = /[.,;:!?)\]»"'’]+$/

export function extractUrls(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    const trail = TRAILING.exec(m[0])
    const url = trail ? m[0].slice(0, m[0].length - trail[0].length) : m[0]
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') out.push(url)
    } catch {
      /* обрезанный хвост сделал адрес битым — пропускаем */
    }
  }
  return out
}

export function isYoutubeUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^(www|m)\./, '')
    return host === 'youtube.com' || host === 'youtu.be'
  } catch {
    return false
  }
}

export type TgAction =
  | { kind: 'video'; url: string; note: string }
  | { kind: 'idea'; title: string; text: string; links: string[]; category: string }
  | { kind: 'skip'; reason: string }

/**
 * Классификация сообщения. Категория идеи — название группы: длиннее предела
 * обрезается так же, как это сделал бы normalize на клиенте.
 */
export function classify(rawText: string, chatTitle: string): TgAction {
  const text = rawText.trim()
  if (!text) return { kind: 'skip', reason: 'Пока переношу только текст и ссылки — фото добавь в приложении' }

  const urls = extractUrls(text)
  const yt = urls.find(isYoutubeUrl)

  if (yt) {
    // остальной текст сообщения — личная пометка «зачем сохранил»
    const note = text.replace(yt, '').trim().slice(0, TG_MAX_VIDEO_NOTE)
    return { kind: 'video', url: yt, note }
  }

  // первая строка — заголовок идеи, остальное — текст
  const lines = text.split('\n')
  const title = (lines[0] ?? '').trim().slice(0, TG_MAX_IDEA_TITLE) || 'Из Телеграма'
  const rest = lines.slice(1).join('\n').trim().slice(0, TG_MAX_IDEA_TEXT)
  const category = (chatTitle || 'Телеграм').trim().slice(0, TG_MAX_IDEA_CATEGORY) || 'Телеграм'
  return { kind: 'idea', title, text: rest, links: urls, category }
}

/** Домен вместо адреса — подпись ссылки в идее */
export function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Форма документа, которой бот касается; остальные поля проезжают как есть */
export interface TgDoc {
  ideas: {
    id: string
    title: string
    category: string
    text: string
    links: { id: string; url: string; label: string }[]
    images: string[]
    checklist: { id: string; text: string; done: boolean }[]
    done: boolean
    createdAt: string
  }[]
  lib: {
    videos: {
      id: string
      url: string
      title: string
      channel: string
      thumbnail: string
      color: string
      note: string
      addedAt: string
    }[]
    books: { color: string }[]
    courses: { color: string }[]
    shows: { color: string }[]
  }
}

export interface TgApplyResult {
  changed: boolean
  reply: string
}

function freeColor(doc: TgDoc): string {
  const used = new Set(
    [...doc.lib.books, ...doc.lib.courses, ...doc.lib.videos, ...doc.lib.shows].map((x) => x.color),
  )
  return TG_PAL.find((c) => !used.has(c)) ?? TG_PAL[2]!
}

/** Мутация документа по действию; reply уходит ответом в группу */
export function applyAction(
  doc: TgDoc,
  action: TgAction,
  meta: { id: string; nowIso: string; title?: string; channel?: string; thumbnail?: string },
): TgApplyResult {
  if (action.kind === 'skip') return { changed: false, reply: action.reason }

  if (action.kind === 'video') {
    if (doc.lib.videos.some((v) => v.url === action.url)) {
      return { changed: false, reply: 'Уже в очереди видео — не дублирую' }
    }
    if (doc.lib.videos.length >= TG_MAX_VIDEOS) {
      return { changed: false, reply: 'Очередь видео переполнена — посмотри или убери лишние в приложении' }
    }
    doc.lib.videos.push({
      id: 'v' + meta.id,
      url: action.url,
      title: (meta.title ?? '').slice(0, 80) || action.url,
      channel: (meta.channel ?? '').slice(0, 60),
      thumbnail: meta.thumbnail ?? '',
      color: freeColor(doc),
      note: action.note,
      addedAt: meta.nowIso,
    })
    return { changed: true, reply: `▶️ В очередь видео: «${(meta.title ?? action.url).slice(0, 60)}»` }
  }

  if (doc.ideas.some((i) => i.title === action.title && i.text === action.text)) {
    return { changed: false, reply: 'Такая идея уже есть — не дублирую' }
  }
  if (doc.ideas.length >= TG_MAX_IDEAS) {
    return { changed: false, reply: 'Идей уже слишком много — убери лишние в приложении' }
  }
  doc.ideas.push({
    id: 'i' + meta.id,
    title: action.title,
    category: action.category,
    text: action.text,
    links: action.links.map((url, n) => ({ id: 'il' + meta.id + n, url, label: domainLabel(url) })),
    images: [],
    checklist: [],
    done: false,
    createdAt: meta.nowIso,
  })
  return { changed: true, reply: `💡 В идеи: «${action.title}» (категория «${action.category}»)` }
}
