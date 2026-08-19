import { DAY_MS } from '../constants'
import { money } from './currency'
import { nextChargeAt } from './finance'
import { numberForecast } from './forecast'
import { readingPlan } from './library'
import { daysOverdue } from './reminders'
import { startOfDay } from './time'
import type { Doc, Tab } from '../types'

/** Горизонт сводки: месяц вперёд — дальше планы всё равно меняются */
export const AGENDA_DAYS = 30

export interface AgendaItem {
  id: string
  /** момент срока */
  at: number
  /** дней до срока; отрицательное — уже просрочено */
  days: number
  title: string
  sub: string
  /** куда ведёт нажатие */
  tab: Tab
  color: string
}

/**
 * Что ждёт в ближайший месяц: сроки платежей, напоминания, книги и прогноз по
 * числовым целям — в одном списке по возрастанию даты.
 *
 * Просроченное не выбрасывается, а показывается первым с отрицательным числом
 * дней: срок, который прошёл, — самая нужная строка в сводке, а не наименее.
 * Считаем от начала суток, поэтому «сегодня» везде одинаково значит ноль дней,
 * независимо от времени открытия.
 */
export function agenda(doc: Doc, now: number = Date.now(), horizonDays = AGENDA_DAYS): AgendaItem[] {
  const today = startOfDay(now)
  const out: AgendaItem[] = []

  // Горизонт считается днями, а не миллисекундами: в поясах с переводом часов
  // сутки бывают длиной 23 или 25 часов, и срок ровно на границе выпадал из
  // сводки, хотя до него честные тридцать дней.
  const add = (item: AgendaItem) => {
    if (item.days > horizonDays) return
    out.push(item)
  }

  const daysTo = (at: number) => Math.round((startOfDay(at) - today) / DAY_MS)

  // ── запланированные расходы: и предстоящие, и просроченные без оплаты
  for (const o of doc.fin.oneTime) {
    if (!o.date) continue
    const at = new Date(o.date + 'T00:00:00').getTime()
    if (!Number.isFinite(at)) continue
    const d = daysTo(at)
    if (d < -horizonDays) continue
    add({
      id: 'exp-' + o.id,
      at,
      days: d,
      title: o.name,
      sub: money(o.amount, o.currency),
      tab: 'fin',
      color: d < 0 ? '#f87171' : '#fbbf24',
    })
  }

  // ── обязательные с числом месяца: подписка 14-го, аренда 1-го
  for (const m of doc.fin.mandatory) {
    const at = nextChargeAt(m.day, now)
    if (at === null) continue
    add({
      id: 'mand-' + m.id,
      at,
      days: daysTo(at),
      title: m.name,
      sub: money(m.amount, m.currency) + ' · каждый месяц',
      tab: 'fin',
      color: '#fbbf24',
    })
  }

  // ── напоминания: срок = последняя отметка + интервал
  for (const r of doc.reminders) {
    const over = daysOverdue(r, now)
    const at = today + -over * DAY_MS
    const d = -over
    if (d < -horizonDays) continue
    add({
      id: 'rem-' + r.id,
      at,
      days: d,
      title: r.name,
      sub: d < 0 ? 'просрочено' : `раз в ${r.intervalDays} дн.`,
      tab: 'habits',
      color: d < 0 ? '#f87171' : '#22d3ee',
    })
  }

  // ── книги со сроком «дочитать к»
  for (const b of doc.lib.books) {
    const plan = readingPlan(b, now)
    if (plan.kind === 'none' || plan.kind === 'done') continue
    const at = new Date(b.targetDate + 'T00:00:00').getTime()
    if (!Number.isFinite(at)) continue
    const d = daysTo(at)
    if (d < -horizonDays) continue
    add({
      id: 'book-' + b.id,
      at,
      days: d,
      title: b.title,
      sub:
        plan.kind === 'overdue'
          ? `осталось ${plan.pagesLeft} с.`
          : `по ${plan.perDay} с. в день, осталось ${plan.pagesLeft}`,
      tab: 'books',
      color: b.color,
    })
  }

  // ── числовые цели: прогноз достижения, если он попадает в горизонт
  for (const s of doc.sectors) {
    if (s.kind !== 'number') continue
    const f = numberForecast(s, now)
    if (f.kind !== 'ok') continue
    add({
      id: 'goal-' + s.id,
      at: f.targetAt,
      days: daysTo(f.targetAt),
      title: s.name,
      sub: `при нынешнем темпе — ${f.perDay} в день`,
      tab: 'wheel',
      color: s.color,
    })
  }

  return out.sort((a, b) => a.at - b.at)
}
