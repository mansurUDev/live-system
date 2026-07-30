import {
  HEX_RE,
  MAX_BOOKS,
  MAX_BYLINE,
  MAX_COURSES,
  MAX_EXCERPT,
  MAX_EXPENSE_NAME,
  MAX_HABIT_DAYS,
  MAX_HABIT_NAME,
  MAX_HABITS,
  MAX_LIB_DONE,
  MAX_MANDATORY,
  MAX_NOTE_TEXT,
  MAX_NOTES,
  MAX_ONETIME,
  MAX_QUOTE,
  MAX_SECTIONS,
  MAX_TITLE,
  PAL,
} from '../constants'
import { monthKeyOf } from './time'
import type {
  Book,
  Course,
  Finance,
  Habit,
  Library,
  LibDone,
  LibNote,
  MandatoryExpense,
  OneTimeExpense,
} from '../types'

type Unknown = Record<string, unknown>

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY_RE = /^\d{4}-\d{2}$/

function obj(x: unknown): Unknown {
  return x && typeof x === 'object' ? (x as Unknown) : {}
}

function str(x: unknown, max: number, fallback = ''): string {
  const s = typeof x === 'string' || typeof x === 'number' ? String(x) : ''
  return (s || fallback).slice(0, max)
}

function money(x: unknown): number {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(n, 1e12))
}

function count(x: unknown): number {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(Math.round(n), 1e9))
}

function color(x: unknown, i: number): string {
  return typeof x === 'string' && HEX_RE.test(x) ? x : PAL[i % PAL.length]!
}

function iso(x: unknown, fallback: string): string {
  if (typeof x !== 'string') return fallback
  const t = new Date(x).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback
}

function dayKey(x: unknown): string {
  return typeof x === 'string' && DAY_KEY_RE.test(x) ? x : ''
}

function notes(x: unknown, nowIso: string): LibNote[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_NOTES).map((raw) => {
    const n = obj(raw)
    return { d: iso(n.d, nowIso), text: str(n.text, MAX_NOTE_TEXT) }
  })
}

export function normHabits(x: unknown, nowIso: string): Habit[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_HABITS).map((raw, i) => {
    const h = obj(raw)
    return {
      id: str(h.id, 60, 'h' + i),
      type: h.type === 'quit' ? 'quit' : 'do',
      name: str(h.name, MAX_HABIT_NAME, 'Привычка ' + (i + 1)),
      color: color(h.color, i),
      // отметки — только валидные ключи дней, без повторов
      done: Array.isArray(h.done)
        ? [...new Set(h.done.map(dayKey).filter(Boolean))].sort().slice(-MAX_HABIT_DAYS)
        : [],
      record: count(h.record),
      start: iso(h.start, nowIso),
      best: count(h.best),
      createdAt: iso(h.createdAt, nowIso),
    }
  })
}

export function emptyFinance(now: number): Finance {
  return {
    goal: 0,
    got: 0,
    monthKey: monthKeyOf(now),
    hist: {},
    onHand: 0,
    cushion: 0,
    nextIncome: '',
    mandatory: [],
    oneTime: [],
  }
}

export function normFinance(x: unknown, now: number): Finance {
  const f = obj(x)
  const empty = emptyFinance(now)
  if (!x || typeof x !== 'object') return empty

  const hist: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(obj(f.hist))) {
    if (MONTH_KEY_RE.test(k)) hist[k] = !!v
  }

  const mandatory: MandatoryExpense[] = Array.isArray(f.mandatory)
    ? f.mandatory.slice(0, MAX_MANDATORY).map((raw, i) => {
        const m = obj(raw)
        return {
          id: str(m.id, 60, 'm' + i),
          name: str(m.name, MAX_EXPENSE_NAME, '—'),
          amount: money(m.amount),
        }
      })
    : []

  const oneTime: OneTimeExpense[] = Array.isArray(f.oneTime)
    ? f.oneTime.slice(0, MAX_ONETIME).map((raw, i) => {
        const o = obj(raw)
        return {
          id: str(o.id, 60, 'o' + i),
          name: str(o.name, MAX_EXPENSE_NAME, '—'),
          amount: money(o.amount),
          date: dayKey(o.date),
        }
      })
    : []

  return {
    goal: money(f.goal),
    got: money(f.got),
    monthKey: typeof f.monthKey === 'string' && MONTH_KEY_RE.test(f.monthKey) ? f.monthKey : empty.monthKey,
    hist,
    onHand: money(f.onHand),
    cushion: money(f.cushion),
    nextIncome: dayKey(f.nextIncome),
    mandatory,
    oneTime,
  }
}

export function emptyLibrary(): Library {
  return { books: [], courses: [], done: [] }
}

export function normLibrary(x: unknown, nowIso: string): Library {
  const l = obj(x)

  const books: Book[] = Array.isArray(l.books)
    ? l.books.slice(0, MAX_BOOKS).map((raw, i) => {
        const b = obj(raw)
        return {
          id: str(b.id, 60, 'b' + i),
          title: str(b.title, MAX_TITLE, 'Книга'),
          author: str(b.author, MAX_BYLINE),
          color: color(b.color, i),
          pageCur: count(b.pageCur),
          pageTotal: count(b.pageTotal),
          audioCur: count(b.audioCur),
          audioTotal: count(b.audioTotal),
          excerpt: str(b.excerpt, MAX_EXCERPT),
          notes: notes(b.notes, nowIso),
          startedAt: iso(b.startedAt, nowIso),
        }
      })
    : []

  const courses: Course[] = Array.isArray(l.courses)
    ? l.courses.slice(0, MAX_COURSES).map((raw, i) => {
        const c = obj(raw)
        return {
          id: str(c.id, 60, 'c' + i),
          title: str(c.title, MAX_TITLE, 'Курс'),
          platform: str(c.platform, MAX_BYLINE),
          color: color(c.color, i + 3),
          pos: str(c.pos, MAX_TITLE),
          minute: count(c.minute),
          sections: Array.isArray(c.sections)
            ? c.sections.slice(0, MAX_SECTIONS).map((rawS, j) => {
                const s = obj(rawS)
                return {
                  id: str(s.id, 60, 'cs' + j),
                  text: str(s.text, MAX_TITLE, 'Раздел ' + (j + 1)),
                  done: !!s.done,
                }
              })
            : [],
          notes: notes(c.notes, nowIso),
          startedAt: iso(c.startedAt, nowIso),
        }
      })
    : []

  const done: LibDone[] = Array.isArray(l.done)
    ? l.done.slice(0, MAX_LIB_DONE).map((raw, i) => {
        const d = obj(raw)
        return {
          id: str(d.id, 60, 'ld' + i),
          kind: d.kind === 'course' ? 'course' : 'book',
          title: str(d.title, MAX_TITLE, '—'),
          byline: str(d.byline, MAX_BYLINE),
          color: color(d.color, i),
          startedAt: iso(d.startedAt, nowIso),
          finishedAt: iso(d.finishedAt, nowIso),
          quote: str(d.quote, MAX_QUOTE),
        }
      })
    : []

  return { books, courses, done }
}
