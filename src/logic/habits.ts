import { DAY_MS, MAX_SLIPS, MAX_SLIP_WHY, RISK_WARN_HOURS } from '../constants'
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

/**
 * Срыв: серия обнуляется, рекорд остаётся, а сам срыв уходит в журнал.
 * Чистый ноль после срыва читается как «начинаем с чистого листа» — журнал
 * не даёт забыть, что это уже который раз, и хранит причину.
 */
export function resetQuit(h: Habit, now: number = Date.now(), why: string = ''): Habit {
  return {
    ...h,
    best: bestWithout(h, now),
    start: new Date(now).toISOString(),
    slips: [...h.slips, { d: new Date(now).toISOString(), why: why.trim().slice(0, MAX_SLIP_WHY) }].slice(-MAX_SLIPS),
  }
}

/** Сколько срывов случилось за последние `days` дней (включая сегодняшние) */
export function slipsInDays(h: Habit, days: number, now: number = Date.now()): number {
  const from = startOfDay(now) - (days - 1) * DAY_MS
  return h.slips.filter((s) => {
    const t = new Date(s.d).getTime()
    return Number.isFinite(t) && t >= from
  }).length
}

/**
 * Часов до часа риска (0 — он уже настал в этом часе). Час риска — точка на
 * циферблате, поэтому расстояние всегда считается вперёд по кругу: в 23:30 до
 * riskHour 0 остаётся полчаса, а не минус 23 часа.
 */
export function hoursToRisk(riskHour: number, now: number = Date.now()): number {
  return (riskHour - new Date(now).getHours() + 24) % 24
}

/** Пора ли предупреждать: до часа риска осталось не больше RISK_WARN_HOURS */
export function riskSoon(h: Habit, now: number = Date.now()): boolean {
  if (h.riskHour === null) return false
  return hoursToRisk(h.riskHour, now) <= RISK_WARN_HOURS
}

/** Разбор «23:30» в минуты от полуночи; мусор — null, чтобы не записать нечаянный ноль */
export function parseClock(input: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!m) return null
  const hh = parseInt(m[1]!, 10)
  const mm = parseInt(m[2]!, 10)
  if (hh > 23 || mm > 59) return null
  return hh * 60 + mm
}

export function fmtClockMin(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0')
}

/**
 * Среднее время замера за последние `days` дней.
 *
 * Значения вокруг полуночи нельзя усреднять в лоб: 23:30 и 0:30 дали бы
 * полдень. Ранние часы (до 12:00) считаются «после полуночи» и сдвигаются на
 * сутки вперёд, среднее возвращается обратно на циферблат.
 */
export function avgLog(h: Habit, days: number, now: number = Date.now()): number | null {
  const vals: number[] = []
  for (let i = 0; i < days; i++) {
    const v = h.logs[dayKeyAgo(i, now)]
    if (typeof v === 'number' && Number.isFinite(v)) vals.push(v < 720 ? v + 1440 : v)
  }
  if (!vals.length) return null
  return (Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) + 1440) % 1440
}

/** Значения замера за последние n дней, от старых к сегодняшнему; null — нет отметки */
export function recentLogs(h: Habit, n: number, now: number = Date.now()): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = n - 1; i >= 0; i--) {
    const v = h.logs[dayKeyAgo(i, now)]
    out.push(typeof v === 'number' && Number.isFinite(v) ? v : null)
  }
  return out
}
