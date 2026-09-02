import { describe, expect, it } from 'vitest'
import { defaultDoc } from '../logic/defaults'
import { normalize } from '../logic/normalize'
import { planSync, shouldPullOnResume, shouldSkipPush } from './syncReconcile'
import type { Doc } from '../types'

const NOW = new Date('2026-03-15T14:00:00').getTime()

// один экземпляр на все проверки: defaultDoc заводит историю со случайными id,
// поэтому два вызова подряд дают разные документы
const SEED = normalize(defaultDoc(NOW), NOW)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

const base = (): Doc => clone(SEED)
const withShow = (): Doc => {
  const d = clone(SEED)
  d.lib.shows.push({
    id: 'sh1',
    title: 'Дорама',
    kind: 'dorama',
    color: '#22d3ee',
    season: 1,
    episode: 1,
    minute: 0,
    link: 'https://doramy.club/x',
    rating: 0,
    priority: 0,
    startedAt: '2026-03-14T10:00:00.000Z',
    updatedAt: '2026-03-14T10:00:00.000Z',
  })
  return normalize(d, NOW)
}

describe('planSync — что делать с ответом облака', () => {
  it('облако пусто — заливаем локальные данные', () => {
    expect(planSync({ doc: null, version: 0 }, 0, null, base())).toEqual({ kind: 'push-initial' })
  })

  it('гейт первого входа: свежее устройство не заливает стартовый документ в живой аккаунт', () => {
    // known = 0 — с облаком ещё не сверялись, что бы ни лежало локально
    expect(planSync({ doc: base(), version: 3 }, 0, null, withShow())).toEqual({
      kind: 'apply-cloud',
      version: 3,
    })
  })

  it('облако ушло вперёд, база есть — объединяем, а не выбираем сторону', () => {
    expect(planSync({ doc: base(), version: 6 }, 5, base(), withShow())).toEqual({ kind: 'merge', version: 6 })
  })

  it('облако ушло вперёд, базы нет — уступаем облаку: объединять нечем', () => {
    expect(planSync({ doc: base(), version: 6 }, 5, null, withShow())).toEqual({
      kind: 'apply-cloud',
      version: 6,
    })
  })

  it('облако на нашей версии и содержимое совпало — только освежаем точку согласования', () => {
    expect(planSync({ doc: base(), version: 5 }, 5, base(), base())).toEqual({ kind: 'in-sync', version: 5 })
  })

  it('облако на нашей версии, но документы разошлись — уезжает наше', () => {
    expect(planSync({ doc: base(), version: 5 }, 5, base(), withShow())).toEqual({
      kind: 'push-local',
      version: 5,
    })
  })

  it('облако отстало от нашей версии — тоже отправляем своё', () => {
    expect(planSync({ doc: base(), version: 4 }, 5, base(), withShow())).toEqual({
      kind: 'push-local',
      version: 4,
    })
  })
})

describe('planSync — ночь на телефоне, утро на ноутбуке', () => {
  it('вкладка провисела ночь, вечерняя правка не уехала — она не теряется, а сливается', () => {
    // именно этот случай раньше решался в пользу облака и стирал сериал:
    // флаг «есть неотправленное» жил в памяти вкладки и не переживал закрытие
    const plan = planSync({ doc: base(), version: 42 }, 41, base(), withShow())
    expect(plan.kind).toBe('merge')
  })

  it('отстали и своего нет — слияние всё равно безопасно и вернёт облако', () => {
    expect(planSync({ doc: withShow(), version: 42 }, 41, base(), base())).toEqual({
      kind: 'merge',
      version: 42,
    })
  })
})

describe('shouldPullOnResume', () => {
  it('облако выключено — не читаем', () => {
    expect(shouldPullOnResume({ enabled: false, busy: false })).toBe(false)
  })

  it('своя отправка в пути — сперва она', () => {
    expect(shouldPullOnResume({ enabled: true, busy: true })).toBe(false)
  })

  it('вернулись на вкладку, ничего не летит — перечитываем', () => {
    expect(shouldPullOnResume({ enabled: true, busy: false })).toBe(true)
  })
})

describe('shouldSkipPush — когда совпадение с базой обманчиво', () => {
  it('документ равен базе, всё подтверждено — отправлять нечего', () => {
    expect(shouldSkipPush(true, false)).toBe(true)
  })

  it('после неподтверждённого keepalive отправляем даже совпадение с базой', () => {
    // облако ушло вперёд молча: иначе «Отменить» сразу после удаления
    // не уехало бы, и запись исчезла бы во второй раз — уже насовсем
    expect(shouldSkipPush(true, true)).toBe(false)
  })

  it('документ отличается от базы — отправляем всегда', () => {
    expect(shouldSkipPush(false, false)).toBe(false)
    expect(shouldSkipPush(false, true)).toBe(false)
  })
})
