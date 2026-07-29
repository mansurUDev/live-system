import { CAT_KEYS, CATS, DELETED_ACT, OTHER } from '../constants'
import { splitByDay, totalMs } from './segs'
import { weekdayIndex } from './time'
import type { Activity, Category, Seg } from '../types'

/** Ключ категории в аналитике: настоящая категория либо «прочее» */
export type CatKey = Category | 'other'

export const ANALYTICS_CAT_KEYS: CatKey[] = [...CAT_KEYS, 'other']

export function catMeta(k: CatKey): { label: string; color: string } {
  return k === 'other' ? OTHER : CATS[k]
}

/** Активность по id; удалённая кнопка не роняет расчёт, а становится «прочим» */
export function actBy(acts: Activity[], id: string): Activity | null {
  return acts.find((a) => a.id === id) ?? null
}

export function actName(acts: Activity[], id: string): string {
  return actBy(acts, id)?.name ?? DELETED_ACT.name
}

export function actColor(acts: Activity[], id: string): string {
  return actBy(acts, id)?.color ?? DELETED_ACT.color
}

export function catOf(acts: Activity[], actId: string): CatKey {
  const a = actBy(acts, actId)
  if (!a) return 'other'
  return a.cat && CATS[a.cat] ? a.cat : 'other'
}

/** Сумма времени по каждой категории */
export function catTotals(list: Seg[], acts: Activity[]): Record<CatKey, number> {
  const out = {} as Record<CatKey, number>
  for (const k of ANALYTICS_CAT_KEYS) out[k] = 0
  for (const g of list) out[catOf(acts, g.actId)] += g.e - g.s
  return out
}

/** Время по одной категории за окно */
export function catMs(list: Seg[], acts: Activity[], cat: Category): number {
  let t = 0
  for (const g of list) if (catOf(acts, g.actId) === cat) t += g.e - g.s
  return t
}

/**
 * Неотслеженное время («дыры»). Клампится к нулю: импортированные данные могут
 * содержать пересекающиеся записи, и тогда сумма превысила бы длину окна.
 */
export function untrackedMs(list: Seg[], from: number, to: number): number {
  return Math.max(0, to - from - totalMs(list))
}

/** Суммы по дням недели, Пн первый */
export function weekdayTotals(list: Seg[]): number[] {
  const wk = [0, 0, 0, 0, 0, 0, 0]
  for (const g of list) {
    for (const chunk of splitByDay(g)) {
      wk[weekdayIndex(chunk.s)] += chunk.e - chunk.s
    }
  }
  return wk
}

export interface TopAct {
  actId: string
  ms: number
}

/** Топ активностей по суммарному времени */
export function topActs(list: Seg[], limit = 5): TopAct[] {
  const byAct = new Map<string, number>()
  for (const g of list) byAct.set(g.actId, (byAct.get(g.actId) ?? 0) + (g.e - g.s))
  return [...byAct.entries()]
    .map(([actId, ms]) => ({ actId, ms }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit)
}
