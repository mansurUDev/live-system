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

export type MoveTarget = { kind: 'hot' } | { kind: 'band'; cat: Category }

export type MoveResult =
  | { ok: true; acts: Activity[]; catChanged: Category | null; pin: 'pinned' | 'unpinned' | null }
  | { ok: false; reason: 'unknownId' | 'hotFull' }

/**
 * Перенос кнопки в горячий ряд / полосу на позицию index (правила DnD из
 * доки). Чистая функция — используется и превью-рендером во время
 * перетаскивания, и редьюсером на drop, поэтому превью всегда совпадает
 * с итогом.
 *
 * index считается среди членов ЦЕЛЕВОЙ зоны после переноса (без учёта
 * самой переносимой кнопки) — 0..members.length.
 */
export function moveActTo(acts: Activity[], id: string, target: MoveTarget, index: number): MoveResult {
  const from = acts.findIndex((a) => a.id === id)
  if (from === -1) return { ok: false, reason: 'unknownId' }

  const act = acts[from]!
  const remaining = acts.toSpliced(from, 1)

  if (target.kind === 'hot' && !act.pinned) {
    const pinnedCount = remaining.filter((a) => a.pinned).length
    if (pinnedCount >= HOT_MAX) return { ok: false, reason: 'hotFull' }
  }

  let patched: Activity
  let pin: 'pinned' | 'unpinned' | null
  let catChanged: Category | null
  if (target.kind === 'hot') {
    // ряд смешанный по категориям — cat переносимой кнопки не трогаем
    patched = { ...act, pinned: true }
    pin = act.pinned ? null : 'pinned'
    catChanged = null
  } else {
    patched = { ...act, cat: target.cat }
    delete patched.pinned // открепление — поле уходит совсем, как в toggleActPin
    pin = act.pinned ? 'unpinned' : null
    catChanged = act.cat !== target.cat ? target.cat : null
  }

  // членство в зоне — через splitActs, те же правила (включая переполнение),
  // не рукописный filter; splitActs отдаёт исходные ссылки, поэтому indexOf ниже валиден
  const layout = splitActs(remaining)
  const members = target.kind === 'hot' ? layout.hot : (layout.bands.find((b) => b.cat === target.cat)?.acts ?? [])

  let insertAt: number
  if (members.length === 0) {
    // пустая зона — детерминированно оставляем кнопку на её месте в массиве
    insertAt = from
  } else {
    const idx = Math.max(0, Math.min(index, members.length))
    insertAt = idx < members.length ? remaining.indexOf(members[idx]!) : remaining.indexOf(members[members.length - 1]!) + 1
  }

  if (pin === null && catChanged === null && insertAt === from) {
    return { ok: true, acts, catChanged: null, pin: null }
  }
  return { ok: true, acts: remaining.toSpliced(insertAt, 0, patched), catChanged, pin }
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
