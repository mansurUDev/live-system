import { num, plural } from './time'
import type { Sector } from '../types'

/**
 * Процент выполнения сектора.
 *
 * Результат ВСЕГДА конечное число 0..100 при любом входе: он идёт в радиус дуги
 * SVG, и одна NaN там ломает весь path колеса.
 */
export function pct(s: Sector): number {
  let raw = 0
  if (s.kind === 'sphere') {
    raw = clamp(Math.round(Number(s.value) || 0), 1, 10) * 10
  } else if (s.kind === 'number') {
    const target = Number(s.target) || 0
    const current = Number(s.current) || 0
    raw = target > 0 ? Math.round((current / target) * 100) : 0
  } else {
    const steps = s.steps || []
    raw = steps.length ? Math.round((steps.filter((t) => t.done).length / steps.length) * 100) : 0
  }
  return Number.isFinite(raw) ? clamp(raw, 0, 100) : 0
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Средний процент по колесу; null при пустом колесе (не NaN) */
export function avgPct(sectors: Sector[]): number | null {
  if (!sectors.length) return null
  return Math.round(sectors.reduce((a, s) => a + pct(s), 0) / sectors.length)
}

/** Краткий итог сектора — для архива и поздравления */
export function summary(s: Sector): string {
  if (s.kind === 'number') return num(s.target) + (s.unit ? ' ' + s.unit : '')
  if (s.kind === 'steps') {
    const n = (s.steps || []).length
    return n + ' ' + plural(n, 'этап', 'этапа', 'этапов')
  }
  return 'оценка ' + s.value + '/10'
}

export function kindLabel(kind: Sector['kind']): string {
  if (kind === 'number') return 'накопление'
  if (kind === 'steps') return 'этапы'
  return 'сфера'
}

export function typeLabel(kind: Sector['kind']): string {
  if (kind === 'sphere') return 'Сфера · удовлетворённость'
  if (kind === 'number') return 'Цель · числовая'
  return 'Цель · по этапам'
}
