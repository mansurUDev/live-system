import { describe, expect, it } from 'vitest'
import { initialState, reducer, type Action, type AppState } from './reducer'
import { defaultDoc, makeSector } from '../logic/defaults'
import { runningEntry } from '../logic/segs'
import { localDateKey } from '../logic/time'
import { pct } from '../logic/pct'
import type { Doc, Sector } from '../types'

const NOW = new Date('2026-03-15T12:00:00').getTime()

function stateWith(patch: Partial<Doc>): AppState {
  return initialState({ ...defaultDoc(NOW), ...patch })
}

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state)
}

function goalAt(current: number, target: number): Sector {
  return makeSector(
    { id: 'g', name: 'Цель', color: '#fbbf24', kind: 'number', current, target },
    NOW,
  )
}

describe('трекер', () => {
  it('закрывает предыдущую запись и начинает новую', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    s = run(s, { type: 'pressAct', actId: 'a4', entryId: 'e2', now: NOW + 900_000 })

    expect(s.doc.entries).toHaveLength(2)
    expect(s.doc.entries[0]!.end).toBe(new Date(NOW + 900_000).toISOString())
    expect(runningEntry(s.doc.entries)?.id).toBe('e2')
  })

  it('повторное нажатие той же активности ничего не меняет', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    const before = s.doc.entries
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e2', now: NOW + 60_000 })
    expect(s.doc.entries).toBe(before)
  })

  it('закрывает сразу все зависшие записи', () => {
    const s = run(
      stateWith({
        entries: [
          { id: 'x1', actId: 'a1', start: new Date(NOW - 7200_000).toISOString(), end: null },
          { id: 'x2', actId: 'a2', start: new Date(NOW - 3600_000).toISOString(), end: null },
        ],
      }),
      { type: 'pressAct', actId: 'a4', entryId: 'e3', now: NOW },
    )
    expect(s.doc.entries.filter((e) => !e.end)).toHaveLength(1)
    expect(runningEntry(s.doc.entries)?.id).toBe('e3')
  })

  it('стоп закрывает запись, а без идущей ничего не делает', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    s = run(s, { type: 'stopTrack', now: NOW + 60_000 })
    expect(runningEntry(s.doc.entries)).toBeNull()

    const before = s.doc
    s = run(s, { type: 'stopTrack', now: NOW + 120_000 })
    expect(s.doc.entries).toBe(before.entries)
  })

  it('переведённые назад часы не дают отрицательной длительности', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    s = run(s, { type: 'stopTrack', now: NOW - 3600_000 })
    const e = s.doc.entries[0]!
    expect(new Date(e.end!).getTime()).toBe(new Date(e.start).getTime())
  })

  it('удаление кнопки закрывает её запись, но записи сохраняет', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    s = run(s, { type: 'deleteAct', id: 'a1', now: NOW + 60_000 })

    expect(s.doc.acts.some((a) => a.id === 'a1')).toBe(false)
    expect(s.doc.entries).toHaveLength(1)
    expect(runningEntry(s.doc.entries)).toBeNull()
  })

  it('сохранённая запись встаёт в порядке по времени начала', () => {
    const s = run(
      stateWith({
        entries: [{ id: 'late', actId: 'a1', start: new Date(NOW).toISOString(), end: new Date(NOW + 1000).toISOString() }],
      }),
      {
        type: 'saveEntry',
        entry: {
          id: 'early',
          actId: 'a2',
          start: new Date(NOW - 7200_000).toISOString(),
          end: new Date(NOW - 3600_000).toISOString(),
        },
        now: NOW,
      },
    )
    expect(s.doc.entries.map((e) => e.id)).toEqual(['early', 'late'])
  })
})

describe('поздравление', () => {
  it('срабатывает на переходе цели через 100% и только один раз', () => {
    let s = stateWith({ sectors: [goalAt(90, 100)] })

    s = run(s, { type: 'addAmount', id: 'g', delta: 10, now: NOW })
    expect(s.celebratingId).toBe('g')
    expect(s.doc.sectors[0]!.celebrated).toBe(true)

    s = run(s, { type: 'dismissCelebration' })
    s = run(s, { type: 'addAmount', id: 'g', delta: 10, now: NOW + 1000 })
    expect(s.celebratingId).toBeNull()
  })

  it('сбрасывает отметку, если цель опустилась ниже 100%', () => {
    let s = stateWith({ sectors: [goalAt(90, 100)] })
    s = run(s, { type: 'addAmount', id: 'g', delta: 10, now: NOW })
    s = run(s, { type: 'dismissCelebration' })
    s = run(s, { type: 'addAmount', id: 'g', delta: -50, now: NOW + 1000 })

    expect(s.doc.sectors[0]!.celebrated).toBe(false)
    expect(pct(s.doc.sectors[0]!)).toBeLessThan(100)
  })

  it('не срабатывает для сферы с оценкой 10', () => {
    let s = stateWith({
      sectors: [makeSector({ id: 'sp', name: 'Сфера', color: '#34d399', kind: 'sphere', value: 9 }, NOW)],
    })
    s = run(s, { type: 'stepSphere', id: 'sp', delta: 1, now: NOW })
    expect(pct(s.doc.sectors[0]!)).toBe(100)
    expect(s.celebratingId).toBeNull()
  })

  it('не срабатывает при импорте уже выполненной цели', () => {
    const imported: Doc = { ...defaultDoc(NOW), sectors: [goalAt(100, 100)] }
    const s = run(stateWith({}), { type: 'replaceDoc', doc: imported, now: NOW })
    expect(s.celebratingId).toBeNull()
  })

  it('гаснет вместе с архивацией цели', () => {
    let s = stateWith({ sectors: [goalAt(90, 100)] })
    s = run(s, { type: 'addAmount', id: 'g', delta: 10, now: NOW })
    s = run(s, { type: 'archiveSector', id: 'g', archiveId: 'ar1', now: NOW + 1000 })

    expect(s.celebratingId).toBeNull()
    expect(s.doc.sectors).toHaveLength(0)
    expect(s.doc.archive[0]!.name).toBe('Цель')
    expect(s.doc.archive[0]!.kindLabel).toBe('накопление')
  })
})

describe('история сектора', () => {
  it('пишет запись при шаге оценки и при добавлении суммы', () => {
    let s = stateWith({ sectors: [goalAt(0, 1000)] })
    s = run(s, { type: 'addAmount', id: 'g', delta: 50, now: NOW })

    const h = s.doc.sectors[0]!.history[0]!
    expect(h.label).toBe('+50 → 50')
    expect(h.v).toBe(50)
  })

  it('живое перетаскивание ползунка не засоряет историю', () => {
    let s = stateWith({
      sectors: [makeSector({ id: 'sp', name: 'Сфера', color: '#34d399', kind: 'sphere', value: 5 }, NOW)],
    })
    const before = s.doc.sectors[0]!.history.length

    s = run(s, { type: 'setSphere', id: 'sp', value: 6, now: NOW })
    s = run(s, { type: 'setSphere', id: 'sp', value: 8, now: NOW })
    expect(s.doc.sectors[0]!.history).toHaveLength(before)

    s = run(s, { type: 'commitSphere', id: 'sp', now: NOW })
    expect(s.doc.sectors[0]!.history).toHaveLength(before + 1)
    expect(s.doc.sectors[0]!.history[0]!.label).toBe('оценка 8/10')
  })
})

describe('снимок дня', () => {
  it('обновляется после любого действия', () => {
    const s = run(stateWith({ sectors: [goalAt(0, 100)] }), {
      type: 'addAmount',
      id: 'g',
      delta: 40,
      now: NOW,
    })
    const snap = s.doc.snapshots[localDateKey(NOW)]!
    expect(snap.sectors[0]!.p).toBe(40)
    expect(Object.keys(s.doc.snapshots)).toHaveLength(1)
  })
})
