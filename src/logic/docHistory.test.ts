import { describe, expect, it } from 'vitest'
import { KEEP_RECENT, planRetention, shouldCoalesce, type VersionRow } from '../../api/docHistoryLogic'

const NOW = Date.parse('2026-09-02T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

describe('shouldCoalesce — пачка правок это одно изменение', () => {
  it('запись минутной давности продолжаем, а не плодим новую', () => {
    expect(shouldCoalesce(iso(NOW - 60_000), NOW)).toBe(true)
  })

  it('через десять минут это уже другая правка', () => {
    expect(shouldCoalesce(iso(NOW - 10 * 60_000), NOW)).toBe(false)
  })

  it('истории ещё нет — писать новую', () => {
    expect(shouldCoalesce(null, NOW)).toBe(false)
    expect(shouldCoalesce('мусор', NOW)).toBe(false)
  })
})

describe('planRetention — что удалить из истории', () => {
  it('пачка версий за одну минуту сжимается до последних тридцати', () => {
    const rows: VersionRow[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      version: i + 1,
      savedAt: iso(NOW - (100 - i) * 1000),
    }))
    const drop = planRetention(rows, NOW)
    expect(rows.length - drop.length).toBe(KEEP_RECENT)
    // выбрасываются самые старые, свежие остаются
    expect(drop).toContain(1)
    expect(drop).not.toContain(100)
  })

  it('снимок за каждый день последнего месяца переживает лимит по числу версий', () => {
    const rows: VersionRow[] = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      version: i + 1,
      // по одной версии в день, самая старая — 40 дней назад
      savedAt: iso(NOW - (40 - i) * 86400000),
    }))
    const keptIds = rows.map((r) => r.id).filter((id) => !planRetention(rows, NOW).includes(id))
    // тридцать дней истории целы, всё, что старше, ушло
    expect(keptIds.length).toBeGreaterThanOrEqual(30)
    expect(keptIds).toContain(40)
    expect(keptIds).not.toContain(1)
  })

  it('за давний день остаётся ровно одна версия — последняя', () => {
    const oldDay = Date.parse('2026-08-20T00:00:00.000Z') // в пределах месяца
    const busyDay: VersionRow[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      version: i + 1,
      savedAt: iso(oldDay + (i + 1) * 60_000),
    }))
    // свежие версии занимают весь лимит «последних тридцати»
    const recent: VersionRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: 100 + i,
      version: 100 + i,
      savedAt: iso(NOW - (30 - i) * 1000),
    }))
    const kept = [...busyDay, ...recent]
      .map((r) => r.id)
      .filter((id) => !planRetention([...busyDay, ...recent], NOW).includes(id))
    const keptFromOldDay = kept.filter((id) => id <= 20)
    expect(keptFromOldDay).toEqual([20])
    expect(kept.filter((id) => id >= 100)).toHaveLength(30)
  })

  it('пустая история — удалять нечего', () => {
    expect(planRetention([], NOW)).toEqual([])
  })
})
