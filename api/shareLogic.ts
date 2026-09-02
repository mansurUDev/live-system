/**
 * Чистая логика «Поделиться»: куда попадёт ссылка, присланная с телефона.
 *
 * Отличается от логики бота осознанно: там всё, что не YouTube, становится
 * идеей, а здесь ссылка с кинопоиска или аниме-сайта уезжает в «Смотреть» —
 * человек делится ею именно затем, чтобы посмотреть. Поведение бота при этом
 * не меняется: у него свой classify, и трогать его ради этого незачем.
 *
 * Файл самодостаточен (как и tgLogic): серверные функции Vercel собираются
 * отдельно, поэтому константы продублированы из src/constants — за
 * расхождением следит тест.
 */

export const SHARE_MAX_SHOWS = 50
export const SHARE_MAX_TITLE = 80
export const SHARE_MAX_URL = 500

export type ShareKind = 'video' | 'show' | 'idea'
export type ShareHint = 'auto' | ShareKind

export interface ShareTarget {
  kind: ShareKind
  /** для «Смотреть»: категория, угаданная по домену */
  showKind?: string
}

/** Хост без www./m. и в нижнем регистре; пустая строка, если адрес битый */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^(www|m)\./, '')
  } catch {
    return ''
  }
}

function pathOf(raw: string): string {
  try {
    return new URL(raw).pathname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Куда положить ссылку.
 *
 * Явный выбор человека сильнее догадки: он мог поделиться трейлером с YouTube
 * именно затем, чтобы запомнить сам фильм.
 */
export function classifyShare(url: string, hint: ShareHint = 'auto'): ShareTarget {
  if (hint === 'video' || hint === 'idea') return { kind: hint }

  const host = hostOf(url)
  const isYoutube = host === 'youtube.com' || host === 'youtu.be'
  if (hint === 'show') return { kind: 'show', showKind: showKindFor(host, url) }
  if (isYoutube) return { kind: 'video' }
  if (isWatchHost(host)) return { kind: 'show', showKind: showKindFor(host, url) }
  return { kind: 'idea' }
}

function isWatchHost(host: string): boolean {
  return (
    host.endsWith('kinopoisk.ru') ||
    host.endsWith('imdb.com') ||
    host.endsWith('myanimelist.net') ||
    host.endsWith('shikimori.one') ||
    host.includes('animego') ||
    host.includes('doram')
  )
}

/** Категория «Смотреть» по домену: аниме-сайт знает про себя больше, чем человек напишет руками */
function showKindFor(host: string, url: string): string {
  if (host.endsWith('myanimelist.net') || host.endsWith('shikimori.one') || host.includes('animego')) return 'anime'
  if (host.includes('doram')) return 'dorama'
  if (host.endsWith('kinopoisk.ru')) return pathOf(url).includes('/series/') ? 'series' : 'film'
  return 'film'
}

/** Параметры-следилки, по которым репост выдаёт, кто им поделился */
const DROP_PARAMS = ['fbclid', 'gclid', 'igsh', 'si', 'ref', 'ref_src']
const YT_KEEP = ['v', 't', 'list', 'index']

/**
 * Чистка адреса — порт cleanShareUrl из приложения: у YouTube оставляем только
 * осмысленные параметры, у Instagram режем весь хвост, остальным вычищаем
 * следилки. Важно и для поиска дублей: `?si=…` делал бы одну ссылку двумя.
 */
export function cleanLink(raw: string): string {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return raw
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '')

  if (host === 'instagram.com' || host === 'instagr.am') return u.origin + u.pathname

  if (host === 'youtube.com' || host === 'youtu.be') {
    const keep = new URLSearchParams()
    for (const k of YT_KEEP) {
      const v = u.searchParams.get(k)
      if (v) keep.set(k, v)
    }
    const q = keep.toString()
    return u.origin + u.pathname + (q ? '?' + q : '')
  }

  for (const k of [...u.searchParams.keys()]) {
    if (DROP_PARAMS.includes(k) || k.startsWith('utm_')) u.searchParams.delete(k)
  }
  const q = u.searchParams.toString()
  return u.origin + u.pathname + (q ? '?' + q : '') + u.hash
}

/** Название по умолчанию, когда его неоткуда взять: хост читается лучше адреса целиком */
export function fallbackTitle(url: string): string {
  return hostOf(url) || url
}

/** Форма документа, которой касается «Поделиться» */
export interface ShareDoc {
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
    shows: {
      id: string
      title: string
      kind: string
      color: string
      season: number
      episode: number
      minute: number
      link: string
      rating: number
      priority: number
      startedAt: string
      updatedAt: string
    }[]
    books: { color: string }[]
    courses: { color: string }[]
  }
}

export interface ShareResult {
  changed: boolean
  kind: ShareKind
  /** готовый ответ — его показывает Быстрая команда уведомлением */
  message: string
}

const SHARE_PAL = [
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

function freeColor(doc: ShareDoc): string {
  const used = new Set(
    [...doc.lib.books, ...doc.lib.courses, ...doc.lib.videos, ...doc.lib.shows].map((x) => x.color),
  )
  return SHARE_PAL.find((c) => !used.has(c)) ?? SHARE_PAL[2]!
}

/**
 * Положить ссылку в документ. Записи собираются ровно в той форме, которую
 * ожидает normalize приложения: сервер документ не нормализует, и лишнее или
 * недостающее поле всплыло бы уже на устройстве.
 */
export function applyShare(
  doc: ShareDoc,
  target: ShareTarget,
  input: { url: string; title: string; note: string },
  meta: { id: string; nowIso: string; channel?: string; thumbnail?: string },
): ShareResult {
  const link = cleanLink(input.url)
  const title = (input.title || fallbackTitle(link)).slice(0, SHARE_MAX_TITLE)

  if (target.kind === 'video') {
    if (doc.lib.videos.some((v) => v.url === link)) {
      return { changed: false, kind: 'video', message: 'Уже в очереди видео' }
    }
    if (doc.lib.videos.length >= TG_LIMIT_VIDEOS) {
      return { changed: false, kind: 'video', message: 'Очередь видео переполнена' }
    }
    doc.lib.videos.push({
      id: 'v' + meta.id,
      url: link,
      title,
      channel: (meta.channel ?? '').slice(0, 60),
      thumbnail: meta.thumbnail ?? '',
      color: freeColor(doc),
      note: input.note.slice(0, 200),
      addedAt: meta.nowIso,
    })
    return { changed: true, kind: 'video', message: `▶️ В очередь видео: «${title}»` }
  }

  if (target.kind === 'show') {
    if (doc.lib.shows.some((s) => s.link && cleanLink(s.link) === link)) {
      return { changed: false, kind: 'show', message: 'Уже в очереди «Смотреть»' }
    }
    if (doc.lib.shows.length >= SHARE_MAX_SHOWS) {
      return { changed: false, kind: 'show', message: 'Очередь «Смотреть» переполнена' }
    }
    doc.lib.shows.push({
      id: 'sh' + meta.id,
      title,
      kind: target.showKind ?? 'film',
      color: freeColor(doc),
      season: 0,
      episode: 0,
      minute: 0,
      link,
      rating: 0,
      priority: 0,
      startedAt: meta.nowIso,
      updatedAt: meta.nowIso,
    })
    return { changed: true, kind: 'show', message: `🍿 В «Смотреть»: «${title}»` }
  }

  if (doc.ideas.some((i) => i.links.some((l) => cleanLink(l.url) === link))) {
    return { changed: false, kind: 'idea', message: 'Такая ссылка уже есть в идеях' }
  }
  if (doc.ideas.length >= TG_LIMIT_IDEAS) {
    return { changed: false, kind: 'idea', message: 'Идей уже слишком много' }
  }
  doc.ideas.push({
    id: 'i' + meta.id,
    title,
    category: 'Разное',
    text: input.note.slice(0, 4000),
    links: [{ id: 'il' + meta.id, url: link, label: fallbackTitle(link) }],
    images: [],
    checklist: [],
    done: false,
    createdAt: meta.nowIso,
  })
  return { changed: true, kind: 'idea', message: `💡 В идеи: «${title}»` }
}

const TG_LIMIT_VIDEOS = 40
const TG_LIMIT_IDEAS = 100
