import { describe, expect, it } from 'vitest'
import { defaultDoc } from './defaults'
import { deepEqual, emptyBase, mergeDoc, sameDoc } from './merge'
import { normalize } from './normalize'
import type { Doc, Habit, Idea, IdeaCheck, Show, TimeEntry } from '../types'

const NOW = Date.parse('2026-08-19T09:00:00.000Z')

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function doc(patch: (d: Doc) => void = () => {}): Doc {
  const d = normalize(defaultDoc(NOW), NOW)
  patch(d)
  return normalize(d, NOW)
}

function show(id: string, over: Partial<Show> = {}): Show {
  return {
    id,
    title: 'Дорама',
    kind: 'dorama',
    color: '#22d3ee',
    season: 1,
    episode: 1,
    minute: 0,
    link: '',
    rating: 0,
    priority: 0,
    startedAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
    ...over,
  }
}

function entry(id: string, start: string, end: string | null): TimeEntry {
  return { id, actId: 'a1', start, end }
}

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    type: 'do',
    name: 'Английский',
    color: '#34d399',
    done: [],
    record: 0,
    start: '2026-08-01T00:00:00.000Z',
    best: 0,
    slips: [],
    riskHour: null,
    logs: {},
    note: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

function ideaCheck(over: Partial<IdeaCheck> = {}): IdeaCheck {
  return { id: 'ic1', text: 'купить ESP32', done: false, ...over }
}

function idea(over: Partial<Idea> = {}): Idea {
  return {
    id: 'idea1',
    title: 'MagDeck',
    category: 'Ардуино',
    text: '',
    links: [],
    images: [],
    checklist: [],
    done: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

/** Документ с одной привычкой — defaultDoc заводит пустой список */
function docH(patch: (d: Doc) => void = () => {}): Doc {
  return doc((d) => {
    d.habits.push(habit())
    patch(d)
  })
}

/** Правки, сделанные на устройстве: база + они = локальный документ */
const withShow = (d: Doc) => d.lib.shows.push(show('sh1', { link: 'https://doramy.club/x', episode: 4 }))
const withBotVideo = (d: Doc) =>
  d.lib.videos.push({
    id: 'vtg1',
    url: 'https://youtu.be/abc',
    title: 'Из телеграма',
    channel: '',
    thumbnail: '',
    color: '#f472b6',
    note: '',
    addedAt: '2026-08-18T21:00:00.000Z',
  })

describe('слияние — свойства, без которых остальное не имеет смысла', () => {
  it('своё же тело, вернувшееся из облака, не удваивается', () => {
    // keepalive при закрытии вкладки уходит, не читая ответа: наутро облако
    // содержит нашу собственную правку, и она обязана слиться сама с собой
    const base = doc()
    const local = doc(withShow)
    const cloud = clone(local)
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.lib.shows).toHaveLength(1)
    expect(sameDoc(merged, local)).toBe(true)
  })

  it('эхо плюс ещё одна правка сохраняет обе', () => {
    const base = doc()
    const sent = doc(withShow)
    const local = doc((d) => {
      withShow(d)
      d.fin.onHand = 250
    })
    const merged = mergeDoc(base, local, clone(sent), NOW)
    expect(merged.lib.shows).toHaveLength(1)
    expect(merged.fin.onHand).toBe(250)
  })

  it('без чужих правок возвращается локальный документ', () => {
    const base = doc()
    const local = doc(withShow)
    expect(sameDoc(mergeDoc(base, local, clone(base), NOW), local)).toBe(true)
  })

  it('без своих правок возвращается облачный', () => {
    const base = doc()
    const cloud = doc(withBotVideo)
    expect(sameDoc(mergeDoc(base, clone(base), cloud, NOW), cloud)).toBe(true)
  })

  it('результат — неподвижная точка normalize', () => {
    const merged = mergeDoc(doc(), doc(withShow), doc(withBotVideo), NOW)
    expect(normalize(merged, NOW)).toEqual(merged)
  })

  it('ни одно поле документа не потеряно', () => {
    const merged = mergeDoc(doc(), doc(withShow), doc(withBotVideo), NOW)
    expect(Object.keys(merged).sort()).toEqual(Object.keys(doc()).sort())
    expect(Object.keys(merged.lib).sort()).toEqual(Object.keys(doc().lib).sort())
    expect(Object.keys(merged.fin).sort()).toEqual(Object.keys(doc().fin).sort())
  })
})

describe('слияние — тот самый случай с сериалом', () => {
  it('сериал с ноутбука и запись бота остаются оба', () => {
    const base = doc()
    const local = doc(withShow) // добавлено на маке, не отправлено
    const cloud = doc(withBotVideo) // за это время в облако записал бот
    const merged = mergeDoc(base, local, cloud, NOW)

    expect(merged.lib.shows.map((s) => s.id)).toEqual(['sh1'])
    expect(merged.lib.shows[0]!.link).toBe('https://doramy.club/x')
    expect(merged.lib.videos.map((v) => v.id)).toEqual(['vtg1'])
    // слитое отличается от облака — значит будет отправлено
    expect(sameDoc(merged, cloud)).toBe(false)
  })

  it('правки телефона не стираются документом ноутбука', () => {
    const base = docH()
    const local = docH(withShow)
    const cloud = docH((d) => {
      d.entries.push(entry('e9', '2026-08-19T04:00:00.000Z', '2026-08-19T05:00:00.000Z'))
      d.habits[0]!.done.push('2026-08-19')
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.lib.shows).toHaveLength(1)
    expect(merged.entries.some((e) => e.id === 'e9')).toBe(true)
    expect(merged.habits[0]!.done).toContain('2026-08-19')
  })
})

describe('слияние — правки одной и той же записи', () => {
  it('разные поля складываются', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => {
      d.lib.shows.push(show('sh1', { episode: 6 }))
    })
    const cloud = doc((d) => {
      d.lib.shows.push(show('sh1', { link: 'https://x.ru' }))
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.lib.shows[0]).toMatchObject({ episode: 6, link: 'https://x.ru' })
  })

  it('позиция в сериале берётся оттуда, где просмотрено дальше', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { season: 1, episode: 3, minute: 10 })))
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { season: 2, episode: 1, minute: 0 })))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.lib.shows[0]).toMatchObject({ season: 2, episode: 1 })
  })

  it('одно и то же поле правили оба — за тем, кто сливает', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { title: 'Моё название' })))
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { title: 'Чужое название' })))
    expect(mergeDoc(base, local, cloud, NOW).lib.shows[0]!.title).toBe('Моё название')
  })

  it('позиция спорит не по «кто сливает», а по «кто дальше»', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { episode: 6 })))
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { episode: 7 })))
    expect(mergeDoc(base, local, cloud, NOW).lib.shows[0]!.episode).toBe(7)
  })

  it('updatedAt побеждает более свежий — список сортируется по нему, обновление должно всплыть', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1', { updatedAt: '2026-08-10T00:00:00.000Z' })))
    const local = doc((d) =>
      d.lib.shows.push(show('sh1', { episode: 6, updatedAt: '2026-08-15T00:00:00.000Z' })),
    )
    const cloud = doc((d) =>
      d.lib.shows.push(show('sh1', { episode: 7, updatedAt: '2026-08-12T00:00:00.000Z' })),
    )
    expect(mergeDoc(base, local, cloud, NOW).lib.shows[0]!.updatedAt).toBe('2026-08-15T00:00:00.000Z')
  })

  it('рейтинг и приоритет, проставленные на одном устройстве, доезжают до другого', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { rating: 8.4 })))
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { priority: 10 })))
    expect(mergeDoc(base, local, cloud, NOW).lib.shows[0]).toMatchObject({ rating: 8.4, priority: 10 })
  })

  it('«не хочу смотреть» с одного устройства не воскресает при слиянии', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { dropped: true })))
    const cloud = doc((d) => d.lib.shows.push(show('sh1')))
    expect(mergeDoc(base, local, cloud, NOW).lib.shows[0]!.dropped).toBe(true)
  })

  it('возврат в очередь стирает флаг и переживает эхо облака', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1', { dropped: true })))
    const local = doc((d) => d.lib.shows.push(show('sh1')))
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { dropped: true })))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.lib.shows[0]!.dropped).toBeUndefined()
    // эхо: свой же результат вернулся из облака — ничего не меняется
    const echoed = mergeDoc(base, clone(merged), clone(merged), NOW)
    expect(echoed.lib.shows[0]!.dropped).toBeUndefined()
  })
})

describe('слияние — чек-лист идеи', () => {
  it('отметка с двух устройств складывается', () => {
    const base = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a' }), ideaCheck({ id: 'b', text: 'купить энкодер' })] })))
    const local = doc((d) =>
      d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a', done: true }), ideaCheck({ id: 'b', text: 'купить энкодер' })] })),
    )
    const cloud = doc((d) =>
      d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a' }), ideaCheck({ id: 'b', text: 'купить энкодер', done: true })] })),
    )
    const merged = mergeDoc(base, local, cloud, NOW)
    const checks = merged.ideas[0]!.checklist
    expect(checks.find((c) => c.id === 'a')!.done).toBe(true)
    expect(checks.find((c) => c.id === 'b')!.done).toBe(true)
  })

  it('добавление пунктов с двух сторон — оба остаются, без дублей', () => {
    const base = doc((d) => d.ideas.push(idea()))
    const local = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'local1', text: 'купить ESP32' })] })))
    const cloud = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'cloud1', text: 'купить магниты' })] })))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.ideas[0]!.checklist.map((c) => c.id).sort()).toEqual(['cloud1', 'local1'])
  })

  it('удаление против отметки — удаление побеждает', () => {
    const base = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a' })] })))
    const local = doc((d) => d.ideas.push(idea())) // пункт удалён здесь
    const cloud = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a', done: true })] })))
    expect(mergeDoc(base, local, cloud, NOW).ideas[0]!.checklist).toHaveLength(0)
  })

  it('эхо: mergeDoc(base, m, m) не меняет чек-лист', () => {
    const base = doc((d) => d.ideas.push(idea()))
    const m = doc((d) => d.ideas.push(idea({ checklist: [ideaCheck({ id: 'a', done: true })] })))
    const merged = mergeDoc(base, m, clone(m), NOW)
    expect(sameDoc(merged, m)).toBe(true)
  })
})

describe('слияние — удаление сильнее правки', () => {
  it('удалённое на одном устройстве не воскресает от правки на другом', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc() // удалили здесь
    const cloud = doc((d) => d.lib.shows.push(show('sh1', { minute: 12 })))
    expect(mergeDoc(base, local, cloud, NOW).lib.shows).toHaveLength(0)
  })

  it('и в обратную сторону — удалили в облаке', () => {
    const base = doc((d) => d.lib.shows.push(show('sh1')))
    const local = doc((d) => d.lib.shows.push(show('sh1', { minute: 12 })))
    const cloud = doc()
    expect(mergeDoc(base, local, cloud, NOW).lib.shows).toHaveLength(0)
  })

  it('оплаченный расход не возвращается правкой суммы', () => {
    const item = { id: 'o1', name: 'Долг', amount: 100, currency: 'USD' as const, date: '' }
    const base = doc((d) => d.fin.oneTime.push(item))
    const local = doc((d) => d.fin.oneTime.push({ ...item, amount: 120 }))
    const cloud = doc((d) => {
      d.fin.onHand = 400
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.fin.oneTime).toHaveLength(0)
    expect(merged.fin.onHand).toBe(400)
  })
})

describe('слияние — трекер', () => {
  it('из двух идущих записей остаётся поздняя, ранняя закрывается началом следующей', () => {
    const base = doc()
    const local = doc((d) => d.entries.push(entry('eX', '2026-08-19T04:00:00.000Z', null)))
    const cloud = doc((d) => {
      d.entries.push(entry('eY', '2026-08-19T04:30:00.000Z', '2026-08-19T05:00:00.000Z'))
      d.entries.push(entry('eZ', '2026-08-19T05:00:00.000Z', null))
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    const byId = Object.fromEntries(merged.entries.map((e) => [e.id, e]))

    expect(merged.entries.filter((e) => e.end === null).map((e) => e.id)).toEqual(['eZ'])
    // ранняя закрыта началом следующей, а не нулевой длиной, как сделал бы normalize
    expect(byId.eX!.end).toBe('2026-08-19T04:30:00.000Z')
    expect(merged.entries.map((e) => e.id)).toEqual(['eX', 'eY', 'eZ'])
  })

  it('обе стороны остановили одну запись — засчитывается более ранний конец', () => {
    const base = doc((d) => d.entries.push(entry('e1', '2026-08-19T04:00:00.000Z', null)))
    const local = doc((d) => d.entries.push(entry('e1', '2026-08-19T04:00:00.000Z', '2026-08-19T06:00:00.000Z')))
    const cloud = doc((d) => d.entries.push(entry('e1', '2026-08-19T04:00:00.000Z', '2026-08-19T05:00:00.000Z')))
    expect(mergeDoc(base, local, cloud, NOW).entries[0]!.end).toBe('2026-08-19T05:00:00.000Z')
  })
})

describe('слияние — привычки, напоминания, финансы', () => {
  it('отметка с любого устройства остаётся, рекорд — больший', () => {
    const base = docH()
    const local = docH((d) => {
      d.habits[0]!.done.push('2026-08-18')
      d.habits[0]!.record = 3
    })
    const cloud = docH((d) => {
      d.habits[0]!.done.push('2026-08-19')
      d.habits[0]!.record = 5
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.habits[0]!.done).toEqual(['2026-08-18', '2026-08-19'])
    expect(merged.habits[0]!.record).toBe(5)
  })

  it('снятая отметка не возвращается', () => {
    const base = docH((d) => d.habits[0]!.done.push('2026-08-19'))
    const local = docH() // сняли здесь
    const cloud = docH((d) => d.habits[0]!.done.push('2026-08-19'))
    expect(mergeDoc(base, local, cloud, NOW).habits[0]!.done).toEqual([])
  })

  it('срывы объединяются по дате и не дублируются', () => {
    const base = docH()
    const local = docH((d) => d.habits[0]!.slips.push({ d: '2026-08-18T20:00:00.000Z', why: 'устал' }))
    const cloud = docH((d) => d.habits[0]!.slips.push({ d: '2026-08-19T20:00:00.000Z', why: 'жара' }))
    expect(mergeDoc(base, local, cloud, NOW).habits[0]!.slips).toHaveLength(2)
  })

  it('«планка взята» известна хотя бы одной стороне — значит взята', () => {
    const base = doc()
    const local = doc((d) => {
      d.fin.hist['2026-07'] = true
    })
    const cloud = doc((d) => {
      d.fin.hist['2026-07'] = false
    })
    expect(mergeDoc(base, local, cloud, NOW).fin.hist['2026-07']).toBe(true)
  })

  it('деньги не складываются: побеждает одна введённая сумма', () => {
    const base = doc((d) => {
      d.fin.onHand = 100
    })
    const local = doc((d) => {
      d.fin.onHand = 300
    })
    const cloud = doc((d) => {
      d.fin.onHand = 200
    })
    expect(mergeDoc(base, local, cloud, NOW).fin.onHand).toBe(300)
  })

  it('отметка напоминания берётся более поздняя', () => {
    const base = doc((d) =>
      d.reminders.push({ id: 'r1', name: 'Профили', intervalDays: 30, lastDone: null, createdAt: '2026-08-01T00:00:00.000Z' }),
    )
    const local = doc((d) =>
      d.reminders.push({
        id: 'r1',
        name: 'Профили',
        intervalDays: 30,
        lastDone: '2026-08-18T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    )
    const cloud = doc((d) =>
      d.reminders.push({
        id: 'r1',
        name: 'Профили',
        intervalDays: 30,
        lastDone: '2026-08-19T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    )
    expect(mergeDoc(base, local, cloud, NOW).reminders[0]!.lastDone).toBe('2026-08-19T00:00:00.000Z')
  })
})

describe('слияние — настройки и служебное', () => {
  it('курс правился с одной стороны, валюта — с другой: сохраняется и то и другое', () => {
    const base = doc()
    const local = doc((d) => {
      d.currency = 'USD'
    })
    const cloud = doc((d) => {
      d.rates.UZS = 12600
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.currency).toBe('USD')
    expect(merged.rates.UZS).toBe(12600)
  })

  it('стиль обводки, выбранный на одном устройстве, доезжает до второго', () => {
    const base = doc()
    const local = doc((d) => {
      d.premiumStyle = 'gold'
    })
    const cloud = doc()
    expect(mergeDoc(base, local, cloud, NOW).premiumStyle).toBe('gold')
    // и обратно: выбор пришёл из облака, локально не трогали
    expect(mergeDoc(base, cloud, local, NOW).premiumStyle).toBe('gold')
  })

  it('пустая база складывает обе стороны, ничего не удаляя', () => {
    const local = doc(withShow)
    const cloud = doc(withBotVideo)
    const merged = mergeDoc(emptyBase(NOW), local, cloud, NOW)
    expect(merged.lib.shows).toHaveLength(1)
    expect(merged.lib.videos).toHaveLength(1)
    expect(merged.sectors.length).toBeGreaterThan(0)
  })

  it('deepEqual считает отсутствующий ключ и undefined одним и тем же', () => {
    expect(deepEqual({ a: 1 }, { a: 1, pinned: undefined })).toBe(true)
    expect(deepEqual({ a: 1, pinned: true }, { a: 1 })).toBe(false)
  })

  it('закрепление кнопки на одном устройстве переживает слияние', () => {
    const base = doc()
    const id = base.acts[3]!.id
    const local = doc((d) => {
      d.acts[3]!.pinned = true
    })
    const cloud = doc((d) => {
      d.acts[0]!.name = 'Работа+'
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.acts.find((a) => a.id === id)!.pinned).toBe(true)
    expect(merged.acts[0]!.name).toBe('Работа+')
  })
})

describe('слияние — общего предка нет, но запись есть у обеих сторон', () => {
  // так бывает, когда отправка при закрытии вкладки долетела, телефон её забрал
  // и дополнил: в облаке наша запись с чужими правками, а базы под неё нет
  it('чужие вложенные списки не выбрасываются', () => {
    const base = docH()
    const local = docH((d) => {
      d.habits.push(habit({ id: 'h2', name: 'Английский', done: ['2026-08-18'] }))
    })
    const cloud = docH((d) => {
      d.habits.push(habit({ id: 'h2', name: 'Английский', done: ['2026-08-18', '2026-08-19'], record: 2 }))
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    const h = merged.habits.find((x) => x.id === 'h2')!
    expect(h.done).toEqual(['2026-08-18', '2026-08-19'])
    expect(h.record).toBe(2)
  })

  it('закрепление, пришедшее только из облака, не теряется', () => {
    const base = doc((d) => {
      d.acts = []
    })
    const local = doc()
    const id = local.acts[2]!.id
    const cloud = doc((d) => {
      d.acts[2]!.pinned = true
    })
    expect(mergeDoc(base, local, cloud, NOW).acts.find((a) => a.id === id)!.pinned).toBe(true)
  })
})

describe('слияние — трекер не теряет длительность', () => {
  const mins = (e: { start: string; end: string | null }) =>
    e.end === null ? null : (Date.parse(e.end) - Date.parse(e.start)) / 60000

  it('две записи с одинаковым началом на разных устройствах остаются целыми', () => {
    // обрезать тут нечем: подрезка первой дала бы отрезок нулевой длины, то есть
    // потерянный час вместо честного нахлёста
    const base = doc()
    const local = doc((d) => d.entries.push(entry('a_lap', '2026-08-19T09:00:00.000Z', '2026-08-19T10:00:00.000Z')))
    const cloud = doc((d) => d.entries.push(entry('b_phone', '2026-08-19T09:00:00.000Z', '2026-08-19T09:30:00.000Z')))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.entries.map(mins).sort((x, y) => Number(y) - Number(x))).toEqual([60, 30])
  })

  it('давний нахлёст не подрезается из-за правки соседа', () => {
    const overlapping = (d: Doc) => {
      d.entries.push(entry('old1', '2026-08-10T09:00:00.000Z', '2026-08-10T11:00:00.000Z'))
      d.entries.push(entry('old2', '2026-08-10T10:00:00.000Z', '2026-08-10T12:00:00.000Z'))
    }
    const base = doc(overlapping)
    const local = doc((d) => {
      overlapping(d)
      d.entries[0] = { ...d.entries[0]!, actId: 'a2' }
    })
    const cloud = doc(overlapping)
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.entries.map(mins)).toEqual([120, 120])
  })

  it('новый нахлёст, созданный слиянием, подрезается по началу следующей', () => {
    const base = doc()
    const local = doc((d) => d.entries.push(entry('e1', '2026-08-19T09:00:00.000Z', '2026-08-19T11:00:00.000Z')))
    const cloud = doc((d) => d.entries.push(entry('e2', '2026-08-19T10:00:00.000Z', '2026-08-19T12:00:00.000Z')))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.entries.map(mins)).toEqual([60, 120])
  })
})

describe('слияние — эхо не превращается в правку', () => {
  it('две записи, начатые в одну минуту, не переставляются', () => {
    // трекер округляет начало до минуты, а id случайны: сортировка с тайбрейком
    // по id меняла бы их местами и делала из эха расхождение
    const base = doc()
    const m = doc((d) => {
      d.entries.push(entry('zz', '2026-08-19T04:00:00.000Z', '2026-08-19T04:00:00.000Z'))
      d.entries.push(entry('aa', '2026-08-19T04:00:00.000Z', '2026-08-19T05:00:00.000Z'))
    })
    const merged = mergeDoc(base, m, clone(m), NOW)
    expect(merged.entries.map((e) => e.id)).toEqual(m.entries.map((e) => e.id))
    expect(sameDoc(merged, m)).toBe(true)
  })
})

describe('слияние — приоритет идей', () => {
  const withIdeas = (d: Doc, list: { id: string; pinned?: true }[]) => {
    d.ideas = list.map((x) => ({
      id: x.id,
      title: x.id,
      category: 'Разное',
      text: '',
      links: [],
      images: [],
      checklist: [],
      done: false,
      ...(x.pinned ? { pinned: x.pinned } : null),
      createdAt: '2026-08-20T10:00:00.000Z',
    }))
  }

  it('звезда, поставленная на одном устройстве, доезжает до второго', () => {
    const base = doc((d) => withIdeas(d, [{ id: 'i1' }, { id: 'i2' }]))
    const local = doc((d) => withIdeas(d, [{ id: 'i1', pinned: true }, { id: 'i2' }]))
    const cloud = doc((d) => withIdeas(d, [{ id: 'i1' }, { id: 'i2' }]))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.ideas.find((i) => i.id === 'i1')!.pinned).toBe(true)
  })

  it('снятая звезда не возвращается из облака', () => {
    const base = doc((d) => withIdeas(d, [{ id: 'i1', pinned: true }, { id: 'i2' }]))
    const local = doc((d) => withIdeas(d, [{ id: 'i1' }, { id: 'i2' }]))
    const cloud = doc((d) => withIdeas(d, [{ id: 'i1', pinned: true }, { id: 'i2' }]))
    const merged = mergeDoc(base, local, cloud, NOW)
    expect('pinned' in merged.ideas.find((i) => i.id === 'i1')!).toBe(false)
  })

  it('порядок, переставленный только здесь, переживает слияние', () => {
    // перестановка — это приоритет, заданный руками: чужой документ, который её
    // не касался, не должен возвращать список к прежнему виду
    const base = doc((d) => withIdeas(d, [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]))
    const local = doc((d) => withIdeas(d, [{ id: 'i3' }, { id: 'i1' }, { id: 'i2' }]))
    const cloud = doc((d) => {
      withIdeas(d, [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }])
      d.fin.onHand = 500
    })
    const merged = mergeDoc(base, local, cloud, NOW)
    expect(merged.ideas.map((i) => i.id)).toEqual(['i3', 'i1', 'i2'])
    expect(merged.fin.onHand).toBe(500)
  })
})
