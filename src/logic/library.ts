import { DAY_MS } from '../constants'
import { startOfDay } from './time'
import type { Book, Course, Show } from '../types'

/**
 * Разбор позиции в аудиокниге. Принимает и «3:15» (часы:минуты), и просто число
 * минут — как удобнее в момент ввода.
 */
export function parseAudio(input: string): number {
  const t = String(input).trim()
  if (!t) return 0
  if (t.includes(':')) {
    const [h, m] = t.split(':')
    return Math.max(0, (parseInt(h ?? '', 10) || 0) * 60 + (parseInt(m ?? '', 10) || 0))
  }
  const v = parseFloat(t.replace(',', '.'))
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
}

/** Минуты обратно в «3:15» */
export function fmtAudio(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0')
}

/**
 * Прогресс книги.
 *
 * Читаешь и слушаешь одно и то же произведение, поэтому берётся та позиция,
 * что дальше, а не сумма: страница 142 и минута 195 — это две отметки одного
 * пути, и настоящая та, которая ушла вперёд.
 */
export function bookProgress(b: Book): number {
  const byPage = b.pageTotal > 0 ? b.pageCur / b.pageTotal : 0
  const byAudio = b.audioTotal > 0 ? b.audioCur / b.audioTotal : 0
  return Math.max(0, Math.min(100, Math.round(Math.max(byPage, byAudio) * 100)))
}

export function courseProgress(c: Course): number {
  if (!c.sections.length) return 0
  return Math.round((c.sections.filter((s) => s.done).length / c.sections.length) * 100)
}

export type ReadingPlan =
  /** срок не задан или неизвестно общее число страниц — считать нечего */
  | { kind: 'none' }
  | { kind: 'done' }
  /** срок прошёл, а книга не дочитана */
  | { kind: 'overdue'; pagesLeft: number; daysLate: number }
  | { kind: 'ok'; pagesLeft: number; daysLeft: number; perDay: number }

/**
 * План по прочтению: сколько страниц в день нужно, чтобы успеть к сроку.
 *
 * Считается от остатка и числа оставшихся дней, а не от прошлого темпа —
 * позиция в книге хранится одна, истории чтения нет, и выдумывать по ней темп
 * было бы враньём. Сегодняшний день считается оставшимся: дочитать «сегодня»
 * значит успеть к вечеру, а не то, что срок уже прошёл.
 */
export function readingPlan(b: Book, now: number = Date.now()): ReadingPlan {
  if (!b.targetDate || b.pageTotal <= 0) return { kind: 'none' }

  const pagesLeft = Math.max(0, b.pageTotal - b.pageCur)
  if (pagesLeft === 0) return { kind: 'done' }

  const target = new Date(b.targetDate + 'T00:00:00').getTime()
  if (!Number.isFinite(target)) return { kind: 'none' }

  const days = Math.round((target - startOfDay(now)) / DAY_MS)
  if (days < 0) return { kind: 'overdue', pagesLeft, daysLate: -days }

  const daysLeft = days + 1
  return { kind: 'ok', pagesLeft, daysLeft, perDay: Math.ceil(pagesLeft / daysLeft) }
}

export interface ShowShelves {
  /** приоритет 10 — «в первую очередь», отдельный отсек над списком */
  top: Show[]
  /** остальные: приоритет по убыванию, внутри одинакового — свежее обновление выше */
  rest: Show[]
  /** «не хочу смотреть» — нижняя полка, в top/rest не попадают */
  dropped: Show[]
}

/**
 * Что показывать в списке «Смотреть»: по категории, по названию, и по желанию
 * смотреть. Приоритет 10 уезжает в отсек «в первую очередь»; у остальных
 * приоритет сортирует сверху вниз, а при равном — свежее обновление выше:
 * отметка позиции обновляет `updatedAt`, и «досмотрел вчера серию» поднимает
 * запись — так проще найти то, чем занят сейчас, среди давно заброшенного.
 */
export function visibleShows(shows: Show[], query: string, kind: string | null): ShowShelves {
  const q = query.trim().toLowerCase()
  const matches = shows
    .filter((s) => kind === null || s.kind === kind)
    .filter((s) => !q || s.title.toLowerCase().includes(q))

  const byFreshness = (a: Show, b: Show) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)

  const alive = matches.filter((s) => !s.dropped)
  return {
    top: alive.filter((s) => s.priority === 10).sort(byFreshness),
    rest: alive
      .filter((s) => s.priority < 10)
      .sort((a, b) => b.priority - a.priority || byFreshness(a, b)),
    dropped: matches.filter((s) => s.dropped).sort(byFreshness),
  }
}

/** Категория самой свежей записи — с неё открывается вкладка «Смотреть» */
export function lastUpdatedKind(shows: Show[]): string | null {
  let best: Show | null = null
  for (const s of shows) {
    if (s.dropped) continue
    if (!best || s.updatedAt > best.updatedAt) best = s
  }
  return best ? best.kind : null
}
