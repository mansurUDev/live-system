import type { Book, Course } from '../types'

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
