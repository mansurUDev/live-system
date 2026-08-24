import { describe, expect, it } from 'vitest'
import { initialState, reducer, type Action, type AppState } from './reducer'
import { defaultDoc, makeSector } from '../logic/defaults'
import { normalize } from '../logic/normalize'
import { runningEntry } from '../logic/segs'
import { localDateKey } from '../logic/time'
import { pct } from '../logic/pct'
import type { Doc, Idea, Sector, Show, Video } from '../types'

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

function video(patch: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    url: 'https://youtu.be/W1SfFSxlhI8',
    title: 'Видео',
    channel: 'Канал',
    thumbnail: 'https://img.youtube.com/vi/W1SfFSxlhI8/hqdefault.jpg',
    color: '#22d3ee',
    note: '',
    addedAt: new Date(NOW).toISOString(),
    ...patch,
  }
}

function show(patch: Partial<Show> = {}): Show {
  return {
    id: 'sh1',
    title: 'Сериал',
    kind: 'series',
    color: '#a78bfa',
    season: 1,
    episode: 3,
    minute: 12,
    link: '',
    startedAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...patch,
  }
}

function idea(patch: Partial<Idea> = {}): Idea {
  return {
    id: 'i1',
    title: 'Робот на Ардуино',
    category: 'Ардуино',
    text: '',
    links: [],
    images: [],
    checklist: [],
    done: false,
    createdAt: new Date(NOW).toISOString(),
    ...patch,
  }
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

  it('цепочка: переход pressAct кладёт записи встык, без дыр и пересечений', () => {
    let s = stateWith({ entries: [] })
    s = run(s, { type: 'pressAct', actId: 'a1', entryId: 'e1', now: NOW })
    s = run(s, { type: 'pressAct', actId: 'a4', entryId: 'e2', now: NOW + 2700_000 }) // «дальше →» — тап по чипу

    expect(s.doc.entries).toHaveLength(2)
    expect(s.doc.entries[0]!.end).toBe(s.doc.entries[1]!.start) // граница общая — ни дыры, ни пересечения
    expect(runningEntry(s.doc.entries)?.id).toBe('e2')
  })

  it('deleteAct вычищает nextId у ссылавшихся кнопок, нетронутые не меняются', () => {
    const acts = [
      { id: 'a1', name: 'A1', color: '#111', cat: 'byt' as const, nextId: 'a2' },
      { id: 'a2', name: 'A2', color: '#222', cat: 'byt' as const },
      { id: 'a3', name: 'A3', color: '#333', cat: 'byt' as const, nextId: 'a2' },
      { id: 'a4', name: 'A4', color: '#444', cat: 'byt' as const, nextId: 'a3' },
    ]
    const before = stateWith({ acts })
    const s = run(before, { type: 'deleteAct', id: 'a2', now: NOW })

    expect('nextId' in s.doc.acts.find((a) => a.id === 'a1')!).toBe(false)
    expect('nextId' in s.doc.acts.find((a) => a.id === 'a3')!).toBe(false)
    const a4 = s.doc.acts.find((a) => a.id === 'a4')!
    expect(a4.nextId).toBe('a3')
    expect(a4).toBe(before.doc.acts.find((a) => a.id === 'a4')) // не ссылалась на удалённую — та же ссылка
  })
})

describe('горячий ряд', () => {
  function eightPinned(): Doc['acts'] {
    return Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i,
      name: 'P' + i,
      color: '#fff',
      cat: 'byt' as const,
      pinned: true,
    }))
  }

  it('toggleActPin закрепляет незакреплённую', () => {
    const s = run(stateWith({ acts: [{ id: 'a1', name: 'A1', color: '#fff', cat: 'byt' }] }), {
      type: 'toggleActPin',
      id: 'a1',
      now: NOW,
    })
    expect(s.doc.acts.find((a) => a.id === 'a1')!.pinned).toBe(true)
  })

  it('повторный toggle удаляет ключ pinned совсем, а не ставит false', () => {
    let s = stateWith({ acts: [{ id: 'a1', name: 'A1', color: '#fff', cat: 'byt' }] })
    s = run(s, { type: 'toggleActPin', id: 'a1', now: NOW })
    s = run(s, { type: 'toggleActPin', id: 'a1', now: NOW })
    const act = s.doc.acts.find((a) => a.id === 'a1')!
    expect('pinned' in act).toBe(false)
  })

  it('девятую не берёт — редьюсер не меняет doc, закреплённых всё ещё 8', () => {
    const before = stateWith({ acts: [...eightPinned(), { id: 'x', name: 'X', color: '#fff', cat: 'byt' }] })
    const s = run(before, { type: 'toggleActPin', id: 'x', now: NOW })
    expect(s.doc.acts).toBe(before.doc.acts)
    expect(s.doc.acts.filter((a) => a.pinned)).toHaveLength(8)
  })

  it('открепление освобождает место для другой кнопки', () => {
    let s = stateWith({ acts: [...eightPinned(), { id: 'x', name: 'X', color: '#fff', cat: 'byt' }] })
    s = run(s, { type: 'toggleActPin', id: 'p0', now: NOW }) // открепить
    s = run(s, { type: 'toggleActPin', id: 'x', now: NOW }) // закрепить взамен
    expect(s.doc.acts.filter((a) => a.pinned)).toHaveLength(8)
    expect(s.doc.acts.find((a) => a.id === 'p0')!.pinned).toBeUndefined()
    expect(s.doc.acts.find((a) => a.id === 'x')!.pinned).toBe(true)
  })

  it('неизвестный id ничего не ломает', () => {
    const before = stateWith({ acts: [{ id: 'a1', name: 'A1', color: '#fff', cat: 'byt' }] })
    const s = run(before, { type: 'toggleActPin', id: 'ghost', now: NOW })
    expect(s.doc.acts).toBe(before.doc.acts)
  })

  it('deleteAct закреплённой освобождает слот в горячем ряду', () => {
    let s = stateWith({ acts: eightPinned() })
    s = run(s, { type: 'deleteAct', id: 'p0', now: NOW })
    expect(s.doc.acts.filter((a) => a.pinned)).toHaveLength(7)

    s = run(s, { type: 'saveAct', act: { id: 'new', name: 'Новая', color: '#fff', cat: 'byt' }, now: NOW })
    s = run(s, { type: 'toggleActPin', id: 'new', now: NOW })
    expect(s.doc.acts.filter((a) => a.pinned)).toHaveLength(8)
    expect(s.doc.acts.find((a) => a.id === 'new')!.pinned).toBe(true)
  })
})

describe('moveAct', () => {
  const acts: Doc['acts'] = [
    { id: 'w1', name: 'W1', color: '#111', cat: 'work' },
    { id: 'w2', name: 'W2', color: '#222', cat: 'work' },
    { id: 'h1', name: 'H1', color: '#444', cat: 'health' },
  ]

  it('применяет результат moveActTo — перенос из полосы в горячий ряд', () => {
    const s = run(stateWith({ acts }), { type: 'moveAct', id: 'w1', target: { kind: 'hot' }, index: 0, now: NOW })
    expect(s.doc.acts.find((a) => a.id === 'w1')!.pinned).toBe(true)
  })

  it('отказ при переполнении — doc.acts прежний по ссылке', () => {
    const eightPinned: Doc['acts'] = Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i,
      name: 'P' + i,
      color: '#fff',
      cat: 'byt' as const,
      pinned: true,
    }))
    const before = stateWith({ acts: [...eightPinned, { id: 'x', name: 'X', color: '#fff', cat: 'byt' }] })
    const s = run(before, { type: 'moveAct', id: 'x', target: { kind: 'hot' }, index: 0, now: NOW })
    expect(s.doc.acts).toBe(before.doc.acts)
    expect(s.doc.acts.filter((a) => a.pinned)).toHaveLength(8)
  })

  it('неизвестный id — no-op', () => {
    const before = stateWith({ acts })
    const s = run(before, {
      type: 'moveAct',
      id: 'ghost',
      target: { kind: 'band', cat: 'health' },
      index: 0,
      now: NOW,
    })
    expect(s.doc.acts).toBe(before.doc.acts)
  })

  it('перенос на то же место — doc.acts прежний по ссылке', () => {
    const before = stateWith({ acts })
    // w2 уже единственный после w1 в полосе work — index 0 среди остальных членов (w1) не двигает её
    const s = run(before, { type: 'moveAct', id: 'w2', target: { kind: 'band', cat: 'work' }, index: 1, now: NOW })
    expect(s.doc.acts).toBe(before.doc.acts)
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

  it('addAmount на денежной цели форматирует лейбл через money()', () => {
    const money5 = makeSector(
      { id: 'm', name: 'Накопить', color: '#fbbf24', kind: 'number', current: 0, target: 1000, unit: 'USD', isMoney: true },
      NOW,
    )
    let s = stateWith({ sectors: [money5] })
    s = run(s, { type: 'addAmount', id: 'm', delta: 50, now: NOW })
    expect(s.doc.sectors[0]!.history[0]!.label).toBe('+$50 → $50')
  })

  it('deleteHistoryEntry убирает запись по id, не трогая current', () => {
    let s = stateWith({ sectors: [goalAt(0, 1000)] })
    s = run(s, { type: 'addAmount', id: 'g', delta: 50, now: NOW })
    s = run(s, { type: 'addAmount', id: 'g', delta: 20, now: NOW + 1000 })
    expect(s.doc.sectors[0]!.history).toHaveLength(3)
    const victimId = s.doc.sectors[0]!.history[0]!.id

    s = run(s, { type: 'deleteHistoryEntry', id: 'g', historyId: victimId, now: NOW })
    expect(s.doc.sectors[0]!.history).toHaveLength(2)
    expect(s.doc.sectors[0]!.history.some((h) => h.id === victimId)).toBe(false)
    expect(s.doc.sectors[0]!.current).toBe(70)
  })

  it('deleteHistoryEntry с несуществующим id — no-op', () => {
    let s = stateWith({ sectors: [goalAt(0, 1000)] })
    s = run(s, { type: 'addAmount', id: 'g', delta: 50, now: NOW })
    const before = s.doc.sectors[0]!.history
    s = run(s, { type: 'deleteHistoryEntry', id: 'g', historyId: 'нет-такого', now: NOW })
    expect(s.doc.sectors[0]!.history).toEqual(before)
  })

  it('setQuickAmounts заменяет список сумм, не трогая остальной сектор', () => {
    let s = stateWith({ sectors: [goalAt(0, 1000)] })
    s = run(s, { type: 'setQuickAmounts', id: 'g', amounts: [5, 25, 100], now: NOW })
    expect(s.doc.sectors[0]!.quickAmounts).toEqual([5, 25, 100])
    expect(s.doc.sectors[0]!.current).toBe(0)
    expect(s.doc.sectors[0]!.target).toBe(1000)
  })
})

describe('patchDoc', () => {
  it('меняет только currency/rates, остальной документ не трогает', () => {
    const s = stateWith({})
    const before = s.doc
    const next = run(s, {
      type: 'patchDoc',
      patch: { currency: 'USD', rates: { ...before.rates, USD: 12500 } },
      now: NOW,
    })
    expect(next.doc.currency).toBe('USD')
    expect(next.doc.rates.USD).toBe(12500)
    expect(next.doc.sectors).toBe(before.sectors)
    expect(next.doc.fin).toBe(before.fin)
  })
})

describe('напоминания', () => {
  const reminder = {
    id: 'rm1',
    name: 'Обновить LinkedIn',
    intervalDays: 30,
    lastDone: null,
    createdAt: new Date(NOW).toISOString(),
  }

  it('saveReminder добавляет новое и обновляет существующее по id', () => {
    let s = stateWith({ reminders: [] })
    s = run(s, { type: 'saveReminder', reminder, now: NOW })
    expect(s.doc.reminders).toHaveLength(1)

    s = run(s, { type: 'saveReminder', reminder: { ...reminder, intervalDays: 90 }, now: NOW })
    expect(s.doc.reminders).toHaveLength(1)
    expect(s.doc.reminders[0]!.intervalDays).toBe(90)
  })

  it('deleteReminder убирает по id', () => {
    let s = stateWith({ reminders: [reminder] })
    s = run(s, { type: 'deleteReminder', id: reminder.id, now: NOW })
    expect(s.doc.reminders).toHaveLength(0)
  })

  it('markReminderDone фиксирует lastDone только у нужного напоминания', () => {
    const other = { ...reminder, id: 'rm2', name: 'Обновить Upwork' }
    let s = stateWith({ reminders: [reminder, other] })
    s = run(s, { type: 'markReminderDone', id: reminder.id, now: NOW })
    expect(s.doc.reminders.find((r) => r.id === reminder.id)!.lastDone).toBe(new Date(NOW).toISOString())
    expect(s.doc.reminders.find((r) => r.id === other.id)!.lastDone).toBeNull()
  })
})

describe('видео', () => {
  const lib = (videos: Video[]) => ({ ...defaultDoc(NOW).lib, videos })

  it('saveVideo добавляет новое и обновляет существующее по id', () => {
    let s = stateWith({ lib: lib([]) })
    s = run(s, { type: 'saveVideo', video: video(), now: NOW })
    expect(s.doc.lib.videos).toHaveLength(1)

    s = run(s, { type: 'saveVideo', video: video({ note: 'правка' }), now: NOW })
    expect(s.doc.lib.videos).toHaveLength(1)
    expect(s.doc.lib.videos[0]!.note).toBe('правка')
  })

  it('finishLibItem(video) переезжает в lib.done с byline = channel', () => {
    let s = stateWith({ lib: lib([video()]) })
    s = run(s, { type: 'finishLibItem', kind: 'video', id: 'v1', doneId: 'ld1', quote: 'огонь', now: NOW })
    expect(s.doc.lib.videos).toHaveLength(0)
    expect(s.doc.lib.done).toHaveLength(1)
    expect(s.doc.lib.done[0]!.kind).toBe('video')
    expect(s.doc.lib.done[0]!.byline).toBe('Канал')
    expect(s.doc.lib.done[0]!.quote).toBe('огонь')
  })

  it('deleteLibItem(video) убирает из очереди, не трогая книги/курсы', () => {
    const before = stateWith({ lib: lib([video(), video({ id: 'v2' })]) })
    const s = run(before, { type: 'deleteLibItem', kind: 'video', id: 'v1', now: NOW })
    expect(s.doc.lib.videos.map((v) => v.id)).toEqual(['v2'])
    expect(s.doc.lib.books).toBe(before.doc.lib.books)
    expect(s.doc.lib.courses).toBe(before.doc.lib.courses)
  })
})

describe('полка «Смотреть»', () => {
  const lib = (shows: Show[]) => ({ ...defaultDoc(NOW).lib, shows })

  it('saveShow добавляет новое и обновляет существующее по id', () => {
    let s = stateWith({ lib: lib([]) })
    s = run(s, { type: 'saveShow', show: show(), now: NOW })
    expect(s.doc.lib.shows).toHaveLength(1)

    s = run(s, { type: 'saveShow', show: show({ episode: 4 }), now: NOW })
    expect(s.doc.lib.shows).toHaveLength(1)
    expect(s.doc.lib.shows[0]!.episode).toBe(4)
  })

  it('saveShow штампует updatedAt текущим моментом — по нему список сортируется', () => {
    const later = NOW + 60_000
    let s = stateWith({ lib: lib([]) })
    s = run(s, { type: 'saveShow', show: show({ updatedAt: '2020-01-01T00:00:00.000Z' }), now: later })
    expect(s.doc.lib.shows[0]!.updatedAt).toBe(new Date(later).toISOString())
  })

  it('finishLibItem(show) переезжает в lib.done с byline = метка вида', () => {
    let s = stateWith({ lib: lib([show()]) })
    s = run(s, { type: 'finishLibItem', kind: 'show', id: 'sh1', doneId: 'ld1', quote: '', now: NOW })
    expect(s.doc.lib.shows).toHaveLength(0)
    expect(s.doc.lib.done).toHaveLength(1)
    expect(s.doc.lib.done[0]!.kind).toBe('show')
    expect(s.doc.lib.done[0]!.byline).toBe('Сериал')
  })

  it('deleteLibItem(show) убирает из очереди, не трогая видео', () => {
    const before = stateWith({ lib: { ...lib([show(), show({ id: 'sh2' })]), videos: [video()] } })
    const s = run(before, { type: 'deleteLibItem', kind: 'show', id: 'sh1', now: NOW })
    expect(s.doc.lib.shows.map((x) => x.id)).toEqual(['sh2'])
    expect(s.doc.lib.videos).toBe(before.doc.lib.videos)
  })
})

describe('идеи', () => {
  it('saveIdea добавляет новую и обновляет существующую по id', () => {
    let s = stateWith({ ideas: [] })
    s = run(s, { type: 'saveIdea', idea: idea(), now: NOW })
    expect(s.doc.ideas).toHaveLength(1)

    s = run(s, { type: 'saveIdea', idea: idea({ done: true }), now: NOW })
    expect(s.doc.ideas).toHaveLength(1)
    expect(s.doc.ideas[0]!.done).toBe(true)
  })

  it('deleteIdea убирает по id', () => {
    const before = stateWith({ ideas: [idea(), idea({ id: 'i2' })] })
    const s = run(before, { type: 'deleteIdea', id: 'i1', now: NOW })
    expect(s.doc.ideas.map((x) => x.id)).toEqual(['i2'])
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

describe('оплата запланированного расхода', () => {
  const withExpense = (patch: Partial<Doc['fin']['oneTime'][number]> = {}) =>
    initialState({
      ...defaultDoc(NOW),
      currency: 'UZS',
      rates: { UZS: 1, USD: 12500, EUR: 1, RUB: 1 },
      fin: {
        ...defaultDoc(NOW).fin,
        onHand: 5_000_000,
        oneTime: [{ id: 'o1', name: 'Микрозайм', amount: 2_625_000, currency: 'UZS', date: '2026-03-20', ...patch }],
      },
    })

  it('уходит из списка и списывается с «на руках»', () => {
    const s = reducer(withExpense(), { type: 'payOneTime', id: 'o1', now: NOW })
    expect(s.doc.fin.oneTime).toEqual([])
    expect(s.doc.fin.onHand).toBe(5_000_000 - 2_625_000)
  })

  it('расход в чужой валюте списывается в пересчёте, а не один к одному', () => {
    const s = reducer(withExpense({ amount: 100, currency: 'USD' }), { type: 'payOneTime', id: 'o1', now: NOW })
    // 100 $ по курсу 12500 — это 1 250 000 сум, а не 100 сум
    expect(s.doc.fin.onHand).toBe(5_000_000 - 1_250_000)
  })

  it('«на руках» не уходит в минус, даже если расход больше остатка', () => {
    const state = initialState({
      ...defaultDoc(NOW),
      fin: { ...defaultDoc(NOW).fin, onHand: 100, oneTime: [{ id: 'o1', name: 'X', amount: 5000, currency: 'UZS', date: '' }] },
    })
    const s = reducer(state, { type: 'payOneTime', id: 'o1', now: NOW })
    expect(s.doc.fin.onHand).toBe(0)
  })

  it('неизвестный id — без изменений', () => {
    const before = withExpense()
    const s = reducer(before, { type: 'payOneTime', id: 'ghost', now: NOW })
    expect(s.doc.fin).toBe(before.doc.fin)
  })
})

describe('mergeCloud', () => {
  it('сливает с тем, что на экране сейчас, а не с тем, что было при запросе', () => {
    // база снята, пока летел запрос — человек успел нажать ещё раз; эта правка
    // обязана попасть в результат, иначе слияние само становится потерей данных
    const base = normalize(defaultDoc(NOW), NOW)
    const cloud = normalize({ ...base, fin: { ...base.fin, cushion: 500 } }, NOW)

    let state: AppState = { doc: base, celebratingId: null }
    state = reducer(state, { type: 'patchFinance', patch: { onHand: 700 }, now: NOW })
    state = reducer(state, { type: 'mergeCloud', base, cloud, now: NOW })

    expect(state.doc.fin.onHand).toBe(700)
    expect(state.doc.fin.cushion).toBe(500)
  })

  it('закрывает поздравление, как и полная замена документа', () => {
    const base = normalize(defaultDoc(NOW), NOW)
    const state = reducer(
      { doc: base, celebratingId: 's1' } as AppState,
      { type: 'mergeCloud', base, cloud: base, now: NOW },
    )
    expect(state.celebratingId).toBeNull()
  })
})

describe('поступление денег', () => {
  it('сумма идёт и в планку месяца, и на руки', () => {
    const base = normalize(defaultDoc(NOW), NOW)
    const start: AppState = {
      doc: { ...base, fin: { ...base.fin, got: 100, onHand: 50 } },
      celebratingId: null,
    }
    const s = reducer(start, { type: 'addIncome', amount: 400, now: NOW })
    expect(s.doc.fin.got).toBe(500)
    expect(s.doc.fin.onHand).toBe(450)
  })

  it('баланс меняется ровно на внесённую сумму', () => {
    // roundMoney — правило показа (сотни до целых); округлять им сам баланс
    // значило бы менять его на величину, которую никто не вводил
    const base = normalize(defaultDoc(NOW), NOW)
    const start: AppState = {
      doc: { ...base, fin: { ...base.fin, got: 0, onHand: 99.6 } },
      celebratingId: null,
    }
    const s = reducer(start, { type: 'addIncome', amount: 1, now: NOW })
    expect(s.doc.fin.onHand).toBeCloseTo(100.6, 5)
  })

  it('мелкая сумма не теряется', () => {
    const base = normalize(defaultDoc(NOW), NOW)
    const start: AppState = {
      doc: { ...base, fin: { ...base.fin, got: 5000, onHand: 3000 } },
      celebratingId: null,
    }
    const s = reducer(start, { type: 'addIncome', amount: 0.4, now: NOW })
    expect(s.doc.fin.got).toBeCloseTo(5000.4, 5)
    expect(s.doc.fin.onHand).toBeCloseTo(3000.4, 5)
  })

  it('после полуночи первого числа деньги идут новому месяцу, а не прошлому', () => {
    // вкладку держат открытой сутками: без перевода месяца здесь июль закрылся
    // бы как «планка взята», а такую отметку в облаке уже не отменить
    const base = normalize(defaultDoc(NOW), NOW)
    const july: AppState = {
      doc: { ...base, fin: { ...base.fin, monthKey: '2026-07', goal: 5000, got: 4700, onHand: 0 } },
      celebratingId: null,
    }
    const august = new Date('2026-08-01T00:05:00').getTime()
    const s = reducer(july, { type: 'addIncome', amount: 400, now: august })

    expect(s.doc.fin.monthKey).toBe('2026-08')
    expect(s.doc.fin.got).toBe(400)
    expect(s.doc.fin.hist['2026-07']).toBe(false)
    expect(s.doc.fin.onHand).toBe(400)
  })

  it('ноль и мусор ничего не меняют', () => {
    const base = normalize(defaultDoc(NOW), NOW)
    const start: AppState = { doc: base, celebratingId: null }
    // finalize всегда пересобирает документ, поэтому сравниваем сами финансы
    expect(reducer(start, { type: 'addIncome', amount: 0, now: NOW }).doc.fin).toBe(base.fin)
    expect(reducer(start, { type: 'addIncome', amount: -5, now: NOW }).doc.fin).toBe(base.fin)
  })
})

describe('приоритет идей', () => {
  const mk = (id: string, category = 'Разное') => ({
    id,
    title: id,
    category,
    text: '',
    links: [],
    images: [],
    checklist: [],
    done: false,
    createdAt: '2026-08-20T10:00:00.000Z',
  })

  const start = (ideas: ReturnType<typeof mk>[]): AppState => {
    const base = normalize(defaultDoc(NOW), NOW)
    return { doc: { ...base, ideas }, celebratingId: null }
  }

  it('звезда поднимает идею наверх', () => {
    const s = reducer(start([mk('a'), mk('b'), mk('c')]), { type: 'toggleIdeaPin', id: 'c', now: NOW })
    expect(s.doc.ideas.map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(s.doc.ideas[0]!.pinned).toBe(true)
  })

  it('перетаскивание меняет порядок в пределах видимых', () => {
    const s = reducer(start([mk('a'), mk('b'), mk('c')]), {
      type: 'moveIdea',
      id: 'a',
      index: 2,
      scope: ['a', 'b', 'c'],
      now: NOW,
    })
    expect(s.doc.ideas.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('при фильтре по категории скрытые идеи остаются на своих местах', () => {
    const s = reducer(start([mk('a', 'A'), mk('x', 'B'), mk('b', 'A')]), {
      type: 'moveIdea',
      id: 'b',
      index: 0,
      scope: ['a', 'b'],
      now: NOW,
    })
    expect(s.doc.ideas.map((i) => i.id)).toEqual(['b', 'x', 'a'])
  })
})

describe('«задержался»', () => {
  const acts = () => defaultDoc(NOW).acts
  const withEntries = (entries: Doc['entries']): AppState => ({
    doc: { ...normalize(defaultDoc(NOW), NOW), entries },
    celebratingId: null,
  })

  it('время переезжает во встык идущую запись, текущая стартует заново', () => {
    const a1 = acts()[0]!.id
    const a2 = acts()[1]!.id
    const start = withEntries([
      { id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: '2026-03-15T11:00:00.000Z' },
      { id: 'e2', actId: a2, start: '2026-03-15T11:00:00.000Z', end: null },
    ])
    // нажали «домой» в 11:00, задержали до 11:15
    const now = new Date('2026-03-15T11:15:00.000Z').getTime()
    const s = reducer(start, { type: 'lateSwitch', now })

    const e1 = s.doc.entries.find((e) => e.id === 'e1')!
    const e2 = s.doc.entries.find((e) => e.id === 'e2')!
    expect(e1.end).toBe('2026-03-15T11:15:00.000Z') // 15 минут переехали сюда
    expect(e2.start).toBe('2026-03-15T11:15:00.000Z') // текущая — с нуля от нажатия
    expect(e2.end).toBeNull()
  })

  it('зазор между записями сохраняется, а не заметается', () => {
    const a1 = acts()[0]!.id
    const a2 = acts()[1]!.id
    const start = withEntries([
      { id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: '2026-03-15T10:50:00.000Z' },
      { id: 'e2', actId: a2, start: '2026-03-15T11:00:00.000Z', end: null }, // 10-минутный зазор перед e2
    ])
    const now = new Date('2026-03-15T11:20:00.000Z').getTime()
    const s = reducer(start, { type: 'lateSwitch', now })
    const e1 = s.doc.entries.find((e) => e.id === 'e1')!
    // 20 минут переноса прибавились к 10:50, зазор в 10 минут остаётся зазором
    expect(e1.end).toBe('2026-03-15T11:10:00.000Z')
  })

  it('нет идущей записи — ничего не меняет', () => {
    const a1 = acts()[0]!.id
    const start = withEntries([
      { id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: '2026-03-15T11:00:00.000Z' },
    ])
    const s = reducer(start, { type: 'lateSwitch', now: NOW })
    expect(s.doc.entries).toEqual(start.doc.entries)
  })

  it('идущая — первая запись документа: переносить некуда, ничего не меняет', () => {
    const a1 = acts()[0]!.id
    const start = withEntries([{ id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: null }])
    const now = new Date('2026-03-15T10:15:00.000Z').getTime()
    const s = reducer(start, { type: 'lateSwitch', now })
    expect(s.doc.entries).toEqual(start.doc.entries)
  })

  it('нажали сразу же (ничего не прошло) — ничего не меняет', () => {
    const a1 = acts()[0]!.id
    const a2 = acts()[1]!.id
    const start = withEntries([
      { id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: '2026-03-15T11:00:00.000Z' },
      { id: 'e2', actId: a2, start: '2026-03-15T11:00:00.000Z', end: null },
    ])
    const s = reducer(start, { type: 'lateSwitch', now: new Date('2026-03-15T11:00:00.000Z').getTime() })
    expect(s.doc.entries).toEqual(start.doc.entries)
  })

  it('повторное нажатие переносит ещё раз накопившееся время', () => {
    const a1 = acts()[0]!.id
    const a2 = acts()[1]!.id
    const start = withEntries([
      { id: 'e1', actId: a1, start: '2026-03-15T10:00:00.000Z', end: '2026-03-15T11:00:00.000Z' },
      { id: 'e2', actId: a2, start: '2026-03-15T11:00:00.000Z', end: null },
    ])
    const once = reducer(start, { type: 'lateSwitch', now: new Date('2026-03-15T11:10:00.000Z').getTime() })
    const twice = reducer(once, { type: 'lateSwitch', now: new Date('2026-03-15T11:20:00.000Z').getTime() })
    const e1 = twice.doc.entries.find((e) => e.id === 'e1')!
    const e2 = twice.doc.entries.find((e) => e.id === 'e2')!
    expect(e1.end).toBe('2026-03-15T11:20:00.000Z')
    expect(e2.start).toBe('2026-03-15T11:20:00.000Z')
  })
})
