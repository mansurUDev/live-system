import {
  HEX_RE,
  IDEA_CATEGORY_SUGGESTIONS,
  MAX_BOOKS,
  MAX_BYLINE,
  MAX_COURSES,
  MAX_EXCERPT,
  MAX_EXPENSE_NAME,
  MAX_HABIT_DAYS,
  MAX_HABIT_NAME,
  MAX_HABITS,
  MAX_IDEA_CATEGORY,
  MAX_IDEA_IMAGES,
  MAX_IDEA_LINK_LABEL,
  MAX_IDEA_LINKS,
  MAX_IDEA_TEXT,
  MAX_IDEA_TITLE,
  MAX_IDEAS,
  MAX_LIB_DONE,
  MAX_MANDATORY,
  MAX_NOTE_TEXT,
  MAX_NOTES,
  MAX_ONETIME,
  MAX_QUOTE,
  MAX_REMINDER_INTERVAL_DAYS,
  MAX_REMINDER_NAME,
  MAX_REMINDERS,
  MAX_SECTIONS,
  MAX_SHOW_NUMBER,
  MAX_SHOWS,
  MAX_TITLE,
  MAX_VIDEO_NOTE,
  MAX_VIDEO_URL,
  MAX_VIDEOS,
  MIN_REMINDER_INTERVAL_DAYS,
  DEFAULT_REMINDER_INTERVAL_DAYS,
  PAL,
  SHOW_KINDS,
} from '../constants'
import { monthKeyOf } from './time'
import type {
  Book,
  Course,
  Finance,
  Habit,
  Idea,
  IdeaLink,
  Library,
  LibDone,
  LibNote,
  MandatoryExpense,
  OneTimeExpense,
  Reminder,
  Show,
  Video,
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

/** Только http/https — иначе ссылка или превью могли бы принести javascript: из испорченного JSON */
function safeUrl(x: unknown, max: number): string {
  if (typeof x !== 'string' || !x) return ''
  try {
    const parsed = new URL(x)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
  } catch {
    return ''
  }
  return x.slice(0, max)
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

function intervalDays(x: unknown): number {
  const n = Number(x)
  if (!Number.isFinite(n)) return DEFAULT_REMINDER_INTERVAL_DAYS
  return Math.max(MIN_REMINDER_INTERVAL_DAYS, Math.min(Math.round(n), MAX_REMINDER_INTERVAL_DAYS))
}

function isoOrNull(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const t = new Date(x).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

export function normReminders(x: unknown, nowIso: string): Reminder[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_REMINDERS).map((raw, i) => {
    const r = obj(raw)
    return {
      id: str(r.id, 60, 'rm' + i),
      name: str(r.name, MAX_REMINDER_NAME, 'Напоминание ' + (i + 1)),
      intervalDays: intervalDays(r.intervalDays),
      lastDone: isoOrNull(r.lastDone),
      createdAt: iso(r.createdAt, nowIso),
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

function showNumber(x: unknown): number {
  return Math.min(count(x), MAX_SHOW_NUMBER)
}

export function emptyLibrary(): Library {
  return { books: [], courses: [], videos: [], shows: [], done: [] }
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

  const videos: Video[] = Array.isArray(l.videos)
    ? l.videos.slice(0, MAX_VIDEOS).map((raw, i) => {
        const v = obj(raw)
        return {
          id: str(v.id, 60, 'v' + i),
          url: safeUrl(v.url, MAX_VIDEO_URL),
          title: str(v.title, MAX_TITLE, 'Видео'),
          channel: str(v.channel, MAX_BYLINE),
          thumbnail: safeUrl(v.thumbnail, MAX_VIDEO_URL),
          color: color(v.color, i + 6),
          note: str(v.note, MAX_VIDEO_NOTE),
          addedAt: iso(v.addedAt, nowIso),
        }
      })
    : []

  const shows: Show[] = Array.isArray(l.shows)
    ? l.shows.slice(0, MAX_SHOWS).map((raw, i) => {
        const s = obj(raw)
        return {
          id: str(s.id, 60, 'sh' + i),
          title: str(s.title, MAX_TITLE, 'Без названия'),
          kind: (SHOW_KINDS as string[]).includes(s.kind as string) ? (s.kind as Show['kind']) : 'film',
          color: color(s.color, i + 9),
          season: showNumber(s.season),
          episode: showNumber(s.episode),
          minute: showNumber(s.minute),
          link: safeUrl(s.link, MAX_VIDEO_URL),
          startedAt: iso(s.startedAt, nowIso),
        }
      })
    : []

  const DONE_KINDS = new Set(['book', 'course', 'video', 'show'])
  const done: LibDone[] = Array.isArray(l.done)
    ? l.done.slice(0, MAX_LIB_DONE).map((raw, i) => {
        const d = obj(raw)
        return {
          id: str(d.id, 60, 'ld' + i),
          kind: (DONE_KINDS.has(d.kind as string) ? d.kind : 'book') as LibDone['kind'],
          title: str(d.title, MAX_TITLE, '—'),
          byline: str(d.byline, MAX_BYLINE),
          color: color(d.color, i),
          startedAt: iso(d.startedAt, nowIso),
          finishedAt: iso(d.finishedAt, nowIso),
          quote: str(d.quote, MAX_QUOTE),
        }
      })
    : []

  return { books, courses, videos, shows, done }
}

export function normIdeas(x: unknown, nowIso: string): Idea[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_IDEAS).map((raw, i) => {
    const it = obj(raw)
    const links: IdeaLink[] = Array.isArray(it.links)
      ? it.links
          .slice(0, MAX_IDEA_LINKS)
          .map((rawL, j) => {
            const l = obj(rawL)
            return {
              id: str(l.id, 60, 'il' + j),
              url: safeUrl(l.url, MAX_VIDEO_URL),
              label: str(l.label, MAX_IDEA_LINK_LABEL),
            }
          })
          .filter((l) => l.url)
      : []
    const images: string[] = Array.isArray(it.images)
      ? it.images
          .slice(0, MAX_IDEA_IMAGES)
          .map((raw2) => safeUrl(raw2, MAX_VIDEO_URL))
          .filter(Boolean)
      : []

    return {
      id: str(it.id, 60, 'i' + i),
      title: str(it.title, MAX_IDEA_TITLE, 'Идея'),
      category: str(it.category, MAX_IDEA_CATEGORY, IDEA_CATEGORY_SUGGESTIONS[2]!),
      text: str(it.text, MAX_IDEA_TEXT),
      links,
      images,
      done: !!it.done,
      createdAt: iso(it.createdAt, nowIso),
    }
  })
}
