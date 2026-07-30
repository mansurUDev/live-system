import { DAY_MS } from '../constants'
import { dayKeyAgo, localDateKey, startOfDay } from './time'
import type { Habit } from '../types'

export function isDoneToday(h: Habit, now: number = Date.now()): boolean {
  return h.done.includes(localDateKey(now))
}

/**
 * Серия «сделано подряд» в днях.
 *
 * Отсчёт идёт назад от сегодня; если сегодня ещё не отмечено — от вчера, чтобы
 * серия не выглядела разорванной в первой половине дня. Пропущенный день серию
 * обрывает.
 */
export function streak(h: Habit, now: number = Date.now()): number {
  const done = new Set(h.done)
  let i = done.has(dayKeyAgo(0, now)) ? 0 : 1
  let s = 0
  while (done.has(dayKeyAgo(i, now))) {
    s++
    i++
  }
  return s
}

/** Лучшая серия: сохранённый рекорд либо текущая, если она его уже побила */
export function bestStreak(h: Habit, now: number = Date.now()): number {
  return Math.max(h.record, streak(h, now))
}

/** Дней без срыва — растёт само от момента последнего срыва */
export function daysWithout(h: Habit, now: number = Date.now()): number {
  const start = new Date(h.start).getTime()
  if (!Number.isFinite(start)) return 0
  // считаем по календарным дням, а не по часам: «первый день» начинается сразу
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(start)) / DAY_MS))
}

/** Лучшая серия воздержания */
export function bestWithout(h: Habit, now: number = Date.now()): number {
  return Math.max(h.best, daysWithout(h, now))
}

/** Лента последних n дней: true — отмечено */
export function recentDays(h: Habit, n: number, now: number = Date.now()): boolean[] {
  const done = new Set(h.done)
  const out: boolean[] = []
  for (let i = n - 1; i >= 0; i--) out.push(done.has(dayKeyAgo(i, now)))
  return out
}

/** Отметить/снять отметку за сегодня; рекорд подтягивается автоматически */
export function toggleToday(h: Habit, now: number = Date.now()): Habit {
  const key = localDateKey(now)
  const done = h.done.includes(key) ? h.done.filter((k) => k !== key) : [...h.done, key].sort()
  const next: Habit = { ...h, done }
  return { ...next, record: Math.max(next.record, streak(next, now)) }
}

/** Срыв: серия обнуляется, но рекорд остаётся как ориентир */
export function resetQuit(h: Habit, now: number = Date.now()): Habit {
  return {
    ...h,
    best: bestWithout(h, now),
    start: new Date(now).toISOString(),
  }
}
