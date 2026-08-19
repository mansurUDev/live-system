import { describe, expect, it } from 'vitest'
import { avgPct, pct } from './pct'
import { findConflict, overlaps, resolveEnd } from './overlap'
import { runningEntry, segs, splitByDay, totalMs } from './segs'
import { actTotals, catTotals, topActs, untrackedMs, weekdayTotals } from './analytics'
import { canPin, DOCK, hotDockHeight, mergeAct, moveActTo, splitActs } from './actLayout'
import { numberForecast, stepsForecast } from './forecast'
import { buildHints } from './hints'
import { normalize } from './normalize'
import { nextChargeAt, ratesMissing } from './finance'
import { agenda } from './agenda'
import { MAX_ARCHIVE } from '../constants'
import { detectIos, detectSafari, installHint, type InstallEnv } from './install'
import { defaultDoc, makeSector } from './defaults'
import { withTodaySnapshot } from './snapshot'
import { donutSlice, fillRadius, labelPosition, sectorAngles, wedgePath, WHEEL } from './wheel'
import { addDays, fmtHm, hhmm, localDateKey, periodRange, startOfDay, weekdayIndex } from './time'
import { AWAKE_STALE_MS, awakeState, bedOptions, nextClockTime, wakeOptions } from './sleep'
import { hasLink, parseRichText } from './richText'
import { firstYoutubeLink, getVideoPosition, parseT, setVideoPosition, updateNoteLink } from './videoPosition'
import { cleanShareUrl } from './links'
import { DAY_MS, HOT_MAX, MAX_ACTS } from '../constants'
import type { Activity, Sector, TimeEntry } from '../types'

const NOW = new Date('2026-03-15T12:00:00').getTime()

// makeSector всегда заводит историю с единственной записью «начало», поэтому
// фикстурам со своей историей она подставляется поверх готового сектора.
function sphere(value: number, extra: Partial<Sector> = {}): Sector {
  return { ...makeSector({ id: 's', name: 'S', color: '#22d3ee', kind: 'sphere', value }, NOW), ...extra }
}
function numberGoal(current: number, target: number, extra: Partial<Sector> = {}): Sector {
  return {
    ...makeSector({ id: 'g', name: 'G', color: '#fbbf24', kind: 'number', current, target }, NOW),
    ...extra,
  }
}
function stepsGoal(done: number, total: number, extra: Partial<Sector> = {}): Sector {
  return {
    ...makeSector(
      {
        id: 'k',
        name: 'K',
        color: '#fb923c',
        kind: 'steps',
        steps: Array.from({ length: total }, (_, i) => ({ id: 't' + i, text: 'э' + i, done: i < done })),
      },
      NOW,
    ),
    ...extra,
  }
}
function entry(id: string, actId: string, start: string, end: string | null): TimeEntry {
  return { id, actId, start, end }
}

const ACTS: Activity[] = [
  { id: 'a1', name: 'Работа', color: '#22d3ee', cat: 'work' },
  { id: 'a2', name: 'Спорт', color: '#34d399', cat: 'health' },
  { id: 'a3', name: 'Сон', color: '#818cf8', cat: 'sleep' },
]

describe('pct', () => {
  it('переводит оценку сферы в проценты', () => {
    expect(pct(sphere(1))).toBe(10)
    expect(pct(sphere(7))).toBe(70)
    expect(pct(sphere(10))).toBe(100)
  })

  it('считает долю числовой цели и не выходит за 100', () => {
    expect(pct(numberGoal(50, 200))).toBe(25)
    expect(pct(numberGoal(999, 100))).toBe(100)
    expect(pct(numberGoal(1, 3))).toBe(33)
  })

  it('не даёт NaN и деления на ноль', () => {
    expect(pct(numberGoal(10, 0))).toBe(0)
    expect(pct(numberGoal(Number.NaN, 100))).toBe(0)
    expect(pct(stepsGoal(0, 0))).toBe(0)
    expect(pct({ ...sphere(5), value: Number.NaN })).toBe(10)
  })

  it('считает долю выполненных этапов', () => {
    expect(pct(stepsGoal(3, 40))).toBe(8)
    expect(pct(stepsGoal(5, 5))).toBe(100)
  })

  it('avgPct отдаёт null на пустом колесе', () => {
    expect(avgPct([])).toBeNull()
    expect(avgPct([sphere(4), sphere(6)])).toBe(50)
  })
})

describe('overlaps / resolveEnd / findConflict', () => {
  it('касание границ не считается пересечением', () => {
    expect(overlaps(0, 10, 10, 20)).toBe(false)
    expect(overlaps(10, 20, 0, 10)).toBe(false)
  })

  it('находит частичное и полное перекрытие', () => {
    expect(overlaps(0, 10, 5, 15)).toBe(true)
    expect(overlaps(0, 100, 40, 50)).toBe(true)
    expect(overlaps(40, 50, 0, 100)).toBe(true)
    expect(overlaps(0, 10, 0, 10)).toBe(true)
  })

  it('запись нулевой длины никому не мешает', () => {
    // трекер заводит такие сам: две кнопки в пределах одной минуты — и
    // предыдущая запись закрывается тем же временем, с которого началась
    expect(overlaps(0, 10, 5, 5)).toBe(false)
    expect(overlaps(5, 5, 0, 10)).toBe(false)
    expect(overlaps(5, 5, 5, 5)).toBe(false)
  })

  it('нулевая запись не блокирует ручную запись поверх неё', () => {
    const list = [entry('zero', 'a1', '2026-03-15T08:04:00.000Z', '2026-03-15T08:04:00.000Z')]
    const cand = {
      start: new Date('2026-03-15T07:10:00.000Z').getTime(),
      end: new Date('2026-03-15T17:22:00.000Z').getTime(),
    }
    expect(findConflict(list, cand)).toBeNull()
  })

  it('конец раньше начала уводит запись за полночь', () => {
    const start = new Date('2026-03-15T23:00:00').getTime()
    const end = new Date('2026-03-15T01:00:00').getTime()
    const r = resolveEnd(start, end)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.end - start).toBe(2 * 3600 * 1000)
  })

  it('совпадающие начало и конец отклоняются', () => {
    const t = new Date('2026-03-15T10:00:00').getTime()
    expect(resolveEnd(t, t).ok).toBe(false)
  })

  it('исключает редактируемую запись по id', () => {
    const list = [entry('e1', 'a1', '2026-03-15T10:00:00.000Z', '2026-03-15T11:00:00.000Z')]
    const cand = {
      start: new Date('2026-03-15T10:30:00.000Z').getTime(),
      end: new Date('2026-03-15T10:45:00.000Z').getTime(),
    }
    expect(findConflict(list, cand)).not.toBeNull()
    expect(findConflict(list, cand, 'e1')).toBeNull()
  })

  it('идущая запись занимает время до бесконечности', () => {
    const list = [entry('run', 'a1', '2026-03-15T09:00:00.000Z', null)]
    const future = {
      start: new Date('2026-03-20T10:00:00.000Z').getTime(),
      end: new Date('2026-03-20T11:00:00.000Z').getTime(),
    }
    expect(findConflict(list, future)).not.toBeNull()
  })

  it('ночная запись конфликтует с утренней следующего дня', () => {
    const list = [entry('m', 'a1', '2026-03-16T07:00:00.000Z', '2026-03-16T08:00:00.000Z')]
    const start = new Date('2026-03-15T23:00:00.000Z').getTime()
    const resolved = resolveEnd(start, new Date('2026-03-15T07:30:00.000Z').getTime())
    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(findConflict(list, { start, end: resolved.end })).not.toBeNull()
    }
  })
})

describe('segs / splitByDay', () => {
  const from = new Date('2026-03-15T00:00:00').getTime()
  const to = new Date('2026-03-16T00:00:00').getTime()

  it('обрезает запись по границам окна', () => {
    const list = [entry('e', 'a1', '2026-03-14T22:00:00', '2026-03-15T02:00:00')]
    const [seg] = segs(list, from, to, NOW)
    expect(seg!.s).toBe(from)
    expect(seg!.e - seg!.s).toBe(2 * 3600 * 1000)
  })

  it('идущую запись считает до текущего момента', () => {
    const list = [entry('e', 'a1', '2026-03-15T11:00:00', null)]
    const [seg] = segs(list, from, to, NOW)
    expect(seg!.e).toBe(NOW)
  })

  it('запись, целиком лежащая вне окна, не попадает в выборку', () => {
    expect(segs([entry('e', 'a1', '2026-03-10T10:00:00', '2026-03-10T11:00:00')], from, to, NOW)).toHaveLength(0)
  })

  it('запись, окончившаяся ровно на границе окна, не попадает', () => {
    expect(segs([entry('e', 'a1', '2026-03-14T22:00:00', '2026-03-15T00:00:00')], from, to, NOW)).toHaveLength(0)
  })

  it('начало в будущем не даёт отрицательной длительности', () => {
    const list = [entry('e', 'a1', '2026-03-15T20:00:00', null)]
    expect(totalMs(segs(list, from, to, NOW))).toBe(0)
  })

  it('делит ночной отрезок по суткам', () => {
    const seg = {
      actId: 'a1',
      s: new Date('2026-03-15T22:00:00').getTime(),
      e: new Date('2026-03-16T02:00:00').getTime(),
    }
    const parts = splitByDay(seg)
    expect(parts).toHaveLength(2)
    expect(parts[0]!.e - parts[0]!.s).toBe(2 * 3600 * 1000)
    expect(parts[1]!.e - parts[1]!.s).toBe(2 * 3600 * 1000)
  })

  it('сохраняет суммарную длительность при делении по суткам', () => {
    const seg = {
      actId: 'a1',
      s: new Date('2026-03-15T20:00:00').getTime(),
      e: new Date('2026-03-18T05:30:00').getTime(),
    }
    expect(totalMs(splitByDay(seg))).toBe(seg.e - seg.s)
  })

  it('находит идущую запись', () => {
    const list = [
      entry('e1', 'a1', '2026-03-15T09:00:00', '2026-03-15T10:00:00'),
      entry('e2', 'a2', '2026-03-15T10:00:00', null),
    ]
    expect(runningEntry(list)?.id).toBe('e2')
    expect(runningEntry([list[0]!])).toBeNull()
  })
})

describe('analytics', () => {
  it('относит записи без категории и удалённых кнопок к прочему', () => {
    const list = [
      { actId: 'a1', s: 0, e: 1000 },
      { actId: 'ghost', s: 0, e: 500 },
    ]
    const totals = catTotals(list, ACTS)
    expect(totals.work).toBe(1000)
    expect(totals.other).toBe(500)
  })

  it('клампит дыры к нулю при пересекающихся записях', () => {
    const list = [
      { actId: 'a1', s: 0, e: 3600_000 },
      { actId: 'a2', s: 0, e: 3600_000 },
    ]
    expect(untrackedMs(list, 0, 3600_000)).toBe(0)
  })

  it('раскладывает время по дням недели, понедельник первый', () => {
    const monday = new Date('2026-03-16T10:00:00')
    const wk = weekdayTotals([
      { actId: 'a1', s: monday.getTime(), e: monday.getTime() + 3600_000 },
    ])
    expect(wk[0]).toBe(3600_000)
    expect(weekdayIndex(new Date('2026-03-15T10:00:00'))).toBe(6)
  })

  it('отдаёт топ-5 по убыванию времени', () => {
    const list = Array.from({ length: 8 }, (_, i) => ({ actId: 'a' + i, s: 0, e: (i + 1) * 1000 }))
    const top = topActs(list)
    expect(top).toHaveLength(5)
    expect(top[0]!.actId).toBe('a7')
    expect(top[0]!.ms).toBeGreaterThan(top[4]!.ms)
  })

  it('actTotals суммирует по активности, а topActs сохраняет тот же порядок', () => {
    const list = [
      { actId: 'a1', s: 0, e: 1000 },
      { actId: 'a1', s: 1000, e: 2500 },
      { actId: 'a2', s: 0, e: 500 },
    ]
    const totals = actTotals(list)
    expect(totals.get('a1')).toBe(2500)
    expect(totals.get('a2')).toBe(500)
    expect(actTotals([]).size).toBe(0)

    const top = topActs(list)
    expect(top[0]!.actId).toBe('a1')
    expect(top[0]!.ms).toBe(2500)
  })
})

describe('forecast', () => {
  it('считает темп и дату достижения', () => {
    const goal = numberGoal(150, 200, {
      history: [{ id: 'h1', d: new Date(NOW - 5 * DAY_MS).toISOString(), p: 50, label: 'старт', v: 100 }],
    })
    const f = numberForecast(goal, NOW)
    expect(f.kind).toBe('ok')
    if (f.kind === 'ok') {
      expect(f.perDay).toBe(10)
      expect(f.days).toBe(5)
    }
  })

  it('сообщает об отсутствии темпа и о достигнутой цели', () => {
    expect(numberForecast(numberGoal(200, 200), NOW).kind).toBe('done')
    expect(numberForecast(numberGoal(50, 200, { history: [] }), NOW).kind).toBe('no-data')

    const stalled = numberGoal(100, 200, {
      history: [{ id: 'h1', d: new Date(NOW - 5 * DAY_MS).toISOString(), p: 50, label: 'старт', v: 100 }],
    })
    expect(numberForecast(stalled, NOW).kind).toBe('negative')
  })

  it('не делит на ноль дней, когда вся история за сегодня', () => {
    const goal = numberGoal(150, 200, {
      history: [{ id: 'h1', d: new Date(NOW).toISOString(), p: 50, label: 'старт', v: 100 }],
    })
    const f = numberForecast(goal, NOW)
    expect(f.kind).toBe('ok')
    if (f.kind === 'ok') expect(Number.isFinite(f.days)).toBe(true)
  })

  it('показывает темп цели по этапам', () => {
    const goal = stepsGoal(3, 10, {
      history: [{ id: 'h1', d: new Date(NOW - DAY_MS).toISOString(), p: 30, label: '✓ Подвеска' }],
    })
    const f = stepsForecast(goal, NOW)
    expect(f.kind).toBe('pace')
    if (f.kind === 'pace') {
      expect(f.per14).toBe(1)
      expect(f.remaining).toBe(7)
    }
    expect(stepsForecast(stepsGoal(5, 5), NOW).kind).toBe('done')
  })
})

describe('hints', () => {
  const week = [{ actId: 'a1', s: 0, e: 3600_000 }]

  it('предупреждает о высокой оценке при малом времени', () => {
    const hints = buildHints([sphere(8, { cat: 'health' })], week, ACTS)
    expect(hints).toHaveLength(1)
    expect(hints[0]!.ms).toBe(0)
  })

  it('молчит, когда времени достаточно или условия не выполнены', () => {
    const withSport = [...week, { actId: 'a2', s: 0, e: 40 * 60_000 }]
    expect(buildHints([sphere(8, { cat: 'health' })], withSport, ACTS)).toHaveLength(0)
    expect(buildHints([sphere(6, { cat: 'health' })], week, ACTS)).toHaveLength(0)
    expect(buildHints([sphere(8)], week, ACTS)).toHaveLength(0)
  })

  it('молчит при полностью пустой неделе', () => {
    expect(buildHints([sphere(8, { cat: 'health' })], [], ACTS)).toHaveLength(0)
  })
})

describe('normalize', () => {
  it('переполненный архив теряет самые давние достижения, а не свежие', () => {
    // редьюсер кладёт новые записи в начало — значит и резать надо голову
    const rec = (id: string, day: number) => ({
      id,
      name: id,
      color: '#fbbf24',
      kindLabel: 'цель',
      startedAt: '2020-01-01T00:00:00.000Z',
      completedAt: new Date(Date.UTC(2026, 0, 1) - day * 86400000).toISOString(),
      summary: '',
    })
    const archive = Array.from({ length: MAX_ARCHIVE + 2 }, (_, i) => rec('a' + i, i))
    const d = normalize({ ...defaultDoc(NOW), archive }, NOW)
    expect(d.archive).toHaveLength(MAX_ARCHIVE)
    expect(d.archive[0]!.id).toBe('a0')
    expect(d.archive.some((a) => a.id === 'a' + (MAX_ARCHIVE + 1))).toBe(false)
  })

  it('подставляет дефолт на мусорный вход', () => {
    const seeded = defaultDoc(NOW).sectors.length
    expect(normalize(null, NOW).sectors).toHaveLength(seeded)
    expect(normalize('нет', NOW).sectors).toHaveLength(seeded)
    expect(normalize([], NOW).sectors).toHaveLength(seeded)
  })

  it('чинит цвета, числа и лишние поля', () => {
    const doc = normalize(
      {
        sectors: [
          { id: 'x', name: 'Ы'.repeat(200), color: 'red', kind: 'сфера', value: 99, current: 'abc' },
        ],
      },
      NOW,
    )
    const s = doc.sectors[0]!
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(s.name.length).toBe(60)
    expect(s.kind).toBe('sphere')
    expect(s.value).toBe(10)
    expect(s.current).toBe(0)
  })

  it('оставляет одну идущую запись и отбрасывает битые даты', () => {
    const doc = normalize(
      {
        sectors: [],
        entries: [
          { id: 'e1', actId: 'a1', start: '2026-03-15T09:00:00.000Z', end: null },
          { id: 'e2', actId: 'a1', start: '2026-03-15T10:00:00.000Z', end: null },
          { id: 'e3', actId: 'a1', start: 'не дата', end: null },
        ],
      },
      NOW,
    )
    expect(doc.entries).toHaveLength(2)
    expect(doc.entries.filter((e) => !e.end)).toHaveLength(1)
    expect(doc.entries.at(-1)!.id).toBe('e2')
  })

  it('сортирует записи и оставляет свежие при переполнении', () => {
    const entries = Array.from({ length: 4200 }, (_, i) => ({
      id: 'e' + i,
      actId: 'a1',
      start: new Date(NOW - (4200 - i) * 60_000).toISOString(),
      end: new Date(NOW - (4200 - i) * 60_000 + 1000).toISOString(),
    }))
    const doc = normalize({ sectors: [], entries }, NOW)
    expect(doc.entries).toHaveLength(4000)
    expect(doc.entries[0]!.id).toBe('e200')
  })

  it('обрезает секунды у границ записей — ручная правка оперирует минутами', () => {
    const doc = normalize(
      {
        sectors: [],
        entries: [
          {
            id: 'e1',
            actId: 'a1',
            start: new Date('2026-03-15T06:04:37').toISOString(),
            end: new Date('2026-03-15T06:15:22').toISOString(),
          },
        ],
      },
      NOW,
    )
    expect(new Date(doc.entries[0]!.start).getSeconds()).toBe(0)
    expect(new Date(doc.entries[0]!.end!).getSeconds()).toBe(0)
    expect(doc.entries[0]!.start).toBe(new Date('2026-03-15T06:04:00').toISOString())
    expect(doc.entries[0]!.end).toBe(new Date('2026-03-15T06:15:00').toISOString())
  })

  it('не пропускает служебные ключи из чужого JSON', () => {
    const raw = JSON.parse('{"sectors":[{"id":"a","__proto__":{"polluted":1}}],"snapshots":{"__proto__":{"x":1}}}')
    const doc = normalize(raw, NOW)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(doc.snapshots)).toHaveLength(0)
  })

  it('идемпотентна и переживает цикл экспорт → импорт', () => {
    const once = normalize(defaultDoc(NOW), NOW)
    const twice = normalize(once, NOW)
    expect(twice).toEqual(once)
    expect(normalize(JSON.parse(JSON.stringify(once)), NOW)).toEqual(once)
  })

  it('идемпотентна и на документе с закреплёнными кнопками — pinned:false не пишется', () => {
    const doc = normalize(
      { sectors: [], acts: Array.from({ length: 10 }, (_, i) => ({ id: 'a' + i, name: 'A' + i, pinned: true })) },
      NOW,
    )
    expect(doc.acts.filter((a) => a.pinned).length).toBe(HOT_MAX)
    const twice = normalize(doc, NOW)
    expect(twice).toEqual(doc)
  })

  it('pinned: мусор приводится к отсутствию поля, true выживает', () => {
    const doc = normalize(
      {
        sectors: [],
        acts: [
          { id: 'a1', name: 'A1', pinned: 'да' },
          { id: 'a2', name: 'A2', pinned: 1 },
          { id: 'a3', name: 'A3', pinned: null },
          { id: 'a4', name: 'A4', pinned: false },
          { id: 'a5', name: 'A5', pinned: {} },
          { id: 'a6', name: 'A6', pinned: true },
        ],
      },
      NOW,
    )
    for (const a of doc.acts.slice(0, 5)) expect(a.pinned).toBeUndefined()
    expect(doc.acts[5]!.pinned).toBe(true)
  })

  it('закреплённых больше HOT_MAX — бюджет расходуется по порядку массива', () => {
    const acts = Array.from({ length: 12 }, (_, i) => ({ id: 'a' + i, name: 'A' + i, pinned: true }))
    const doc = normalize({ sectors: [], acts }, NOW)
    const pinnedIds = doc.acts.filter((a) => a.pinned).map((a) => a.id)
    expect(pinnedIds).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'])
    expect(doc.acts.find((a) => a.id === 'a8')!.pinned).toBeUndefined()
  })

  it('выпавшие за MAX_ACTS кнопки не тратят бюджет закреплений выживших', () => {
    const acts = Array.from({ length: 45 }, (_, i) => ({
      id: 'a' + i,
      name: 'A' + i,
      pinned: i >= 35 && i < 44,
    }))
    const doc = normalize({ sectors: [], acts }, NOW)
    expect(doc.acts).toHaveLength(MAX_ACTS)
    expect(doc.acts.filter((a) => a.pinned)).toHaveLength(5)
  })

  it('nextId: мусорные типы приводятся к отсутствию поля, валидная ссылка выживает', () => {
    const doc = normalize(
      {
        sectors: [],
        acts: [
          { id: 'a1', name: 'A1', nextId: 42 },
          { id: 'a2', name: 'A2', nextId: {} },
          { id: 'a3', name: 'A3', nextId: null },
          { id: 'a4', name: 'A4', nextId: true },
          { id: 'a5', name: 'A5', nextId: 'a1' },
        ],
      },
      NOW,
    )
    for (const a of doc.acts.slice(0, 4)) expect('nextId' in a).toBe(false)
    expect(doc.acts[4]!.nextId).toBe('a1')
  })

  it('nextId: ссылка на несуществующую кнопку удаляется', () => {
    const doc = normalize({ sectors: [], acts: [{ id: 'a1', name: 'A1', nextId: 'ghost' }] }, NOW)
    expect('nextId' in doc.acts[0]!).toBe(false)
  })

  it('nextId: ссылка на саму себя удаляется', () => {
    const doc = normalize({ sectors: [], acts: [{ id: 'a1', name: 'A1', nextId: 'a1' }] }, NOW)
    expect('nextId' in doc.acts[0]!).toBe(false)
  })

  it('nextId: ссылка на кнопку за обрезкой MAX_ACTS удаляется', () => {
    const acts = Array.from({ length: 45 }, (_, i) => ({ id: 'a' + i, name: 'A' + i }))
    acts[0] = { ...acts[0]!, nextId: 'a44' } as (typeof acts)[number] & { nextId: string } // за срезом
    acts[1] = { ...acts[1]!, nextId: 'a39' } as (typeof acts)[number] & { nextId: string } // внутри среза
    const doc = normalize({ sectors: [], acts }, NOW)
    expect('nextId' in doc.acts[0]!).toBe(false)
    expect(doc.acts[1]!.nextId).toBe('a39')
  })

  it('идемпотентна с цепочками — переживает цикл экспорт → импорт', () => {
    const once = normalize(
      { sectors: [], acts: [{ id: 'a1', name: 'A1', nextId: 'a2' }, { id: 'a2', name: 'A2' }] },
      NOW,
    )
    expect(once.acts[0]!.nextId).toBe('a2')
    const twice = normalize(once, NOW)
    expect(twice).toEqual(once)
    expect(normalize(JSON.parse(JSON.stringify(once)), NOW)).toEqual(once)
  })

  it('цепочки и бюджет закреплений не мешают друг другу', () => {
    const acts = Array.from({ length: 10 }, (_, i) => ({
      id: 'a' + i,
      name: 'A' + i,
      pinned: true,
      nextId: 'a' + ((i + 1) % 10),
    }))
    const doc = normalize({ sectors: [], acts }, NOW)
    expect(doc.acts.filter((a) => a.pinned)).toHaveLength(HOT_MAX)
    expect(doc.acts.every((a) => a.nextId)).toBe(true)
    expect(doc.acts[9]!.nextId).toBe('a0') // цикл разрешён — переход всегда явный тап
  })
})

describe('раскладка трекера', () => {
  const acts: Activity[] = [
    { id: 'a1', name: 'Работа', color: '#22d3ee', cat: 'work', pinned: true },
    { id: 'a2', name: 'Встречи', color: '#f472b6', cat: 'work' },
    { id: 'a3', name: 'Бег', color: '#34d399', cat: 'health' },
    { id: 'a4', name: 'Сон', color: '#818cf8', cat: 'sleep', pinned: true },
  ]

  it('splitActs: закреплённые уходят в горячий ряд и не дублируются в полосе', () => {
    const { hot, bands } = splitActs(acts)
    expect(hot.map((a) => a.id)).toEqual(['a1', 'a4'])
    const workBand = bands.find((b) => b.cat === 'work')!
    expect(workBand.acts.map((a) => a.id)).toEqual(['a2'])
    expect(bands.find((b) => b.cat === 'sleep')).toBeUndefined()
  })

  it('splitActs: порядок полос — порядок CAT_KEYS, пустая полоса не выдаётся', () => {
    const { bands } = splitActs(acts)
    expect(bands.map((b) => b.cat)).toEqual(['work', 'health'])
  })

  it('splitActs: девятая закреплённая (документ мимо normalize) падает в свою полосу', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      id: 'p' + i,
      name: 'P' + i,
      color: '#fff',
      cat: 'byt' as const,
      pinned: true,
    }))
    const { hot, bands } = splitActs(nine)
    expect(hot).toHaveLength(HOT_MAX)
    const bytBand = bands.find((b) => b.cat === 'byt')!
    expect(bytBand.acts.map((a) => a.id)).toEqual(['p8'])
  })

  it('canPin: уважает лимит, закреплённую всегда можно тронуть, неизвестный id — нет', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i,
      name: 'P' + i,
      color: '#fff',
      cat: 'byt' as const,
      pinned: true,
    }))
    const withOne = [...eight, { id: 'x', name: 'X', color: '#fff', cat: 'byt' as const }]
    expect(canPin(withOne, 'x')).toBe(false)
    expect(canPin(withOne, 'p0')).toBe(true)
    expect(canPin(withOne, 'ghost')).toBe(false)
  })

  it('mergeAct: сохраняет pinned у закреплённой при правке остальных полей — регрессия на ActModal', () => {
    const prev: Activity = { id: 'a1', name: 'Старое', color: '#000', cat: 'work', pinned: true }
    const next = mergeAct(prev, { id: 'a1', name: 'Новое', color: '#fff', cat: 'byt' })
    expect(next).toEqual({ id: 'a1', name: 'Новое', color: '#fff', cat: 'byt', pinned: true })
  })

  it('mergeAct: у незакреплённой поле pinned не появляется', () => {
    const next = mergeAct(null, { id: 'a1', name: 'Новое', color: '#fff', cat: 'byt' })
    expect(next.pinned).toBeUndefined()
  })

  it('mergeAct: nextId из формы проходит, pinned сохраняется', () => {
    const prev: Activity = { id: 'a1', name: 'Старое', color: '#000', cat: 'work', pinned: true, nextId: 'a2' }
    const next = mergeAct(prev, { id: 'a1', name: 'Новое', color: '#fff', cat: 'byt', nextId: 'a3' })
    expect(next).toEqual({ id: 'a1', name: 'Новое', color: '#fff', cat: 'byt', pinned: true, nextId: 'a3' })
  })

  it('mergeAct: форма без nextId стирает ссылку — это и есть путь «нет» в модалке', () => {
    const prev: Activity = { id: 'a1', name: 'Старое', color: '#000', cat: 'work', nextId: 'a2' }
    const next = mergeAct(prev, { id: 'a1', name: 'Новое', color: '#fff', cat: 'byt' })
    expect('nextId' in next).toBe(false)
  })

  it('hotDockHeight: 0 закреплённых — 0, 1–4 — одна строка, 5 и 8 — две, 9 — как 8', () => {
    expect(hotDockHeight(0)).toBe(0)
    const oneRow = DOCK.padTop + DOCK.caption + DOCK.captionGap + DOCK.chip + DOCK.padBottom
    expect(hotDockHeight(1)).toBe(oneRow)
    expect(hotDockHeight(4)).toBe(oneRow)
    const twoRows = DOCK.padTop + DOCK.caption + DOCK.captionGap + 2 * DOCK.chip + DOCK.gap + DOCK.padBottom
    expect(hotDockHeight(5)).toBe(twoRows)
    expect(hotDockHeight(8)).toBe(twoRows)
    expect(hotDockHeight(9)).toBe(twoRows)
  })
})

describe('moveActTo (drag-and-drop)', () => {
  const moveActs: Activity[] = [
    { id: 'w1', name: 'W1', color: '#111', cat: 'work' },
    { id: 'w2', name: 'W2', color: '#222', cat: 'work' },
    { id: 'w3', name: 'W3', color: '#333', cat: 'work' },
    { id: 'h1', name: 'H1', color: '#444', cat: 'health' },
    { id: 'p1', name: 'P1', color: '#555', cat: 'byt', pinned: true },
  ]

  it('перестановка внутри полосы сохраняет состав и относительный порядок остальных', () => {
    const res = moveActTo(moveActs, 'w3', { kind: 'band', cat: 'work' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.acts.map((a) => a.id).sort()).toEqual(['h1', 'p1', 'w1', 'w2', 'w3'])
    expect(res.acts.map((a) => a.id)).toEqual(['w3', 'w1', 'w2', 'h1', 'p1'])
  })

  it('граничные индексы — 0 и длина зоны', () => {
    const front = moveActTo(moveActs, 'w1', { kind: 'band', cat: 'work' }, 0)
    if (front.ok) expect(front.acts.map((a) => a.id)).toEqual(['w1', 'w2', 'w3', 'h1', 'p1']) // уже там — no-op

    const back = moveActTo(moveActs, 'w1', { kind: 'band', cat: 'work' }, 2)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.acts.map((a) => a.id)).toEqual(['w2', 'w3', 'w1', 'h1', 'p1'])
  })

  it('перенос в другую полосу меняет cat и сообщает catChanged', () => {
    const res = moveActTo(moveActs, 'w1', { kind: 'band', cat: 'health' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.catChanged).toBe('health')
    expect(res.acts.find((a) => a.id === 'w1')!.cat).toBe('health')
  })

  it('перенос в горячий ряд ставит pinned и позицию среди закреплённых', () => {
    const res = moveActTo(moveActs, 'w2', { kind: 'hot' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.pin).toBe('pinned')
    expect(res.acts.find((a) => a.id === 'w2')!.pinned).toBe(true)
    expect(res.acts.map((a) => a.id)).toEqual(['w1', 'w3', 'h1', 'w2', 'p1'])
  })

  it('девятая в горячий ряд — отказ hotFull, исходный массив не тронут', () => {
    const eightPinned: Activity[] = Array.from({ length: 8 }, (_, i) => ({
      id: 'p' + i,
      name: 'P' + i,
      color: '#fff',
      cat: 'byt',
      pinned: true,
    }))
    const acts: Activity[] = [...eightPinned, { id: 'x', name: 'X', color: '#fff', cat: 'byt' }]
    const res = moveActTo(acts, 'x', { kind: 'hot' }, 0)
    expect(res).toEqual({ ok: false, reason: 'hotFull' })
    expect(acts.filter((a) => a.pinned)).toHaveLength(8)
  })

  it('из горячего ряда в полосу — поле pinned удаляется совсем, cat меняется при другой полосе', () => {
    const res = moveActTo(moveActs, 'p1', { kind: 'band', cat: 'health' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.pin).toBe('unpinned')
    expect(res.catChanged).toBe('health')
    const moved = res.acts.find((a) => a.id === 'p1')!
    expect('pinned' in moved).toBe(false)
    expect(moved.cat).toBe('health')
  })

  it('перестановка внутри горячего ряда не трогает pinned', () => {
    const twoHot: Activity[] = [
      { id: 'p1', name: 'P1', color: '#111', cat: 'byt', pinned: true },
      { id: 'p2', name: 'P2', color: '#222', cat: 'work', pinned: true },
    ]
    const res = moveActTo(twoHot, 'p2', { kind: 'hot' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.pin).toBeNull()
    expect(res.acts.find((a) => a.id === 'p2')!.pinned).toBe(true)
    expect(res.acts.map((a) => a.id)).toEqual(['p2', 'p1'])
  })

  it('в пустой горячий ряд — кнопка остаётся на своём месте массива', () => {
    const noPins: Activity[] = [
      { id: 'w1', name: 'W1', color: '#111', cat: 'work' },
      { id: 'w2', name: 'W2', color: '#222', cat: 'work' },
      { id: 'w3', name: 'W3', color: '#333', cat: 'work' },
    ]
    const res = moveActTo(noPins, 'w2', { kind: 'hot' }, 0)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.acts.map((a) => a.id)).toEqual(['w1', 'w2', 'w3'])
    expect(res.acts.find((a) => a.id === 'w2')!.pinned).toBe(true)
  })

  it('перенос на то же место — тот же массив по ссылке (no-op)', () => {
    const res = moveActTo(moveActs, 'w2', { kind: 'band', cat: 'work' }, 1)
    expect(res).toEqual({ ok: true, acts: moveActs, catChanged: null, pin: null })
    if (res.ok) expect(res.acts).toBe(moveActs)
  })

  it('неизвестный id — отказ', () => {
    const res = moveActTo(moveActs, 'ghost', { kind: 'hot' }, 0)
    expect(res).toEqual({ ok: false, reason: 'unknownId' })
  })
})

describe('snapshot', () => {
  it('держит один ключ на день и обрезает старые', () => {
    const sectors = [sphere(5)]
    let snaps = withTodaySnapshot({}, sectors, NOW)
    snaps = withTodaySnapshot(snaps, [sphere(9)], NOW)
    const key = localDateKey(NOW)
    expect(Object.keys(snaps)).toHaveLength(1)
    expect(snaps[key]!.sectors[0]!.p).toBe(90)

    const many: Record<string, { d: string; sectors: [] }> = {}
    for (let i = 0; i < 200; i++) {
      many[localDateKey(addDays(NOW, -i))] = { d: new Date(NOW).toISOString(), sectors: [] }
    }
    expect(Object.keys(withTodaySnapshot(many, sectors, NOW))).toHaveLength(180)
  })
})

describe('time', () => {
  it('строит ключ дня по локальному времени', () => {
    expect(localDateKey(new Date('2026-03-15T01:30:00'))).toBe('2026-03-15')
    expect(localDateKey(new Date('2026-03-15T23:30:00'))).toBe('2026-03-15')
  })

  it('строит окна периодов от полуночи', () => {
    const day = periodRange('day', NOW)
    expect(day.from).toBe(startOfDay(NOW))
    expect(day.to).toBe(NOW)
    expect(localDateKey(periodRange('week', NOW).from)).toBe('2026-03-09')
    expect(localDateKey(periodRange('month', NOW).from)).toBe('2026-02-14')
  })

  it('сдвигает дни через календарь, а не прибавлением суток', () => {
    expect(localDateKey(addDays(new Date('2026-03-02T12:00:00'), -6))).toBe('2026-02-24')
  })

  it('fmtHm: минуты на плитке в формате ч:мм, при нуле — пусто', () => {
    expect(fmtHm(0)).toBe('')
    expect(fmtHm(59_999)).toBe('')
    expect(fmtHm(60_000)).toBe('0:01')
    expect(fmtHm(45 * 60_000)).toBe('0:45')
    expect(fmtHm(70 * 60_000)).toBe('1:10')
    expect(fmtHm(7 * 3600_000 + 40 * 60_000)).toBe('7:40')
    expect(fmtHm(-5000)).toBe('')
  })
})

describe('wheel', () => {
  it('рисует валидный клин для единственного сектора', () => {
    const { a1, a2 } = sectorAngles(1, 0)
    expect(a2 - a1).toBeCloseTo(Math.PI * 2)
    const d = wedgePath(a1, a2)
    expect(d).not.toContain('NaN')
    expect(d).toContain('A208 208 0 1 1')
  })

  it('покрывает круг шестнадцатью секторами', () => {
    const angles = Array.from({ length: 16 }, (_, i) => sectorAngles(16, i))
    const sum = angles.reduce((a, x) => a + (x.a2 - x.a1), 0)
    expect(sum).toBeCloseTo(Math.PI * 2)
    expect(wedgePath(angles[15]!.a1, angles[15]!.a2)).not.toContain('NaN')
  })

  it('переводит процент в радиус заливки без NaN', () => {
    expect(fillRadius(0)).toBe(0)
    // на 100% дуга встаёт чуть внутри внешнего кольца — как в моке
    expect(fillRadius(100)).toBe(WHEEL.R - 2)
    expect(fillRadius(50)).toBeCloseTo(WHEEL.r0 - 2 + (WHEEL.R - WHEEL.r0) / 2, 1)
    expect(fillRadius(Number.NaN)).toBe(0)
  })

  it('разводит подписи по сторонам круга', () => {
    expect(labelPosition(0).textAlign).toBe('left')
    expect(labelPosition(Math.PI).textAlign).toBe('right')
    expect(labelPosition(-Math.PI / 2).textAlign).toBe('center')
  })

  it('замыкает донат, когда сегмент занимает весь круг', () => {
    const full = donutSlice(0, Math.PI * 2, 58)
    expect(full).not.toContain('NaN')
    expect(full.match(/A/g)).toHaveLength(2)
  })
})

describe('предложение установить приложение', () => {
  const env = (patch: Partial<InstallEnv> = {}): InstallEnv => ({
    standalone: false,
    nativePromptReady: false,
    isIos: false,
    isSafari: false,
    dismissed: false,
    ...patch,
  })

  it('уже установленному приложению ничего не предлагаем — даже по прямой просьбе', () => {
    expect(installHint(env({ standalone: true, nativePromptReady: true })).kind).toBe('none')
    expect(installHint(env({ standalone: true, isIos: true, forced: true })).kind).toBe('none')
  })

  it('само предложение всплывает один раз, отказ помнится', () => {
    expect(installHint(env({ dismissed: true, isIos: true, isSafari: true })).kind).toBe('none')
  })

  it('но по прямой просьбе инструкция возвращается даже после отказа', () => {
    expect(installHint(env({ dismissed: true, isIos: true, isSafari: true, forced: true })).kind).toBe('ios')
  })

  it('есть родное окно — показываем кнопку', () => {
    expect(installHint(env({ nativePromptReady: true })).kind).toBe('native')
  })

  it('на iOS инструкция даётся в любом браузере, а не только в Safari', () => {
    const safari = installHint(env({ isIos: true, isSafari: true }))
    expect(safari.kind).toBe('ios')
    if (safari.kind === 'ios') expect(safari.inSafari).toBe(true)

    // Chrome на iPhone или встроенный браузер мессенджера: подсказка нужна тем более
    const other = installHint(env({ isIos: true, isSafari: false }))
    expect(other.kind).toBe('ios')
    if (other.kind === 'ios') expect(other.inSafari).toBe(false)
  })

  it('обычный десктоп сам не пристаёт, но по просьбе объясняет', () => {
    expect(installHint(env()).kind).toBe('none')
    expect(installHint(env({ forced: true })).kind).toBe('ios')
  })

  it('iPad на iPadOS опознаётся, несмотря на «маковский» user-agent', () => {
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/604.1'
    expect(detectIos(ipad, 5)).toBe(true)
    expect(detectIos(ipad, 0)).toBe(false)
    expect(detectIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true)
  })

  it('Safari отличается от притворяющихся им браузеров', () => {
    expect(detectSafari('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Safari/604.1')).toBe(true)
    expect(detectSafari('Mozilla/5.0 (iPhone) CriOS/120.0 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(detectSafari('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Safari/537.36')).toBe(false)
  })
})

describe('сон — циклы и время на ногах', () => {
  const act = (id: string, cat: Activity['cat']): Activity => ({ id, name: id, color: '#22d3ee', cat })
  const entry = (id: string, actId: string, start: string, end: string | null): TimeEntry => ({ id, actId, start, end })

  const ACTS: Activity[] = [act('sleep1', 'sleep'), act('work1', 'work')]

  it('подъём считается от засыпания, а не от момента «лёг»', () => {
    const bed = new Date('2026-03-15T23:00:00').getTime()
    const opts = wakeOptions(bed, [6])
    // 23:00 + 15 минут на засыпание + 9 часов = 8:15
    expect(hhmm(opts[0]!.at)).toBe('08:15')
    expect(opts[0]!.sleepMin).toBe(540)
  })

  it('обратный расчёт: во сколько лечь, чтобы встать вовремя', () => {
    const wake = new Date('2026-03-16T06:20:00').getTime()
    const opts = bedOptions(wake, [5, 6])
    // 6:20 − 7:30 сна − 15 минут на засыпание = 22:35
    expect(hhmm(opts[0]!.at)).toBe('22:35')
    // на шесть циклов лечь надо на полтора часа раньше
    expect(hhmm(opts[1]!.at)).toBe('21:05')
  })

  it('прямой и обратный расчёт сходятся друг с другом', () => {
    const bed = new Date('2026-03-15T22:35:00').getTime()
    const wake = wakeOptions(bed, [5])[0]!.at
    expect(bedOptions(wake, [5])[0]!.at).toBe(bed)
  })

  it('время подъёма без даты берётся ближайшее в будущем', () => {
    const noon = new Date('2026-03-15T12:00:00').getTime()
    // 6:20 сегодня уже прошло — значит завтра
    expect(new Date(nextClockTime(6 * 60 + 20, noon)).getDate()).toBe(16)
    // 23:00 ещё впереди — сегодня
    expect(new Date(nextClockTime(23 * 60, noon)).getDate()).toBe(15)
  })

  it('на ногах — от конца последней записи сна', () => {
    const s = awakeState(
      [
        entry('e1', 'sleep1', '2026-03-14T23:00:00', '2026-03-15T06:00:00'),
        entry('e2', 'work1', '2026-03-15T09:00:00', '2026-03-15T11:00:00'),
      ],
      ACTS,
      NOW,
    )
    expect(s.kind).toBe('awake')
    expect(s.kind === 'awake' && s.ms).toBe(6 * 3600_000)
  })

  it('идущая запись сна — это «сплю», а не бодрствование', () => {
    const s = awakeState([entry('e1', 'sleep1', '2026-03-15T11:00:00', null)], ACTS, NOW)
    expect(s.kind).toBe('sleeping')
  })

  it('сна в записях нет — считать не от чего', () => {
    const s = awakeState([entry('e1', 'work1', '2026-03-15T09:00:00', '2026-03-15T11:00:00')], ACTS, NOW)
    expect(s).toEqual({ kind: 'none' })
  })

  it('сон опознаётся по категории, а не по названию кнопки', () => {
    const odd: Activity[] = [{ id: 'sleep1', name: 'Отрубился', color: '#818cf8', cat: 'sleep' }]
    const s = awakeState([entry('e1', 'sleep1', '2026-03-14T23:00:00', '2026-03-15T06:00:00')], odd, NOW)
    expect(s.kind).toBe('awake')
  })

  it('часы, уехавшие назад, не дают отрицательного бодрствования', () => {
    const s = awakeState([entry('e1', 'sleep1', '2026-03-15T12:00:00', '2026-03-15T14:00:00')], ACTS, NOW)
    expect(s.kind === 'awake' && s.ms).toBe(0)
  })

  it('давняя запись сна помечается как несвежая', () => {
    const s = awakeState([entry('e1', 'sleep1', '2026-03-10T23:00:00', '2026-03-11T06:00:00')], ACTS, NOW)
    expect(s.kind === 'awake' && s.ms > AWAKE_STALE_MS).toBe(true)
  })
})

describe('текст со ссылками — разметка телеграма', () => {
  const YT = 'https://www.youtube.com/watch?v=87-nZrkEqfM'

  it('[подпись](адрес) превращается в ссылку с подписью', () => {
    expect(parseRichText(`[Видео урок](${YT})`)).toEqual([{ kind: 'link', label: 'Видео урок', url: YT }])
  })

  it('текст вокруг ссылки сохраняется', () => {
    const parts = parseRichText(`Смотреть [урок](${YT}) перед сном`)
    expect(parts).toEqual([
      { kind: 'text', text: 'Смотреть ' },
      { kind: 'link', label: 'урок', url: YT },
      { kind: 'text', text: ' перед сном' },
    ])
  })

  it('несколько ссылок в одной заметке', () => {
    const parts = parseRichText(`[раз](https://a.ru) и [два](https://b.ru)`)
    expect(parts.filter((p) => p.kind === 'link')).toHaveLength(2)
  })

  it('javascript: ссылкой не становится и остаётся текстом', () => {
    // иначе чужой импорт мог бы подсунуть скрипт в href
    const parts = parseRichText('[жми](javascript:alert(1))')
    expect(parts.every((p) => p.kind === 'text')).toBe(true)
    expect(parts.map((p) => (p.kind === 'text' ? p.text : '')).join('')).toBe('[жми](javascript:alert(1))')
  })

  it('адрес без схемы ссылкой не становится', () => {
    const parts = parseRichText('[тут](youtube.com/watch?v=1)')
    expect(parts.every((p) => p.kind === 'text')).toBe(true)
  })

  it('голый адрес становится ссылкой с коротким доменом вместо простыни', () => {
    const parts = parseRichText(`смотри ${YT} потом`)
    expect(parts[1]).toEqual({ kind: 'link', label: 'youtube.com', url: YT })
  })

  it('точка и запятая после голого адреса остаются текстом', () => {
    const parts = parseRichText('открой https://a.ru, потом https://b.ru.')
    const links = parts.filter((p) => p.kind === 'link')
    expect(links).toEqual([
      { kind: 'link', label: 'a.ru', url: 'https://a.ru' },
      { kind: 'link', label: 'b.ru', url: 'https://b.ru' },
    ])
    // хвостовая пунктуация осталась текстом, а не уехала в адрес
    expect(parts.map((p) => (p.kind === 'text' ? p.text : p.url)).join('')).toBe(
      'открой https://a.ru, потом https://b.ru.',
    )
  })

  it('пустая подпись заменяется адресом — невидимая ссылка бесполезна', () => {
    expect(parseRichText(`[](${YT})`)).toEqual([{ kind: 'link', label: YT, url: YT }])
  })

  it('подпись из разметки показывается вместо адреса, адрес остаётся спрятан', () => {
    const parts = parseRichText(`[Ссылка](${YT})`)
    expect(parts).toEqual([{ kind: 'link', label: 'Ссылка', url: YT }])
    // в видимом тексте адреса нет
    expect(parts.map((p) => (p.kind === 'text' ? p.text : p.label)).join('')).toBe('Ссылка')
  })

  it('текст без ссылок отдаётся одним куском', () => {
    expect(parseRichText('просто заметка')).toEqual([{ kind: 'text', text: 'просто заметка' }])
    expect(parseRichText('')).toEqual([])
  })

  it('hasLink отличает настоящую ссылку от похожей на неё записи', () => {
    expect(hasLink(`[урок](${YT})`)).toBe(true)
    expect(hasLink('[урок](youtube.com/x)')).toBe(false)
    expect(hasLink('просто текст')).toBe(false)
  })

  it('разбор не портит скобки, не являющиеся ссылкой', () => {
    expect(parseRichText('привычка (важная) на утро')).toEqual([
      { kind: 'text', text: 'привычка (важная) на утро' },
    ])
  })
})

describe('позиция в видео — внутри ссылки', () => {
  const PL = 'https://www.youtube.com/watch?v=p5B_FKjghOM&list=PLabc'

  it('минута и номер урока записываются в параметры youtube', () => {
    const url = setVideoPosition(PL, { seconds: 35 * 60, index: 7 })
    const pos = getVideoPosition(url)
    expect(pos).toEqual({ seconds: 2100, index: 7 })
    expect(url).toContain('t=2100')
    expect(url).toContain('index=7')
  })

  it('сброс позиции убирает параметры совсем, а не пишет ноль', () => {
    const url = setVideoPosition(setVideoPosition(PL, { seconds: 2100, index: 7 }), { seconds: null, index: null })
    // проверяем сами параметры: подстрока «t=» ложно срабатывала бы на «list=»
    const params = new URL(url).searchParams
    expect(params.has('t')).toBe(false)
    expect(params.has('index')).toBe(false)
    expect(params.get('list')).toBe('PLabc')
  })

  it('номер урока без плейлиста не пишется — он бессмысленен', () => {
    const url = setVideoPosition('https://youtu.be/p5B_FKjghOM', { index: 7 })
    expect(url).not.toContain('index=')
  })

  it('t разбирается во всех форматах youtube', () => {
    expect(parseT('2100')).toBe(2100)
    expect(parseT('2100s')).toBe(2100)
    expect(parseT('35m')).toBe(2100)
    expect(parseT('1h5m30s')).toBe(3930)
    expect(parseT('мусор')).toBeNull()
  })

  it('первая youtube-ссылка находится в заметке, чужие хосты пропускаются', () => {
    expect(firstYoutubeLink('[урок](https://youtu.be/abc) и [док](https://example.com/x)')).toBe('https://youtu.be/abc')
    expect(firstYoutubeLink('[док](https://example.com/x)')).toBeNull()
    expect(firstYoutubeLink('')).toBeNull()
  })

  it('замена ссылки в заметке сохраняет подпись и текст вокруг', () => {
    const note = 'смотрю [Урок](https://youtu.be/abc) по утрам'
    const updated = updateNoteLink(note, 'https://youtu.be/abc', 'https://youtu.be/abc?t=600')
    expect(updated).toBe('смотрю [Урок](https://youtu.be/abc?t=600) по утрам')
  })

  it('cleanShareUrl больше не срезает номер видео плейлиста', () => {
    const url = 'https://www.youtube.com/watch?v=x&list=PL1&index=7&t=2100&si=tracker'
    const cleaned = cleanShareUrl(url)
    expect(cleaned).toContain('index=7')
    expect(cleaned).toContain('t=2100')
    expect(cleaned).not.toContain('si=')
  })
})

describe('день списания обязательного расхода', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m, d).getTime()

  it('число ещё не прошло — списание в этом месяце', () => {
    expect(nextChargeAt(20, at(2026, 7, 5))).toBe(at(2026, 7, 20))
  })

  it('сегодня и есть день списания — считается сегодняшним, а не следующим месяцем', () => {
    expect(nextChargeAt(14, at(2026, 7, 14))).toBe(at(2026, 7, 14))
  })

  it('число прошло — переносится на следующий месяц', () => {
    expect(nextChargeAt(5, at(2026, 7, 19))).toBe(at(2026, 8, 5))
  })

  it('31-е в коротком месяце — последний день, а не перескок через месяц', () => {
    expect(nextChargeAt(31, at(2026, 1, 10))).toBe(at(2026, 1, 28))
  })

  it('не задано или мусор — срока нет', () => {
    expect(nextChargeAt(0, at(2026, 7, 5))).toBeNull()
    expect(nextChargeAt(32, at(2026, 7, 5))).toBeNull()
    expect(nextChargeAt(NaN, at(2026, 7, 5))).toBeNull()
  })
})

describe('горизонт сводки', () => {
  const withExpense = (dayOffset: number) => {
    const d = normalize(defaultDoc(NOW), NOW)
    const at = new Date(NOW)
    at.setDate(at.getDate() + dayOffset)
    const date = localDateKey(at.getTime())
    return {
      ...d,
      fin: {
        ...d.fin,
        oneTime: [{ id: 'o1', name: 'Платёж', amount: 10, currency: 'USD' as const, date }],
      },
    }
  }

  it('срок ровно на тридцатый день остаётся в сводке', () => {
    // горизонт меряется днями, а не миллисекундами: в поясах с переводом часов
    // сутки бывают длиной 23 и 25 часов, и граница уезжала на час
    const items = agenda(withExpense(30), NOW)
    expect(items.map((i) => i.id)).toContain('exp-o1')
    expect(items.find((i) => i.id === 'exp-o1')!.days).toBe(30)
  })

  it('на тридцать первый — уже нет', () => {
    expect(agenda(withExpense(31), NOW).map((i) => i.id)).not.toContain('exp-o1')
  })
})

describe('курсы не заданы', () => {
  const fin = (mandatory: Parameters<typeof ratesMissing>[0]['mandatory']) => ({
    ...defaultDoc(NOW).fin,
    mandatory,
  })
  const one = { UZS: 1, USD: 1, EUR: 1, RUB: 1 }

  it('расход в чужой валюте при курсе один к одному — предупреждаем', () => {
    const f = fin([{ id: 'm1', name: 'Аренда', amount: 500, currency: 'UZS', day: 1 }])
    expect(ratesMissing(f, { currency: 'USD', rates: one })).toBe(true)
  })

  it('курс задан частично — всё равно предупреждаем', () => {
    // один верно пересчитанный расход ничего не говорит про остальные валюты
    const f = fin([
      { id: 'm1', name: 'Аренда', amount: 500, currency: 'UZS', day: 1 },
      { id: 'm2', name: 'Курс', amount: 30, currency: 'EUR', day: 5 },
    ])
    expect(ratesMissing(f, { currency: 'UZS', rates: { ...one, USD: 12600 } })).toBe(true)
  })

  it('курс задан — молчим', () => {
    const f = fin([{ id: 'm1', name: 'Аренда', amount: 500, currency: 'UZS', day: 1 }])
    expect(ratesMissing(f, { currency: 'USD', rates: { ...one, UZS: 1 / 12600 } })).toBe(false)
  })

  it('все расходы в валюте отображения — пересчитывать нечего', () => {
    const f = fin([{ id: 'm1', name: 'Аренда', amount: 500, currency: 'USD', day: 1 }])
    expect(ratesMissing(f, { currency: 'USD', rates: one })).toBe(false)
  })
})
