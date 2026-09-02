import { plural } from './time'
import type { Doc } from '../types'

export interface DocSummary {
  label: string
  count: number
  /** формы слова для числа: одна запись / две записи / пять записей */
  forms: [string, string, string]
}

/** Из чего состоит документ — по этим числам версия узнаётся без открытия */
export function summarize(doc: Doc): DocSummary[] {
  return [
    { label: 'колесо', count: doc.sectors.length, forms: ['цель', 'цели', 'целей'] },
    { label: 'трекер', count: doc.entries.length, forms: ['запись', 'записи', 'записей'] },
    { label: 'привычки', count: doc.habits.length, forms: ['привычка', 'привычки', 'привычек'] },
    { label: 'идеи', count: doc.ideas.length, forms: ['идея', 'идеи', 'идей'] },
    { label: 'книги', count: doc.lib.books.length, forms: ['книга', 'книги', 'книг'] },
    { label: 'учёба', count: doc.lib.courses.length + doc.lib.videos.length, forms: ['запись', 'записи', 'записей'] },
    { label: 'смотреть', count: doc.lib.shows.length, forms: ['запись', 'записи', 'записей'] },
    {
      label: 'расходы',
      count: doc.fin.mandatory.length + doc.fin.oneTime.length,
      forms: ['расход', 'расхода', 'расходов'],
    },
  ]
}

/**
 * Чем версия отличается от текущего состояния.
 *
 * Показывается именно разница, а не абсолютные числа: «−3 идеи» сразу говорит,
 * что откат заберёт, а «14 идей» требует помнить, сколько их сейчас.
 */
export function diffSummary(current: Doc, other: Doc): string[] {
  const now = summarize(current)
  return summarize(other)
    .map((s, i) => ({ ...s, delta: s.count - now[i]!.count }))
    .filter((s) => s.delta !== 0)
    .map((s) => {
      const n = Math.abs(s.delta)
      return `${s.delta > 0 ? '+' : '−'}${n} ${plural(n, ...s.forms)}`
    })
}
