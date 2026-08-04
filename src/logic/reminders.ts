import { DAY_MS } from '../constants'
import { startOfDay } from './time'
import type { Reminder } from '../types'

/** Дней с последней отметки; ни разу не отмеченное считается от момента создания */
export function daysSince(r: Reminder, now: number = Date.now()): number {
  const from = r.lastDone ?? r.createdAt
  const t = new Date(from).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(t)) / DAY_MS))
}

/** Сколько дней просрочено; отрицательное — ещё не подошёл срок */
export function daysOverdue(r: Reminder, now: number = Date.now()): number {
  return daysSince(r, now) - r.intervalDays
}

export function isOverdue(r: Reminder, now: number = Date.now()): boolean {
  return daysOverdue(r, now) >= 0
}

export function markDone(r: Reminder, now: number = Date.now()): Reminder {
  return { ...r, lastDone: new Date(now).toISOString() }
}
