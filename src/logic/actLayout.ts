import { CAT_KEYS, HOT_MAX } from '../constants'
import type { Activity, Category } from '../types'

export interface Band {
  cat: Category
  acts: Activity[]
}

export interface ActLayout {
  hot: Activity[]
  bands: Band[]
}

/**
 * Закреплённые — в горячий ряд, остальные — в полосы своей категории.
 * Порядок везде — порядок массива doc.acts. Пустые полосы не выдаются.
 * Девятая закреплённая (документ мимо normalize) не пропадает, а падает
 * обратно в свою полосу — кнопка обязана остаться доступной.
 */
export function splitActs(acts: Activity[]): ActLayout {
  const hot: Activity[] = []
  const rest: Activity[] = []
  for (const a of acts) {
    if (a.pinned && hot.length < HOT_MAX) hot.push(a)
    else rest.push(a)
  }
  const bands: Band[] = []
  for (const cat of CAT_KEYS) {
    const list = rest.filter((a) => a.cat === cat)
    if (list.length) bands.push({ cat, acts: list })
  }
  return { hot, bands }
}

/** Можно ли закрепить ещё одну (id уже закреплённой — всегда можно снять) */
export function canPin(acts: Activity[], id: string): boolean {
  const a = acts.find((x) => x.id === id)
  if (!a) return false
  if (a.pinned) return true
  return acts.filter((x) => x.pinned).length < HOT_MAX
}

/** Слияние правок из ActModal: сохраняет служебные поля (pinned) */
export function mergeAct(prev: Activity | null, form: Omit<Activity, 'pinned'>): Activity {
  const next: Activity = { ...form }
  if (prev?.pinned) next.pinned = true
  return next
}

// Размеры дока — одни и те же числа для рендера и для распорки под ним.
export const DOCK = { padTop: 18, caption: 13, captionGap: 8, chip: 50, gap: 8, padBottom: 12 } as const

/** Высота нижнего дока горячего ряда на телефоне — 0, если закреплённых нет */
export function hotDockHeight(pinned: number): number {
  if (pinned <= 0) return 0
  const rows = Math.min(2, Math.ceil(Math.min(pinned, HOT_MAX) / 4))
  return (
    DOCK.padTop + DOCK.caption + DOCK.captionGap + rows * DOCK.chip + (rows - 1) * DOCK.gap + DOCK.padBottom
  )
}
