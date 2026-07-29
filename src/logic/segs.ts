import { nextDayStart } from './time'
import type { Seg, TimeEntry } from '../types'

/**
 * Записи, обрезанные по окну [from, to).
 *
 * У идущей записи правая граница — текущий момент (в отличие от проверки
 * пересечений, где она бесконечна). Записи с началом в будущем дают нулевую
 * длину и отсекаются.
 */
export function segs(entries: TimeEntry[], from: number, to: number, now: number): Seg[] {
  const out: Seg[] = []
  for (const e of entries) {
    const s = new Date(e.start).getTime()
    if (!Number.isFinite(s)) continue
    const raw = e.end ? new Date(e.end).getTime() : now
    const en = Number.isFinite(raw) ? Math.max(s, raw) : s
    const a = Math.max(s, from)
    const b = Math.min(en, to)
    if (b > a) out.push({ actId: e.actId, s: a, e: b })
  }
  return out
}

/**
 * Разбивка отрезка по календарным суткам — для столбцов по дням недели.
 * Границы берутся через календарный сдвиг, поэтому переход на летнее время
 * не сдвигает сутки.
 */
export function splitByDay(seg: Seg): Seg[] {
  const out: Seg[] = []
  let s = seg.s
  while (s < seg.e) {
    const dayEnd = nextDayStart(s)
    const chunk = Math.min(seg.e, dayEnd)
    if (chunk <= s) break
    out.push({ actId: seg.actId, s, e: chunk })
    s = chunk
  }
  return out
}

export function totalMs(list: Seg[]): number {
  return list.reduce((a, g) => a + (g.e - g.s), 0)
}

/** Идущая запись — та, у которой не проставлен конец */
export function runningEntry(entries: TimeEntry[]): TimeEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e && !e.end) return e
  }
  return null
}
