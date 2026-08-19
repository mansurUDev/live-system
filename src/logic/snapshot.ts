import { MAX_SNAPSHOT_DAYS } from '../constants'
import { pct } from './pct'
import { localDateKey } from './time'
import type { Sector, SnapshotSector, Snapshots } from '../types'

/** Совпадают ли сводки колеса — сравнение по значению, порядок секторов значим */
function sameSectors(a: SnapshotSector[], b: SnapshotSector[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!
      return x.id === y.id && x.name === y.name && x.color === y.color && x.p === y.p
    })
  )
}

/**
 * Снимок состояния колеса за сегодня. Пишется при каждом изменении документа,
 * поэтому за день накапливается ровно один ключ — с последними значениями.
 * Хранится 180 дней, лишние (самые старые) удаляются.
 *
 * Если сводка за сегодня не изменилась, возвращается прежний объект — иначе
 * штамп `d` обновлялся бы при каждом действии, и документ считался бы изменённым
 * даже когда на колесе ничего не двигали. Синхронизация на это опирается: пустая
 * правка уезжала бы в облако, поднимала версию и делала все остальные устройства
 * «отставшими» на ровном месте. Само поле `d` нигде не читается — только ключи.
 */
export function withTodaySnapshot(
  snapshots: Snapshots,
  sectors: Sector[],
  now: number,
): Snapshots {
  const key = localDateKey(now)
  const today = {
    d: new Date(now).toISOString(),
    sectors: sectors.map((s) => ({ id: s.id, name: s.name, color: s.color, p: pct(s) })),
  }

  const prev = snapshots[key]
  if (prev && sameSectors(prev.sectors, today.sectors) && Object.keys(snapshots).length <= MAX_SNAPSHOT_DAYS) {
    return snapshots
  }

  const next: Snapshots = { ...snapshots }
  next[key] = today

  const keys = Object.keys(next).sort()
  while (keys.length > MAX_SNAPSHOT_DAYS) {
    const oldest = keys.shift()
    if (oldest) delete next[oldest]
  }
  return next
}
