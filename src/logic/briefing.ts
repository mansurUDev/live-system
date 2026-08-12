import { money } from './currency'
import { financeCalc, type FinanceCalc } from './finance'
import { daysWithout, hoursToRisk, isDoneToday, riskSoon, streak } from './habits'
import { daysOverdue, isOverdue } from './reminders'
import type { Doc, Habit } from '../types'

export type Urgency = 'calm' | 'warn' | 'hot'

export interface Priority {
  urgency: Urgency
  tag: string
  title: string
  sub: string
  /** куда ведёт нажатие */
  tab: 'fin' | 'habits' | 'wheel' | 'track'
}

/** Серия, которой стоит дорожить: короткие обрывать не жалко */
const STREAK_AT_RISK = 3

interface Candidate extends Priority {
  score: number
}

/**
 * Что показать наверху брифинга.
 *
 * Приложение не вываливает все цифры разом, а выбирает одно: ближайший
 * денежный срок или серию привычек, которая вот-вот оборвётся. Вес растёт к
 * вечеру — утром напоминать про несделанное рано.
 */
export function pickPriority(doc: Doc, now: number = Date.now()): Priority {
  const fc = financeCalc(doc.fin, { currency: doc.currency, rates: doc.rates }, now)
  const hour = new Date(now).getHours()
  const cands: Candidate[] = []

  if (fc.nearest && fc.nearestDays !== null) {
    const d = fc.nearestDays
    cands.push({
      score: d <= 2 ? 3 : d <= 7 ? 2 : 1,
      urgency: d <= 2 ? 'hot' : d <= 7 ? 'warn' : 'calm',
      tag: 'финансы',
      tab: 'fin',
      title: `До «${fc.nearest.name}» — ${d === 0 ? 'сегодня' : d + ' дн.'}`,
      sub: `нужно ${money(fc.nearest.amount, fc.nearest.currency)} — сумма уже вычтена из дневного лимита`,
    })
  }

  const risky = doc.habits
    .filter((h) => h.type === 'do' && !isDoneToday(h, now))
    .map((h) => ({ h, s: streak(h, now) }))
    .filter((x) => x.s >= STREAK_AT_RISK)
    .sort((a, b) => b.s - a.s)[0]

  if (risky) {
    const score = hour >= 18 ? 3 : hour >= 12 ? 2 : 1.5
    cands.push({
      score,
      urgency: score >= 3 ? 'hot' : 'warn',
      tag: 'привычки',
      tab: 'habits',
      title: `Серия по «${risky.h.name}» — ${risky.s} дн.`,
      sub: 'не разорви сегодня — отметь до полуночи',
    })
  }

  // час риска: предупреждение приходит, пока решение ещё можно принять, —
  // «поздно вспомнил» и есть та проблема, которую этот кандидат закрывает
  const atRisk = doc.habits
    .filter((h) => riskSoon(h, now))
    .filter((h) => (h.type === 'do' ? !isDoneToday(h, now) : h.type === 'quit'))
    .map((h) => ({ h, left: hoursToRisk(h.riskHour!, now) }))
    .sort((a, b) => a.left - b.left)[0]

  if (atRisk) {
    const { h, left } = atRisk
    const when = left === 0 ? 'уже сейчас' : left === 1 ? 'через час' : `к ${h.riskHour}:00`
    cands.push({
      score: left === 0 ? 3.5 : 3,
      urgency: 'hot',
      tag: 'час риска',
      tab: 'habits',
      title: h.type === 'quit' ? `«${h.name}» — опасное время ${when}` : `«${h.name}» — ${when} будет поздно`,
      sub:
        h.type === 'quit'
          ? `серия ${daysWithout(h, now)} дн. на кону — реши заранее, а не в момент`
          : 'сделай сейчас, пока день не растворился',
    })
  }

  const overdueReminder = doc.reminders
    .filter((r) => isOverdue(r, now))
    .sort((a, b) => daysOverdue(b, now) - daysOverdue(a, now))[0]

  if (overdueReminder) {
    const by = daysOverdue(overdueReminder, now)
    cands.push({
      score: by >= 14 ? 2.5 : 1.5,
      urgency: by >= 14 ? 'hot' : 'warn',
      tag: 'напоминание',
      tab: 'habits',
      title: `«${overdueReminder.name}» просрочено на ${by} дн.`,
      sub: 'загляни и отметь выполненным, когда обновишь',
    })
  }

  cands.sort((a, b) => b.score - a.score)
  const top = cands[0]
  if (top && top.score > 1) return top

  return calmPriority(doc, fc)
}

function calmPriority(doc: Doc, fc: FinanceCalc): Priority {
  const dos = doc.habits.filter((h) => h.type === 'do')
  const bits: string[] = []
  if (fc.limit > 0) bits.push(`можно ${money(fc.limit, doc.currency)} сегодня`)
  if (dos.length) bits.push(`привычки: ${dos.filter((h) => isDoneToday(h)).length} из ${dos.length}`)

  return {
    urgency: 'calm',
    tag: 'всё ровно',
    tab: 'fin',
    title: 'Всё ровно — день под контролем',
    sub: bits.join(' · ') || 'хорошего дня',
  }
}

/**
 * Привычки, которые показываются прямо в брифинге.
 *
 * Неотмеченные идут первыми: именно они требуют действия, а отмеченные лишь
 * подтверждают уже сделанное. Без этого шестая по списку привычка не попадала
 * на главный экран вовсе, даже если была единственной несделанной.
 */
export function todayHabits(doc: Doc, limit = 8, now: number = Date.now()): Habit[] {
  const dos = doc.habits.filter((h) => h.type === 'do')
  const undone = dos.filter((h) => !isDoneToday(h, now))
  const done = dos.filter((h) => isDoneToday(h, now))
  return [...undone, ...done].slice(0, limit)
}

/**
 * Подсказки «куда дальше»: то, что ещё не сделано сегодня, и незакрытые этапы
 * ближайшей цели. Показываем максимум две — список дел тут не нужен.
 */
export function nextSteps(doc: Doc, now: number = Date.now(), limit = 2): string[] {
  const out: string[] = []

  for (const h of doc.habits) {
    if (h.type === 'do' && !isDoneToday(h, now)) {
      out.push(`«${h.name}» сегодня ещё не отмечено`)
      if (out.length >= limit) return out
    }
  }

  for (const s of doc.sectors) {
    if (s.kind !== 'steps') continue
    const left = s.steps.filter((t) => !t.done).length
    if (left > 0) {
      out.push(`До «${s.name}» осталось ${left} эт.`)
      if (out.length >= limit) return out
    }
  }

  return out
}
