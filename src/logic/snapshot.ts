import { MAX_SNAPSHOT_DAYS } from '../constants'
import { pct } from './pct'
import { localDateKey } from './time'
import type { Sector, Snapshots } from '../types'

/**
 * Снимок состояния колеса за сегодня. Пишется при каждом изменении документа,
 * поэтому за день накапливается ровно один ключ — с последними значениями.
 * Хранится 180 дней, лишние (самые старые) удаляются.
 */
export function withTodaySnapshot(
  snapshots: Snapshots,
  sectors: Sector[],
  now: number,
): Snapshots {
  const next: Snapshots = { ...snapshots }
  next[localDateKey(now)] = {
    d: new Date(now).toISOString(),
    sectors: sectors.map((s) => ({ id: s.id, name: s.name, color: s.color, p: pct(s) })),
  }

  const keys = Object.keys(next).sort()
  while (keys.length > MAX_SNAPSHOT_DAYS) {
    const oldest = keys.shift()
    if (oldest) delete next[oldest]
  }
  return next
}
