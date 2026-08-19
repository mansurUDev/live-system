import { DAY_MS } from '../constants'
import { convert, roundMoney } from './currency'
import { localDateKey, monthKeyOf, startOfDay } from './time'
import type { CurrencyCode, Finance, OneTimeExpense, Rates } from '../types'

/** Если период по дате следующего поступления не задан — считаем на месяц вперёд */
const FALLBACK_DAYS = 30

/**
 * Во что сводить расходы.
 *
 * У каждого расхода своя валюта — подписка в долларах, аренда в сумах, — а
 * лимит должен быть одним числом, поэтому суммы приводятся к валюте отображения
 * по вручную заданным курсам. Суммы «на руках», планка и запас уже хранятся в
 * ней, пересчитывать их не нужно.
 */
export interface Conv {
  currency: CurrencyCode
  rates: Rates
}

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
export function financeCalc(fin: Finance, conv: Conv, now: number = Date.now()): FinanceCalc {
  const today = startOfDay(now)
  const todayKey = localDateKey(now)
  // расход хранится в своей валюте, а складывать можно только приведённые
  const inDisplay = (x: { amount: number; currency: CurrencyCode }) =>
    convert(x.amount, x.currency, conv.currency, conv.rates)

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
  const mandatory = roundMoney(fin.mandatory.reduce((a, x) => a + inDisplay(x), 0))

  const upcoming = fin.oneTime
    .filter((o) => o.date && o.date >= todayKey)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const past = fin.oneTime
    .filter((o) => !o.date || o.date < todayKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const upcomingTotal = roundMoney(upcoming.reduce((a, x) => a + inDisplay(x), 0))

  // Из сегодняшних денег резервируем только то, что нужно закрыть до следующего
  // поступления — более поздний расход покроет будущая зарплата, а не текущий
  // остаток. Без этого разбиения далёкий крупный платёж (день рождения через
  // полгода) обнулял бы дневной лимит на месяцы вперёд.
  const reservedTotal = roundMoney(
    upcoming
      .filter((o) => new Date(o.date + 'T00:00:00').getTime() < reserveCutoff)
      .reduce((a, x) => a + inDisplay(x), 0),
  )

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
 * Ближайшее списание обязательного расхода: сегодня или дальше.
 *
 * Число месяца может не существовать в этом месяце — подписка «31-го» в феврале
 * списывается последним днём, так это и считаем, а не переносим на март.
 * Возвращается начало суток, чтобы «сегодня» везде значило ноль дней.
 */
export function nextChargeAt(day: number, now: number = Date.now()): number | null {
  if (!Number.isInteger(day) || day < 1 || day > 31) return null

  const today = startOfDay(now)
  const d = new Date(today)

  const inMonth = (year: number, month: number): number => {
    const last = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, last)).getTime()
  }

  const thisMonth = inMonth(d.getFullYear(), d.getMonth())
  if (thisMonth >= today) return thisMonth
  return inMonth(d.getFullYear(), d.getMonth() + 1)
}

/**
 * Заданы ли курсы там, где они нужны.
 *
 * Расход в чужой валюте при курсе один к одному складывается с остальными как
 * есть — итог выглядит правдоподобно и молча врёт. Это стоит показать: сам по
 * себе нулевой пересчёт ничем не отличается от «ещё не дошли руки».
 */
export function ratesMissing(fin: Finance, conv: Conv): boolean {
  // достаточно одной валюты без курса: остальные, пересчитанные верно, о ней
  // ничего не говорят, а её сумма всё равно ложится в итог как есть
  return [...fin.mandatory, ...fin.oneTime].some(
    (x) => x.currency !== conv.currency && conv.rates[x.currency] === conv.rates[conv.currency],
  )
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
