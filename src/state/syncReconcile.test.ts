import { describe, expect, it } from 'vitest'
import { defaultDoc } from '../logic/defaults'
import { reconcile, resolvePushConflict, shouldPullOnResume } from './syncReconcile'

const NOW = new Date('2026-03-15T14:00:00').getTime()

describe('reconcile', () => {
  it('облако пусто — просим залить локальные данные', () => {
    const local = defaultDoc(NOW)
    expect(reconcile({ doc: null, version: 0 }, 0, local, false)).toEqual({ kind: 'push-initial' })
  })

  it('версия в облаке новее известной, локально ничего не менялось — берём облако', () => {
    const local = defaultDoc(NOW)
    const cloud = { ...defaultDoc(NOW), habits: [] }
    expect(reconcile({ doc: cloud, version: 6 }, 5, local, false)).toEqual({ kind: 'apply-cloud', version: 6 })
  })

  it('gonka: правка случилась, пока летел pull, облако новее — побеждает активное устройство', () => {
    const local = defaultDoc(NOW)
    const cloud = { ...defaultDoc(NOW), habits: [] }
    const decision = reconcile({ doc: cloud, version: 6 }, 5, local, true)
    expect(decision).toEqual({ kind: 'keep-local', version: 6, push: true })
  })

  it('гейт known=0: свежее устройство с одной случайной правкой не перевешивает реальный аккаунт', () => {
    const local = defaultDoc(NOW)
    const cloud = { ...defaultDoc(NOW), habits: [] }
    // known=0 — устройство ни разу не сверялось с облаком (первый вход)
    const decision = reconcile({ doc: cloud, version: 3 }, 0, local, true)
    expect(decision).toEqual({ kind: 'apply-cloud', version: 3 })
  })

  it('баг из отчёта: правка не успела уйти в облако до перезагрузки — локальные данные не стираются', () => {
    // локально «Спорт» уже отмечен сегодня, но push ещё не улетел (вкладку перезагрузили раньше debounce)
    const local: ReturnType<typeof defaultDoc> = {
      ...defaultDoc(NOW),
      habits: [
        {
          id: 'h1',
          type: 'do',
          name: 'Спорт',
          color: '#34d399',
          done: ['2026-03-15'],
          record: 1,
          start: new Date(NOW).toISOString(),
          best: 0,
          slips: [],
          riskHour: null,
          logs: {},
          note: '',
          createdAt: new Date(NOW).toISOString(),
        },
      ],
    }
    // в облаке всё ещё старая версия — без отметки, но это ТА ЖЕ версия, что устройство уже видело
    const staleCloud: ReturnType<typeof defaultDoc> = { ...local, habits: [] }
    const known = 5

    const decision = reconcile({ doc: staleCloud, version: known }, known, local, false)

    // ключевая проверка: локальные данные НЕ заменяются устаревшими из облака
    expect(decision.kind).toBe('keep-local')
    if (decision.kind === 'keep-local') {
      expect(decision.push).toBe(true) // расхождение есть — досылаем локальное состояние
    }
  })

  it('облако на нашей версии и содержимое совпадает — досылать нечего', () => {
    const local = defaultDoc(NOW)
    // тот же документ, а не новый defaultDoc() — иначе разойдутся случайные id истории
    const cloud = JSON.parse(JSON.stringify(local))
    const decision = reconcile({ doc: cloud, version: 5 }, 5, local, false)
    expect(decision).toEqual({ kind: 'keep-local', version: 5, push: false })
  })
})

describe('конфликт отправки: кто уступает', () => {
  it('без неотправленных правок устройство принимает облако', () => {
    // вкладка провисела ночь в спящем ноутбуке, пока с телефона отмечали сон
    expect(resolvePushConflict(false)).toBe('take-cloud')
  })

  it('с неотправленными правками устройство досылает своё', () => {
    expect(resolvePushConflict(true)).toBe('retry-local')
  })
})

describe('возврат на вкладку', () => {
  const base = { enabled: true, busy: false, hasUnsentEdits: false }

  it('спокойная вкладка перечитывает облако', () => {
    expect(shouldPullOnResume(base)).toBe(true)
  })

  it('пока своё не отправлено, чужое не читаем', () => {
    // иначе правка, не успевшая уехать, была бы затёрта чужой версией
    expect(shouldPullOnResume({ ...base, busy: true })).toBe(false)
    expect(shouldPullOnResume({ ...base, hasUnsentEdits: true })).toBe(false)
  })

  it('без облака читать нечего', () => {
    expect(shouldPullOnResume({ ...base, enabled: false })).toBe(false)
  })
})

describe('ночь на телефоне, утро на ноутбуке', () => {
  it('отставшая вкладка забирает чужой день, а не навязывает свою память', () => {
    // ноутбук уснул на версии 7 — в его памяти всё ещё вчерашний «Дом и быт»
    const stale = { ...defaultDoc(NOW), entries: [{ id: 'e1', actId: 'a-home', start: '2026-03-14T18:00:00.000Z', end: null }] }
    // за ночь с телефона уехали сон и утренняя гигиена — облако на версии 9
    const cloud = {
      ...defaultDoc(NOW),
      entries: [
        { id: 'e1', actId: 'a-home', start: '2026-03-14T18:00:00.000Z', end: '2026-03-14T20:20:00.000Z' },
        { id: 'e2', actId: 'a-sleep', start: '2026-03-14T20:20:00.000Z', end: '2026-03-15T04:34:00.000Z' },
        { id: 'e3', actId: 'a-care', start: '2026-03-15T04:34:00.000Z', end: null },
      ],
    }

    // ноутбук ничего не правил после своей последней удачной отправки
    const hasUnsentEdits = false
    expect(resolvePushConflict(hasUnsentEdits)).toBe('take-cloud')

    // и при обычной сверке он тоже принимает облако, а не спорит
    expect(reconcile({ doc: cloud, version: 9 }, 7, stale, hasUnsentEdits)).toEqual({
      kind: 'apply-cloud',
      version: 9,
    })
  })

  it('но правка, сделанная на ноутбуке и не уехавшая, не теряется', () => {
    const local = defaultDoc(NOW)
    const cloud = { ...defaultDoc(NOW), habits: [] }
    // dirty=true — человек отметил что-то, пока pull летел
    expect(reconcile({ doc: cloud, version: 9 }, 7, local, true)).toEqual({
      kind: 'keep-local',
      version: 9,
      push: true,
    })
    expect(resolvePushConflict(true)).toBe('retry-local')
  })
})
