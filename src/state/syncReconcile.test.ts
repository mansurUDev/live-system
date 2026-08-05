import { describe, expect, it } from 'vitest'
import { defaultDoc } from '../logic/defaults'
import { reconcile } from './syncReconcile'

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
