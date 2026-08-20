import { CURRENCIES, CURRENCY_CODES } from '../constants'
import { num } from './time'
import type { CurrencyCode, Rates } from '../types'

/** Символы-суффиксы читаются как часть числа лучше, чем разлучённые с ним префиксом */
const PREFIXED: CurrencyCode[] = ['USD', 'EUR']

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export function money(n: number, code: CurrencyCode): string {
  const digits = num(n)
  const sym = currencySymbol(code)
  return PREFIXED.includes(code) ? sym + digits : digits + ' ' + sym
}

/**
 * Сумма, пригодная для показа: крупные значения до целых, мелкие — до копеек.
 * 12 500 сум с шестью знаками после запятой читаются хуже, чем округлённые.
 */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100
}

/**
 * Пересчёт между валютами через внутреннюю базу: `rates[code]` — сколько единиц
 * базы стоит одна единица валюты. Курс, который не задан по-человечески (ноль,
 * отрицательный, битый), означает «пересчитать нечем» — сумма возвращается как
 * есть, а не превращается в ноль или бесконечность.
 */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode, rates: Rates): number {
  if (from === to) return amount
  const f = rates[from]
  const t = rates[to]
  if (!Number.isFinite(f) || !Number.isFinite(t) || f <= 0 || t <= 0) return amount
  return (amount * f) / t
}

/** Готовая строка «≈ 1 500 000 сум» — та же сумма в другой валюте */
export function approx(amount: number, from: CurrencyCode, to: CurrencyCode, rates: Rates): string {
  return '≈ ' + money(roundMoney(convert(amount, from, to, rates)), to)
}

/**
 * Крупная сумма словами: «2,3 млн», «76,7 тыс». Суммы в сумах часто идут на
 * миллионы — «2300000» с ходу не читается, сколько там нулей, приходится
 * считать по три с конца. Меньше десяти тысяч подпись не нужна: там разряд и
 * так виден сразу.
 */
export function humanMoney(n: number): string {
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs < 10_000) return ''
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '') + ' млн'
  return sign + (abs / 1_000).toFixed(1).replace('.', ',').replace(',0', '') + ' тыс'
}

/** Та же сумма во всех остальных валютах — подсказка под полем ввода */
export function inOtherCurrencies(amount: number, from: CurrencyCode, rates: Rates): string[] {
  return CURRENCY_CODES.filter((c) => c !== from).map((c) =>
    money(roundMoney(convert(amount, from, c, rates)), c),
  )
}
