import { DAY_MS } from '../constants'
import type { Period } from '../types'

function p2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Ключ дня в ЛОКАЛЬНОМ времени. Именно локальном: toISOString() отдаёт UTC,
 * и в зонах восточнее Гринвича ночные снимки уезжали бы во вчерашний день.
 */
export function localDateKey(t: number | Date): string {
  const d = t instanceof Date ? t : new Date(t)
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())
}

/** Ключ месяца YYYY-MM в локальном времени */
export function monthKeyOf(t: number | Date): string {
  const d = t instanceof Date ? t : new Date(t)
  return d.getFullYear() + '-' + p2(d.getMonth() + 1)
}

/** Ключ дня, отстоящего на n суток назад от указанного момента */
export function dayKeyAgo(n: number, now: number = Date.now()): string {
  return localDateKey(addDays(startOfDay(now), -n))
}

/** Полночь того же локального дня */
export function startOfDay(t: number | Date): number {
  const d = t instanceof Date ? new Date(t.getTime()) : new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Сдвиг на n календарных дней. Через setDate, а не прибавление 24 часов —
 * иначе в дни перевода стрелок граница суток уезжает на час.
 */
export function addDays(t: number | Date, n: number): number {
  const d = t instanceof Date ? new Date(t.getTime()) : new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** Начало следующего локального дня */
export function nextDayStart(t: number | Date): number {
  return addDays(startOfDay(t), 1)
}

/** Окно наблюдения для вкладки аналитики */
export function periodRange(period: Period, now: number): { from: number; to: number } {
  const today = startOfDay(now)
  if (period === 'day') return { from: today, to: now }
  if (period === 'week') return { from: addDays(today, -6), to: now }
  return { from: addDays(today, -29), to: now }
}

/** Пн → 0 … Вс → 6 */
export function weekdayIndex(t: number | Date): number {
  const d = t instanceof Date ? t : new Date(t)
  return (d.getDay() + 6) % 7
}

/** Момент, огрублённый до минуты — ключ мемоизации для тяжёлых расчётов */
export function minuteOf(now: number): number {
  return Math.floor(now / 60000)
}

export function hhmm(t: number | Date): string {
  const d = t instanceof Date ? t : new Date(t)
  return p2(d.getHours()) + ':' + p2(d.getMinutes())
}

/** «2 ч 15 м», «45 м», «3 ч» */
export function fmtDur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (!h) return mm + ' м'
  if (!mm) return h + ' ч'
  return h + ' ч ' + mm + ' м'
}

/**
 * Минуты на плитке активности: «0:45», «7:40»; при нуле — пусто.
 * Округление вниз: границы записей уже приплюснуты к минуте в normalize,
 * округлять вверх значило бы показывать минуту, которая ещё не прожита.
 */
export function fmtHm(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000)
  if (!m) return ''
  return Math.floor(m / 60) + ':' + p2(m % 60)
}

/** Живой таймер: «0:07:32» */
export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  return (
    Math.floor(t / 3600) + ':' + p2(Math.floor((t % 3600) / 60)) + ':' + p2(t % 60)
  )
}

/** Дата по-русски: «12 октября», с годом если он отличается от текущего */
export function fmtD(iso: string | number | Date, now?: number): string {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const currentYear = new Date(now ?? Date.now()).getFullYear()
  if (d.getFullYear() !== currentYear) opts.year = 'numeric'
  return d.toLocaleDateString('ru-RU', opts)
}

/** «12.03» — подпись оси графика */
export function fmtDayMonth(dayKey: string): string {
  return dayKey.slice(8, 10) + '.' + dayKey.slice(5, 7)
}

export function num(n: number): string {
  return (Number(n) || 0).toLocaleString('ru-RU')
}

/** Русское склонение: plural(5, 'день', 'дня', 'дней') */
export function plural(n: number, one: string, few: string, many: string): string {
  const m = Math.abs(n) % 100
  if (m >= 11 && m <= 14) return many
  const l = m % 10
  if (l === 1) return one
  if (l >= 2 && l <= 4) return few
  return many
}

export { DAY_MS }

/**
 * Сколько осталось до срока, словами.
 *
 * Дата сама по себе требует счёта в уме: «27 сентября» — это скоро или нет?
 * Ближние сроки называются днями, дальние — неделями и месяцами: точность в
 * днях за горизонтом пары недель всё равно ничего не решает.
 */
export function untilLabel(days: number): string {
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days === 2) return 'послезавтра'

  if (days < 0) {
    const late = -days
    return `просрочено на ${late} ${plural(late, 'день', 'дня', 'дней')}`
  }

  if (days < 14) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
  if (days < 60) {
    const weeks = Math.round(days / 7)
    return `через ${weeks} ${plural(weeks, 'неделю', 'недели', 'недель')}`
  }
  const months = Math.round(days / 30)
  return `через ${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`
}

/** Дней от сегодня до даты вида ГГГГ-ММ-ДД; null — даты нет или она битая */
export function daysUntil(dayKey: string, now: number = Date.now()): number | null {
  if (!dayKey) return null
  const t = new Date(dayKey + 'T00:00:00').getTime()
  if (!Number.isFinite(t)) return null
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY_MS)
}
