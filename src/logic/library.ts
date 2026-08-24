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

/**
 * Что показывать в списке «Смотреть»: по виду, по названию, свежее обновление
 * сверху. Отметка позиции обновляет `updatedAt`, поэтому «досмотрел вчера
 * серию» поднимает запись наверх — так проще найти то, чем занят сейчас, среди
 * давно заброшенного.
 */
export function visibleShows(shows: Show[], query: string, kind: Show['kind'] | null): Show[] {
  const q = query.trim().toLowerCase()
  return shows
    .filter((s) => kind === null || s.kind === kind)
    .filter((s) => !q || s.title.toLowerCase().includes(q))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}
