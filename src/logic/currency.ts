import { CURRENCIES } from '../constants'
import { num } from './time'
import type { CurrencyCode } from '../types'

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
