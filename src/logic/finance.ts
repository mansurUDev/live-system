import { DAY_MS } from '../constants'
import { localDateKey, monthKeyOf, startOfDay } from './time'
import type { Finance, OneTimeExpense } from '../types'

/** Если период по дате следующего поступления не задан — считаем на месяц вперёд */
const FALLBACK_DAYS = 30

export interface FinanceCalc {
  /** дней до следующего поступления */
  days: number
  /** дата поступления задана и лежит в будущем */
  dateOk: boolean
  /** сумма обязательных расходов месяца */
  mandatory: number
  /** сумма ВСЕХ предстоящих разовых расходов — для отображения списком */
  upcomingTotal: number
  /** сумма тех из них, что реально вычтены из сегодняшнего лимита */
  reservedTotal: number
  /** момент, раньше которого разовый расход резервируется из текущих денег */
  reserveCutoff: number
  upcoming: OneTimeExpense[]
  past: OneTimeExpense[]
  /** свободные деньги после вычета обязательств и подушки */
  free: number
  /** сколько можно тратить в день */
  limit: number
  /** при текущем лимите денег хватит до этой даты */
  lastDay: number
  nearest: OneTimeExpense | null
  /** дней до ближайшего запланированного расхода */
  nearestDays: number | null
}

/**
 * Дневной лимит трат.
 *
 * Считается не по учёту каждой покупки, а от суммы на руках: обязательные
 * расходы месяца, предстоящие разовые и неприкосновенный запас вычитаются, а
 * остаток делится на дни до следующего поступления. Достаточно изредка сверять
 * баланс — перерасход сам опустит планку на следующий день.
 */
export function financeCalc(fin: Finance, now: number = Date.now()): FinanceCalc {
  const today = startOfDay(now)
  const todayKey = localDateKey(now)

  let days = FALLBACK_DAYS
  let dateOk = false
  if (fin.nextIncome) {
    const t = new Date(fin.nextIncome + 'T00:00:00').getTime()
    if (Number.isFinite(t) && t > today) {
      days = Math.max(1, Math.round((t - today) / DAY_MS))
      dateOk = true
    }
  }

  const reserveCutoff = today + days * DAY_MS
  const mandatory = fin.mandatory.reduce((a, x) => a + x.amount, 0)

  const upcoming = fin.oneTime
    .filter((o) => o.date && o.date >= todayKey)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const past = fin.oneTime
    .filter((o) => !o.date || o.date < todayKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const upcomingTotal = upcoming.reduce((a, x) => a + x.amount, 0)

  // Из сегодняшних денег резервируем только то, что нужно закрыть до следующего
  // поступления — более поздний расход покроет будущая зарплата, а не текущий
  // остаток. Без этого разбиения далёкий крупный платёж (день рождения через
  // полгода) обнулял бы дневной лимит на месяцы вперёд.
  const reservedTotal = upcoming
    .filter((o) => new Date(o.date + 'T00:00:00').getTime() < reserveCutoff)
    .reduce((a, x) => a + x.amount, 0)

  const free = fin.onHand - mandatory - reservedTotal - fin.cushion
  const limit = Math.max(0, Math.floor(free / days))

  const spendable = Math.max(0, fin.onHand - fin.cushion)
  const daysLeft = limit > 0 ? Math.floor(spendable / limit) : 0

  const nearest = upcoming[0] ?? null
  const nearestDays = nearest
    ? Math.max(0, Math.round((new Date(nearest.date + 'T00:00:00').getTime() - today) / DAY_MS))
    : null

  return {
    days,
    dateOk,
    mandatory,
    upcomingTotal,
    reservedTotal,
    reserveCutoff,
    upcoming,
    past,
    free,
    limit,
    lastDay: today + daysLeft * DAY_MS,
    nearest,
    nearestDays,
  }
}

/**
 * Перевод планки дохода на новый месяц.
 *
 * Полученное за месяц обнуляется, а результат — дотянул или нет — уходит в
 * историю. Вызывается при загрузке: если приложение не открывали месяц, всё
 * равно закроется корректно.
 */
export function rollMonth(fin: Finance, now: number = Date.now()): Finance {
  const current = monthKeyOf(now)
  if (fin.monthKey === current) return fin

  const hist = { ...fin.hist }
  if (fin.monthKey) hist[fin.monthKey] = fin.goal > 0 && fin.got >= fin.goal
  return { ...fin, hist, got: 0, monthKey: current }
}

/** Выполнение планки дохода в текущем месяце, 0..1 */
export function goalProgress(fin: Finance): number {
  if (fin.goal <= 0) return 0
  return Math.max(0, Math.min(1, fin.got / fin.goal))
}

/** История планки за последние n месяцев, от старых к новым */
export function goalHistory(fin: Finance, n = 12, now: number = Date.now()): { key: string; ok: boolean | null }[] {
  const out: { key: string; ok: boolean | null }[] = []
  const d = new Date(now)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const key = monthKeyOf(m)
    out.push({ key, ok: key === fin.monthKey ? null : (fin.hist[key] ?? null) })
  }
  return out
}
