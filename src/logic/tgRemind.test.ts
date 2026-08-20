import { describe, expect, it } from 'vitest'
import { dayKeyShift, pruneSentKeys, remindPlan, tashkentNow, type RemindDoc } from '../../api/tgRemindLogic'

// UTC-моменты подобраны так, чтобы местное время Ташкента (UTC+5) было круглым
const utc = (y: number, m: number, d: number, h: number, min: number) => Date.UTC(y, m - 1, d, h - 5, min)

function doc(patch: Partial<RemindDoc> = {}): RemindDoc {
  return {
    acts: [
      { id: 'sleep', name: 'Сон', cat: 'sleep' },
      { id: 'commute', name: 'На работу', cat: 'byt' },
      { id: 'atwork', name: 'На работе', cat: 'work' },
      { id: 'homeward', name: 'Домой', cat: 'byt' },
      { id: 'home', name: 'Дома', cat: 'rest' },
      { id: 'rest', name: 'Отдых', cat: 'rest' },
    ],
    entries: [],
    ...patch,
  }
}

const running = (actId: string, startUtc: number): RemindDoc['entries'] => [{ actId, start: new Date(startUtc).toISOString(), end: null }]

describe('tashkentNow', () => {
  it('переводит UTC в местное время без DST', () => {
    // 2026-08-19T20:30:00Z + 5ч = 2026-08-20T01:30 по Ташкенту
    const n = tashkentNow(Date.parse('2026-08-19T20:30:00.000Z'))
    expect(n.dayKey).toBe('2026-08-20')
    expect(n.minutes).toBe(90)
  })

  it('день недели переходит через полночь так же, как дата', () => {
    // 19.08.2026 вечером по UTC — уже 20.08 (четверг) по Ташкенту
    const n = tashkentNow(Date.parse('2026-08-19T20:30:00.000Z'))
    expect(n.weekday).toBe(3) // четверг: пн=0 → чт=3
  })

  it('понедельник — нулевой день недели', () => {
    // 2026-08-17 — понедельник
    const n = tashkentNow(utc(2026, 8, 17, 12, 0))
    expect(n.weekday).toBe(0)
  })
})

describe('dayKeyShift', () => {
  it('сдвигает дату вперёд и назад, включая границу месяца', () => {
    expect(dayKeyShift('2026-08-20', -1)).toBe('2026-08-19')
    expect(dayKeyShift('2026-09-01', -1)).toBe('2026-08-31')
    expect(dayKeyShift('2026-08-31', 1)).toBe('2026-09-01')
  })
})

describe('remindPlan — wake (05:10–06:50)', () => {
  it('идёт ночной сон — напоминает отметить подъём', () => {
    const d = doc({ entries: running('sleep', utc(2026, 8, 17, 22, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 5, 30))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#wake')
  })

  it('уже отметил подъём («Дома») — молчит', () => {
    const d = doc({ entries: running('home', utc(2026, 8, 18, 5, 20)) })
    const now = tashkentNow(utc(2026, 8, 18, 5, 40))
    expect(remindPlan(d, now, new Set())).toBeNull()
  })

  it('нет идущей записи — молчит', () => {
    const now = tashkentNow(utc(2026, 8, 18, 5, 30))
    expect(remindPlan(doc(), now, new Set())).toBeNull()
  })

  it('за пределами окна — молчит', () => {
    const d = doc({ entries: running('sleep', utc(2026, 8, 17, 22, 0)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 5, 0)), new Set())).toBeNull()
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 6, 55)), new Set())).toBeNull()
  })
})

describe('remindPlan — commute (05:55–06:45, будни)', () => {
  // окно commute целиком лежит внутри окна wake (05:10–06:50), поэтому идущий
  // сон в это время всегда сначала ловит wake — проверено отдельным тестом
  // «один прогон — максимум одно сообщение» ниже
  it('будни, «Дома» со вчера — спрашивает про дорогу', () => {
    const d = doc({ entries: running('home', utc(2026, 8, 17, 21, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 6, 10))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#commute')
  })

  it('выходной — молчит', () => {
    const d = doc({ entries: running('home', utc(2026, 8, 15, 21, 0)) })
    // 2026-08-16 — воскресенье
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 16, 6, 10)), new Set())).toBeNull()
  })

  it('уже переключил на «На работу» — молчит', () => {
    const d = doc({ entries: running('commute', utc(2026, 8, 18, 6, 0)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 6, 20)), new Set())).toBeNull()
  })

  it('распознанный статус, начатый сегодня внутри окна, — уже осознанный выбор, молчит', () => {
    const d = doc({ entries: running('home', utc(2026, 8, 18, 6, 0)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 6, 15)), new Set())).toBeNull()
  })

  it('посторонняя запись (не статус дневного цикла) не гасит слот — иначе «Приём лекарства» в 6:30 выключил бы вопрос про дорогу', () => {
    const d = doc({ entries: running('rest', utc(2026, 8, 18, 6, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 6, 15))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#commute')
  })
})

describe('remindPlan — work (07:05–08:15, будни)', () => {
  it('«На работу», зависшее с 06:00, — спрашивает', () => {
    const d = doc({ entries: running('commute', utc(2026, 8, 18, 6, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 7, 30))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#work')
  })

  it('уже «На работе» — молчит', () => {
    const d = doc({ entries: running('atwork', utc(2026, 8, 18, 7, 0)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 7, 30)), new Set())).toBeNull()
  })

  it('выходной — досыпает, слот work молчит по будням-фильтру', () => {
    const d = doc({ entries: running('sleep', utc(2026, 8, 15, 23, 0)) })
    // 2026-08-16 — воскресенье
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 16, 7, 30)), new Set())).toBeNull()
  })

  it('свежее «Домой», начатое сегодня утром, — молчит (уже не работает)', () => {
    const d = doc({ entries: running('homeward', utc(2026, 8, 18, 6, 30)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 7, 30)), new Set())).toBeNull()
  })

  it('посторонняя запись сегодня утром не гасит work — «Приём лекарства» в 6:30 не должен выключать вопрос про работу', () => {
    const d = doc({ entries: running('rest', utc(2026, 8, 18, 6, 30)) })
    const now = tashkentNow(utc(2026, 8, 18, 7, 30))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#work')
  })
})

describe('remindPlan — home (17:05–18:45, без фильтра будней)', () => {
  it('«На работе» — спрашивает про дорогу домой', () => {
    const d = doc({ entries: running('atwork', utc(2026, 8, 18, 9, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 17, 20))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#home')
  })

  it('суббота, «На работе» — тоже спрашивает: слот без фильтра по будням', () => {
    // 2026-08-15 — суббота
    const d = doc({ entries: running('atwork', utc(2026, 8, 15, 9, 0)) })
    const now = tashkentNow(utc(2026, 8, 15, 17, 20))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-15#home')
  })

  it('уже «Домой» или «Дома» — молчит', () => {
    const home1 = doc({ entries: running('homeward', utc(2026, 8, 18, 17, 0)) })
    const home2 = doc({ entries: running('home', utc(2026, 8, 18, 17, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 17, 30))
    expect(remindPlan(home1, now, new Set())).toBeNull()
    expect(remindPlan(home2, now, new Set())).toBeNull()
  })

  it('ничего не идёт — не работал сегодня, молчит', () => {
    const now = tashkentNow(utc(2026, 8, 18, 17, 30))
    expect(remindPlan(doc(), now, new Set())).toBeNull()
  })
})

describe('remindPlan — sleep (21:30–23:00)', () => {
  it('не отмечен сон — напоминает', () => {
    const d = doc({ entries: running('rest', utc(2026, 8, 18, 20, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 22, 0))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#sleep')
  })

  it('уже лёг — молчит', () => {
    const d = doc({ entries: running('sleep', utc(2026, 8, 18, 21, 45)) })
    expect(remindPlan(d, tashkentNow(utc(2026, 8, 18, 22, 0)), new Set())).toBeNull()
  })
})

describe('remindPlan — анти-дубль и порядок слотов', () => {
  it('ключ уже отправлен — тот же слот больше не сработает', () => {
    const d = doc({ entries: running('sleep', utc(2026, 8, 17, 22, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 5, 30))
    expect(remindPlan(d, now, new Set(['2026-08-18#wake']))).toBeNull()
  })

  it('один прогон — максимум одно сообщение: wake приоритетнее commute при пересечении окон', () => {
    // 06:10 попадает и в wake (до 06:50), и в commute (с 05:55) — если сон ещё
    // идёт, должен сработать именно wake
    const d = doc({ entries: running('sleep', utc(2026, 8, 17, 22, 0)) })
    const now = tashkentNow(utc(2026, 8, 18, 6, 10))
    expect(remindPlan(d, now, new Set())?.key).toBe('2026-08-18#wake')
  })
})

describe('pruneSentKeys', () => {
  it('оставляет только сегодня и вчера, чужие дни выбрасывает', () => {
    const kept = pruneSentKeys(
      ['2026-08-16#wake', '2026-08-17#sleep', '2026-08-18#wake', '2026-08-18#home'],
      '2026-08-18',
    )
    expect(kept.sort()).toEqual(['2026-08-17#sleep', '2026-08-18#home', '2026-08-18#wake'])
  })

  it('идемпотентно', () => {
    const once = pruneSentKeys(['2026-08-18#wake', '2026-08-01#wake'], '2026-08-18')
    expect(pruneSentKeys(once, '2026-08-18')).toEqual(once)
  })

  it('переживает границу месяца', () => {
    const kept = pruneSentKeys(['2026-08-31#sleep', '2026-09-01#wake'], '2026-09-01')
    expect(kept.sort()).toEqual(['2026-08-31#sleep', '2026-09-01#wake'])
  })
})
