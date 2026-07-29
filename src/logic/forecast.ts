import { DAY_MS, FORECAST_WINDOW_DAYS } from '../constants'
import { pct } from './pct'
import type { Sector } from '../types'

export type NumberForecast =
  | { kind: 'done' }
  /** нет ни одной числовой точки истории, по которой можно судить о темпе */
  | { kind: 'no-data' }
  /** прогресса за окно нет или он отрицательный — прогнозировать нечего */
  | { kind: 'negative' }
  | { kind: 'ok'; perDay: number; days: number; targetAt: number }

/**
 * Прогноз даты достижения числовой цели.
 *
 * Темп считается от точки истории на левой границе двухнедельного окна (или от
 * самой ранней, если все точки свежее) и делится на РЕАЛЬНОЕ число прошедших
 * дней — деление на фиксированные 14 завышало бы темп, когда опорная точка
 * сильно старше окна.
 */
export function numberForecast(s: Sector, now: number): NumberForecast {
  if (pct(s) >= 100) return { kind: 'done' }

  const points = (s.history || [])
    .filter((h) => typeof h.v === 'number' && Number.isFinite(h.v))
    .map((h) => ({ v: h.v as number, t: new Date(h.d).getTime() }))
    .filter((h) => Number.isFinite(h.t))
    .sort((a, b) => a.t - b.t)

  if (!points.length) return { kind: 'no-data' }

  const windowFrom = now - FORECAST_WINDOW_DAYS * DAY_MS
  let base = points[0]!
  for (const p of points) {
    if (p.t <= windowFrom) base = p
    else break
  }

  const delta = s.current - base.v
  if (delta <= 0) return { kind: 'negative' }

  const days = Math.max(1, (now - base.t) / DAY_MS)
  const rate = delta / days
  if (!Number.isFinite(rate) || rate <= 0) return { kind: 'negative' }

  const remaining = s.target - s.current
  const daysLeft = Math.max(1, Math.ceil(remaining / rate))
  if (!Number.isFinite(daysLeft)) return { kind: 'negative' }

  const perDay = rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10
  return { kind: 'ok', perDay, days: daysLeft, targetAt: now + daysLeft * DAY_MS }
}

export type StepsForecast =
  | { kind: 'done' }
  /** есть отметки за последние две недели — можно показать темп */
  | { kind: 'pace'; per14: number; remaining: number }
  | { kind: 'plain'; remaining: number }

/** Темп цели по этапам: сколько шагов закрыто за последние две недели */
export function stepsForecast(s: Sector, now: number): StepsForecast {
  const steps = s.steps || []
  const remaining = steps.length - steps.filter((t) => t.done).length
  if (remaining <= 0) return { kind: 'done' }

  const per14 = (s.history || []).filter((h) => {
    if (!h.label || h.label.charAt(0) !== '✓') return false
    const t = new Date(h.d).getTime()
    return Number.isFinite(t) && now - t < FORECAST_WINDOW_DAYS * DAY_MS
  }).length

  return per14 > 0 ? { kind: 'pace', per14, remaining } : { kind: 'plain', remaining }
}
