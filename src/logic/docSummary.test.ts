import { describe, expect, it } from 'vitest'
import { defaultDoc } from './defaults'
import { diffSummary, summarize } from './docSummary'
import { normalize } from './normalize'
import type { Doc } from '../types'

const NOW = Date.parse('2026-09-02T10:00:00.000Z')
const base = (): Doc => normalize(defaultDoc(NOW), NOW)

describe('summarize / diffSummary — чем версия отличается от текущей', () => {
  it('одинаковые документы — разницы нет', () => {
    expect(diffSummary(base(), base())).toEqual([])
  })

  it('в версии было больше идей — показывается плюс', () => {
    const older = base()
    older.ideas = [1, 2, 3].map((i) => ({
      id: 'i' + i,
      title: 'Идея',
      category: 'Разное',
      text: '',
      links: [],
      images: [],
      checklist: [],
      done: false,
      createdAt: '2026-08-01T00:00:00.000Z',
    }))
    expect(diffSummary(base(), older)).toContain('+3 идеи')
  })

  it('в версии было меньше записей трекера — показывается минус со склонением', () => {
    const current = base()
    current.entries = [
      { id: 'e1', actId: 'a1', start: '2026-09-02T08:00:00.000Z', end: '2026-09-02T09:00:00.000Z' },
    ]
    expect(diffSummary(current, base())).toContain('−1 запись')
  })

  it('сводка перечисляет все разделы документа', () => {
    expect(summarize(base()).map((s) => s.label)).toEqual([
      'колесо',
      'трекер',
      'привычки',
      'идеи',
      'книги',
      'учёба',
      'смотреть',
      'расходы',
    ])
  })
})
