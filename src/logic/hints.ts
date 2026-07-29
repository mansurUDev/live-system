import { CATS, HINT_THRESHOLD_MS } from '../constants'
import { catMs } from './analytics'
import { totalMs } from './segs'
import type { Activity, Sector, Seg } from '../types'

export interface Hint {
  sectorId: string
  sectorName: string
  value: number
  catLabel: string
  ms: number
}

/**
 * Подсказки-несоответствия: сфера оценена высоко, а времени на связанную с ней
 * категорию почти не уходит.
 *
 * При полностью пустой неделе подсказок нет — отсутствие данных не то же самое,
 * что «мало времени на здоровье».
 */
export function buildHints(sectors: Sector[], weekSegs: Seg[], acts: Activity[]): Hint[] {
  if (totalMs(weekSegs) <= 0) return []

  const out: Hint[] = []
  for (const s of sectors) {
    if (s.kind !== 'sphere' || !s.cat || s.value < 7) continue
    const meta = CATS[s.cat]
    if (!meta) continue
    const ms = catMs(weekSegs, acts, s.cat)
    if (ms >= HINT_THRESHOLD_MS) continue
    out.push({
      sectorId: s.id,
      sectorName: s.name,
      value: s.value,
      catLabel: meta.label.toLowerCase(),
      ms,
    })
  }
  return out
}
