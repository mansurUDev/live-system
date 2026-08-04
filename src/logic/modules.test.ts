import { describe, expect, it } from 'vitest'
import {
  bestStreak,
  bestWithout,
  daysWithout,
  isDoneToday,
  recentDays,
  resetQuit,
  streak,
  toggleToday,
} from './habits'
import { financeCalc, goalHistory, goalProgress, rollMonth } from './finance'
import { bookProgress, courseProgress, fmtAudio, parseAudio } from './library'
import { nextSteps, pickPriority } from './briefing'
import { normalize } from './normalize'
import { emptyFinance, emptyLibrary, normHabits } from './normalizeModules'
import { defaultDoc } from './defaults'
import { dayKeyAgo, localDateKey } from './time'
import { DAY_MS } from '../constants'
import { DOC_VERSION } from '../types'
import type { Book, Course, Doc, Finance, Habit } from '../types'

const NOW = new Date('2026-03-15T14:00:00').getTime()

function habit(patch: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    type: 'do',
    name: 'Английский',
    color: '#a78bfa',
    done: [],
    record: 0,
    start: new Date(NOW).toISOString(),
    best: 0,
    createdAt: new Date(NOW).toISOString(),
    ...patch,
  }
}

function fin(patch: Partial<Finance> = {}): Finance {
  return { ...emptyFinance(NOW), ...patch }
}

describe('привычки — серия «делаю»', () => {
  it('считает дни подряд от сегодня', () => {
    const h = habit({ done: [dayKeyAgo(0, NOW), dayKeyAgo(1, NOW), dayKeyAgo(2, NOW)] })
    expect(streak(h, NOW)).toBe(3)
    expect(isDoneToday(h, NOW)).toBe(true)
  })

  it('не считает серию оборванной, пока сегодня ещё не отмечено', () => {
    const h = habit({ done: [dayKeyAgo(1, NOW), dayKeyAgo(2, NOW)] })
    expect(streak(h, NOW)).toBe(2)
    expect(isDoneToday(h, NOW)).toBe(false)
  })

  it('обрывает серию на пропущенном дне', () => {
    const h = habit({ done: [dayKeyAgo(0, NOW), dayKeyAgo(1, NOW), dayKeyAgo(3, NOW)] })
    expect(streak(h, NOW)).toBe(2)
  })

  it('пустая история даёт ноль', () => {
    expect(streak(habit(), NOW)).toBe(0)
  })

  it('отметка и снятие меняют серию и подтягивают рекорд', () => {
    let h = habit({ done: [dayKeyAgo(1, NOW), dayKeyAgo(2, NOW)] })
    h = toggleToday(h, NOW)
    expect(streak(h, NOW)).toBe(3)
    expect(h.record).toBe(3)

    h = toggleToday(h, NOW)
    expect(isDoneToday(h, NOW)).toBe(false)
    // рекорд остаётся, даже когда отметку сняли
    expect(h.record).toBe(3)
    expect(bestStreak(h, NOW)).toBe(3)
  })

  it('лента последних дней идёт от старых к сегодняшнему', () => {
    const h = habit({ done: [dayKeyAgo(0, NOW), dayKeyAgo(2, NOW)] })
    expect(recentDays(h, 3, NOW)).toEqual([true, false, true])
  })
})

describe('привычки — «держусь без»', () => {
  it('считает календарные дни от срыва', () => {
    const h = habit({ type: 'quit', start: new Date(NOW - 5 * DAY_MS).toISOString() })
    expect(daysWithout(h, NOW)).toBe(5)
  })

  it('в день срыва счётчик нулевой, а не отрицательный', () => {
    const h = habit({ type: 'quit', start: new Date(NOW + 3600_000).toISOString() })
    expect(daysWithout(h, NOW)).toBe(0)
  })

  it('срыв обнуляет счётчик и сохраняет рекорд', () => {
    const h = habit({ type: 'quit', start: new Date(NOW - 23 * DAY_MS).toISOString(), best: 10 })
    expect(bestWithout(h, NOW)).toBe(23)

    const after = resetQuit(h, NOW)
    expect(daysWithout(after, NOW)).toBe(0)
    expect(after.best).toBe(23)
  })

  it('прежний рекорд не затирается более короткой серией', () => {
    const h = habit({ type: 'quit', start: new Date(NOW - 2 * DAY_MS).toISOString(), best: 40 })
    expect(resetQuit(h, NOW).best).toBe(40)
  })
})

describe('финансы — дневной лимит', () => {
  it('делит свободные деньги на дни до поступления', () => {
    const c = financeCalc(
      fin({ onHand: 1000, cushion: 100, mandatory: [{ id: 'm', name: 'Еда', amount: 300 }], nextIncome: '2026-03-25' }),
      NOW,
    )
    expect(c.dateOk).toBe(true)
    expect(c.days).toBe(10)
    expect(c.mandatory).toBe(300)
    expect(c.free).toBe(600)
    expect(c.limit).toBe(60)
  })

  it('резервирует предстоящие разовые расходы и находит ближайший', () => {
    const c = financeCalc(
      fin({
        onHand: 1000,
        nextIncome: '2026-03-25',
        oneTime: [
          { id: 'o1', name: 'Телефон брату', amount: 300, date: '2026-03-20' },
          { id: 'o2', name: 'Подписка', amount: 100, date: '2026-03-18' },
          { id: 'o3', name: 'Прошлое', amount: 50, date: '2026-03-01' },
        ],
      }),
      NOW,
    )
    expect(c.upcomingTotal).toBe(400)
    expect(c.nearest?.name).toBe('Подписка')
    expect(c.nearestDays).toBe(3)
    expect(c.past).toHaveLength(1)
    expect(c.limit).toBe(60)
  })

  it('не резервирует расход, который наступит позже следующей зарплаты', () => {
    // без этого разбиения день рождения через полгода обнулил бы лимит уже сегодня
    const c = financeCalc(
      fin({
        onHand: 1000,
        nextIncome: '2026-03-20',
        oneTime: [{ id: 'o1', name: 'Подарок брату', amount: 800, date: '2026-09-27' }],
      }),
      NOW,
    )
    expect(c.reservedTotal).toBe(0)
    expect(c.upcomingTotal).toBe(800)
    expect(c.limit).toBeGreaterThan(0)
    // но в списке он всё равно виден — просто не в счёт сегодняшнего лимита
    expect(c.upcoming[0]!.name).toBe('Подарок брату')
  })

  it('резервирует расход ровно на границе следующей зарплаты', () => {
    const c = financeCalc(
      fin({ onHand: 1000, nextIncome: '2026-03-20', oneTime: [{ id: 'o1', name: 'X', amount: 100, date: '2026-03-19' }] }),
      NOW,
    )
    expect(c.reservedTotal).toBe(100)
  })

  it('не уходит в минус при перерасходе', () => {
    const c = financeCalc(fin({ onHand: 50, cushion: 200, nextIncome: '2026-03-25' }), NOW)
    expect(c.free).toBeLessThan(0)
    expect(c.limit).toBe(0)
  })

  it('без даты поступления считает на месяц вперёд', () => {
    const c = financeCalc(fin({ onHand: 3000 }), NOW)
    expect(c.dateOk).toBe(false)
    expect(c.days).toBe(30)
    expect(c.limit).toBe(100)
  })

  it('прошедшая дата поступления не даёт отрицательных дней', () => {
    const c = financeCalc(fin({ onHand: 300, nextIncome: '2026-03-01' }), NOW)
    expect(c.dateOk).toBe(false)
    expect(c.days).toBe(30)
  })
})

describe('финансы — планка дохода', () => {
  it('при смене месяца обнуляет полученное и пишет итог в историю', () => {
    const before = fin({ goal: 2000, got: 2500, monthKey: '2026-02' })
    const after = rollMonth(before, NOW)
    expect(after.monthKey).toBe('2026-03')
    expect(after.got).toBe(0)
    expect(after.hist['2026-02']).toBe(true)
  })

  it('недотянутый месяц уходит в историю как невыполненный', () => {
    const after = rollMonth(fin({ goal: 2000, got: 900, monthKey: '2026-02' }), NOW)
    expect(after.hist['2026-02']).toBe(false)
  })

  it('в том же месяце ничего не трогает', () => {
    const same = fin({ goal: 2000, got: 900, monthKey: '2026-03' })
    expect(rollMonth(same, NOW)).toBe(same)
  })

  it('считает выполнение и историю месяцев', () => {
    const f = fin({ goal: 1000, got: 250, monthKey: '2026-03', hist: { '2026-02': true } })
    expect(goalProgress(f)).toBe(0.25)
    expect(goalProgress(fin({ goal: 0, got: 500 }))).toBe(0)

    const hist = goalHistory(f, 3, NOW)
    expect(hist.map((x) => x.key)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(hist[1]!.ok).toBe(true)
    // текущий месяц ещё не подведён
    expect(hist[2]!.ok).toBeNull()
  })
})

describe('библиотека', () => {
  const book = (patch: Partial<Book> = {}): Book => ({
    id: 'b1',
    title: 'Книга',
    author: '',
    color: '#22d3ee',
    pageCur: 0,
    pageTotal: 300,
    audioCur: 0,
    audioTotal: 580,
    excerpt: '',
    notes: [],
    startedAt: new Date(NOW).toISOString(),
    ...patch,
  })

  it('разбирает позицию аудио в двух форматах', () => {
    expect(parseAudio('3:15')).toBe(195)
    expect(parseAudio('45')).toBe(45)
    expect(parseAudio('')).toBe(0)
    expect(parseAudio('чепуха')).toBe(0)
    expect(fmtAudio(195)).toBe('3:15')
    expect(fmtAudio(60)).toBe('1:00')
  })

  it('берёт ту позицию, что ушла дальше', () => {
    // страница 142 из 300 — это 47%, аудио 195 из 580 — 34%
    expect(bookProgress(book({ pageCur: 142, audioCur: 195 }))).toBe(47)
    // а если слушал больше, чем читал — считаем по аудио
    expect(bookProgress(book({ pageCur: 30, audioCur: 400 }))).toBe(69)
  })

  it('не делит на ноль, когда объём не указан', () => {
    expect(bookProgress(book({ pageTotal: 0, audioTotal: 0, pageCur: 10 }))).toBe(0)
  })

  it('считает прогресс курса по разделам', () => {
    const c: Course = {
      id: 'c1',
      title: 'React',
      platform: 'Udemy',
      color: '#22d3ee',
      pos: '',
      minute: 0,
      sections: [
        { id: 's1', text: 'Основы', done: true },
        { id: 's2', text: 'Хуки', done: true },
        { id: 's3', text: 'Роутинг', done: false },
        { id: 's4', text: 'Тесты', done: false },
      ],
      notes: [],
      startedAt: new Date(NOW).toISOString(),
    }
    expect(courseProgress(c)).toBe(50)
    expect(courseProgress({ ...c, sections: [] })).toBe(0)
  })
})

describe('брифинг', () => {
  function doc(patch: Partial<Doc> = {}): Doc {
    return { ...defaultDoc(NOW), ...patch }
  }

  it('поднимает наверх ближайший денежный срок', () => {
    const p = pickPriority(
      doc({
        fin: fin({ onHand: 900, oneTime: [{ id: 'o1', name: 'Телефон брату', amount: 300, date: '2026-03-16' }] }),
      }),
      NOW,
    )
    expect(p.tab).toBe('fin')
    expect(p.urgency).toBe('hot')
    expect(p.title).toContain('Телефон брату')
  })

  it('во второй половине дня напоминает о серии под угрозой', () => {
    const h = habit({ done: [dayKeyAgo(1, NOW), dayKeyAgo(2, NOW), dayKeyAgo(3, NOW), dayKeyAgo(4, NOW)] })
    const p = pickPriority(doc({ habits: [h] }), NOW)
    expect(p.tab).toBe('habits')
    expect(p.title).toContain('4')
  })

  it('короткую серию под угрозу не записывает', () => {
    const h = habit({ done: [dayKeyAgo(1, NOW)] })
    expect(pickPriority(doc({ habits: [h] }), NOW).tag).toBe('всё ровно')
  })

  it('когда всё спокойно — показывает сводку, а не тревогу', () => {
    const p = pickPriority(doc({ fin: fin({ onHand: 3000 }) }), NOW)
    expect(p.urgency).toBe('calm')
    expect(p.sub).toContain('можно 100')
  })

  it('подсказывает неотмеченные привычки и незакрытые этапы', () => {
    const steps = defaultDoc(NOW).sectors
    const withSteps: Doc = doc({
      habits: [habit({ name: 'Спорт' })],
      sectors: [
        ...steps,
        {
          id: 'g',
          name: 'Продукт',
          color: '#fb923c',
          kind: 'steps',
          value: 5,
          current: 0,
          target: 0,
          unit: '',
          steps: [
            { id: 't1', text: 'a', done: true },
            { id: 't2', text: 'b', done: false },
          ],
          history: [],
          createdAt: new Date(NOW).toISOString(),
          celebrated: false,
          cat: null,
        },
      ],
    })
    const steps2 = nextSteps(withSteps, NOW)
    expect(steps2[0]).toContain('Спорт')
    expect(steps2[1]).toContain('Продукт')
  })
})

describe('схема — переход со старой версии', () => {
  it('документ первой версии получает пустые новые модули', () => {
    const old = {
      v: 1,
      sectors: [{ id: 's1', name: 'Здоровье', color: '#34d399', kind: 'sphere', value: 7 }],
      acts: [{ id: 'a1', name: 'Работа', color: '#22d3ee', cat: 'work' }],
      entries: [],
      archive: [],
      snapshots: {},
    }
    const d = normalize(old, NOW)
    expect(d.v).toBe(DOC_VERSION)
    expect(d.sectors[0]!.name).toBe('Здоровье')
    expect(d.habits).toEqual([])
    expect(d.lib).toEqual(emptyLibrary())
    expect(d.fin.monthKey).toBe('2026-03')
  })

  it('чинит мусор в новых модулях', () => {
    const d = normalize(
      {
        sectors: [],
        habits: [{ id: 'h', type: 'странный', name: '', color: 'red', done: ['2026-03-01', 'мусор', '2026-03-01'] }],
        fin: { goal: 'много', onHand: -5, mandatory: 'нет', hist: { плохо: true, '2026-02': 1 } },
        lib: { books: [{ title: 'Кн', pageTotal: '300', audioCur: 'x' }], courses: 'нет', done: null },
      },
      NOW,
    )
    const h = d.habits[0]!
    expect(h.type).toBe('do')
    expect(h.color).toMatch(/^#[0-9a-f]{6}$/i)
    // мусорные ключи отброшены, повторы схлопнуты
    expect(h.done).toEqual(['2026-03-01'])

    expect(d.fin.goal).toBe(0)
    expect(d.fin.onHand).toBe(0)
    expect(d.fin.mandatory).toEqual([])
    expect(Object.keys(d.fin.hist)).toEqual(['2026-02'])

    expect(d.lib.books[0]!.pageTotal).toBe(300)
    expect(d.lib.books[0]!.audioCur).toBe(0)
    expect(d.lib.courses).toEqual([])
  })

  it('идемпотентна на расширенной схеме', () => {
    const once = normalize(
      {
        ...defaultDoc(NOW),
        habits: normHabits([{ id: 'h', name: 'Спорт', done: [localDateKey(NOW)] }], new Date(NOW).toISOString()),
      },
      NOW,
    )
    expect(normalize(once, NOW)).toEqual(once)
    expect(normalize(JSON.parse(JSON.stringify(once)), NOW)).toEqual(once)
  })
})
