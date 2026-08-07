import {
  HOT_MAX,
  MAX_ARCHIVE,
  MAX_BOOKS,
  MAX_COURSES,
  MAX_ENTRIES,
  MAX_HABITS,
  MAX_HISTORY,
  MAX_IDEAS,
  MAX_LIB_DONE,
  MAX_MANDATORY,
  MAX_NOTES,
  MAX_ONETIME,
  MAX_REMINDERS,
  MAX_SHOWS,
  MAX_VIDEOS,
  SHOW_KIND_LABELS,
} from '../constants'
import { moveActTo, type MoveTarget } from '../logic/actLayout'
import { money } from '../logic/currency'
import { rollMonth } from '../logic/finance'
import { resetQuit, toggleToday } from '../logic/habits'
import { kindLabel, pct, summary } from '../logic/pct'
import { markDone } from '../logic/reminders'
import { runningEntry } from '../logic/segs'
import { withTodaySnapshot } from '../logic/snapshot'
import { num } from '../logic/time'
import { uid } from '../logic/uid'
import type {
  Activity,
  ArchiveRec,
  Book,
  Category,
  Course,
  CurrencyCode,
  Doc,
  Finance,
  Habit,
  HistoryRec,
  Idea,
  LibDone,
  LibNote,
  MandatoryExpense,
  OneTimeExpense,
  Reminder,
  Sector,
  Show,
  TimeEntry,
  Video,
} from '../types'

export interface AppState {
  doc: Doc
  /** цель, только что взявшая 100% — показывается поздравление */
  celebratingId: string | null
}

export type Action =
  | { type: 'replaceDoc'; doc: Doc; now: number }
  | { type: 'ensureSnapshot'; now: number }
  /** живое перетаскивание ползунка — без записи в историю */
  | { type: 'setSphere'; id: string; value: number; now: number }
  /** отпускание ползунка — фиксирует оценку в истории */
  | { type: 'commitSphere'; id: string; now: number }
  | { type: 'stepSphere'; id: string; delta: number; now: number }
  | { type: 'addAmount'; id: string; delta: number; now: number }
  | { type: 'toggleStep'; id: string; stepId: string; now: number }
  | { type: 'setSectorCat'; id: string; cat: Category | null; now: number }
  | { type: 'deleteHistoryEntry'; id: string; historyId: string; now: number }
  | { type: 'setQuickAmounts'; id: string; amounts: number[]; now: number }
  | { type: 'addSector'; sector: Sector; now: number }
  | { type: 'removeSector'; id: string; now: number }
  | { type: 'archiveSector'; id: string; archiveId: string; now: number }
  | { type: 'patchDoc'; patch: Partial<Pick<Doc, 'currency' | 'rates'>>; now: number }
  | { type: 'dismissCelebration' }
  | { type: 'pressAct'; actId: string; entryId: string; now: number }
  | { type: 'stopTrack'; now: number }
  | { type: 'saveAct'; act: Activity; now: number }
  | { type: 'deleteAct'; id: string; now: number }
  | { type: 'toggleActPin'; id: string; now: number }
  | { type: 'moveAct'; id: string; target: MoveTarget; index: number; now: number }
  | { type: 'saveEntry'; entry: TimeEntry; now: number }
  | { type: 'deleteEntry'; id: string; now: number }
  // привычки
  | { type: 'toggleHabit'; id: string; now: number }
  | { type: 'breakQuit'; id: string; now: number }
  | { type: 'saveHabit'; habit: Habit; now: number }
  | { type: 'deleteHabit'; id: string; now: number }
  // напоминания
  | { type: 'saveReminder'; reminder: Reminder; now: number }
  | { type: 'deleteReminder'; id: string; now: number }
  | { type: 'markReminderDone'; id: string; now: number }
  // идеи
  | { type: 'saveIdea'; idea: Idea; now: number }
  | { type: 'deleteIdea'; id: string; now: number }
  // финансы
  | { type: 'patchFinance'; patch: Partial<Finance>; now: number }
  | { type: 'rollFinanceMonth'; now: number }
  | { type: 'saveMandatory'; item: MandatoryExpense; now: number }
  | { type: 'deleteMandatory'; id: string; now: number }
  | { type: 'saveOneTime'; item: OneTimeExpense; now: number }
  | { type: 'deleteOneTime'; id: string; now: number }
  // библиотека
  | { type: 'saveBook'; book: Book; now: number }
  | { type: 'saveCourse'; course: Course; now: number }
  | { type: 'saveVideo'; video: Video; now: number }
  | { type: 'saveShow'; show: Show; now: number }
  | { type: 'toggleSection'; courseId: string; sectionId: string; now: number }
  | { type: 'addNote'; kind: 'book' | 'course'; id: string; note: LibNote; now: number }
  | {
      type: 'finishLibItem'
      kind: 'book' | 'course' | 'video' | 'show'
      id: string
      doneId: string
      quote: string
      now: number
    }
  | { type: 'deleteLibItem'; kind: 'book' | 'course' | 'video' | 'show'; id: string; now: number }

/**
 * Действия, которые диспатчатся сами — при загрузке страницы или из ответа
 * облака, без прямого участия пользователя. Используется синхронизацией,
 * чтобы отличить «человек что-то поправил, пока шёл первый pull» от
 * «страница просто открылась» — иначе от pull, пришедшего чуть позже
 * действия человека, эта правка была бы затёрта. Новое авто-действие обязано
 * попасть сюда, иначе гонка при загрузке вернётся.
 */
export const AUTO_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'replaceDoc',
  'ensureSnapshot',
  'rollFinanceMonth',
  'dismissCelebration',
])

function isoAtLeast(now: number, notBefore: string): string {
  const start = new Date(notBefore).getTime()
  const t = Number.isFinite(start) ? Math.max(now, start) : now
  return new Date(t).toISOString()
}

/** Дописывает запись в историю сектора; процент берётся уже после изменения */
function pushHistory(s: Sector, label: string, now: number): Sector {
  const rec: HistoryRec = {
    id: uid('hr'),
    d: new Date(now).toISOString(),
    p: pct(s),
    label,
    ...(s.kind === 'number' ? { v: s.current } : null),
  }
  return { ...s, history: [rec, ...s.history].slice(0, MAX_HISTORY) }
}

function mapSector(doc: Doc, id: string, fn: (s: Sector) => Sector): Doc {
  return { ...doc, sectors: doc.sectors.map((s) => (s.id === id ? fn(s) : s)) }
}

/** Закрывает все незавершённые записи; конец не может оказаться раньше начала */
function closeOpen(entries: TimeEntry[], now: number): TimeEntry[] {
  return entries.map((e) => (e.end ? e : { ...e, end: isoAtLeast(now, e.start) }))
}

function coreReducer(doc: Doc, action: Action): Doc {
  switch (action.type) {
    case 'replaceDoc':
      return action.doc

    case 'ensureSnapshot':
      return doc

    case 'setSphere':
      return mapSector(doc, action.id, (s) =>
        s.kind === 'sphere' ? { ...s, value: action.value } : s,
      )

    case 'commitSphere':
      return mapSector(doc, action.id, (s) =>
        s.kind === 'sphere' ? pushHistory(s, 'оценка ' + s.value + '/10', action.now) : s,
      )

    case 'stepSphere':
      return mapSector(doc, action.id, (s) => {
        if (s.kind !== 'sphere') return s
        const value = Math.max(1, Math.min(10, s.value + action.delta))
        if (value === s.value) return s
        return pushHistory({ ...s, value }, 'оценка ' + value + '/10', action.now)
      })

    case 'addAmount':
      return mapSector(doc, action.id, (s) => {
        if (s.kind !== 'number') return s
        const current = Math.max(0, Math.round((s.current + action.delta) * 100) / 100)
        const sign = action.delta > 0 ? '+' : '−'
        const abs = Math.abs(action.delta)
        const label = s.isMoney
          ? sign + money(abs, s.unit as CurrencyCode) + ' → ' + money(current, s.unit as CurrencyCode)
          : sign + num(abs) + (s.unit ? ' ' + s.unit : '') + ' → ' + num(current)
        return pushHistory({ ...s, current }, label, action.now)
      })

    case 'toggleStep':
      return mapSector(doc, action.id, (s) => {
        if (s.kind !== 'steps') return s
        const target = s.steps.find((t) => t.id === action.stepId)
        if (!target) return s
        const done = !target.done
        const steps = s.steps.map((t) => (t.id === action.stepId ? { ...t, done } : t))
        const label = (done ? '✓ ' : '— ') + target.text.slice(0, 32)
        return pushHistory({ ...s, steps }, label, action.now)
      })

    case 'setSectorCat':
      return mapSector(doc, action.id, (s) => ({ ...s, cat: action.cat }))

    case 'deleteHistoryEntry':
      return mapSector(doc, action.id, (s) => ({
        ...s,
        history: s.history.filter((h) => h.id !== action.historyId),
      }))

    case 'setQuickAmounts':
      return mapSector(doc, action.id, (s) => ({ ...s, quickAmounts: action.amounts }))

    case 'addSector':
      return { ...doc, sectors: [...doc.sectors, action.sector] }

    case 'removeSector':
      return { ...doc, sectors: doc.sectors.filter((s) => s.id !== action.id) }

    case 'patchDoc':
      return { ...doc, ...action.patch }

    case 'archiveSector': {
      const s = doc.sectors.find((x) => x.id === action.id)
      if (!s) return doc
      const rec: ArchiveRec = {
        id: action.archiveId,
        name: s.name,
        color: s.color,
        kindLabel: kindLabel(s.kind),
        startedAt: s.createdAt,
        completedAt: new Date(action.now).toISOString(),
        summary: summary(s),
      }
      return {
        ...doc,
        sectors: doc.sectors.filter((x) => x.id !== action.id),
        archive: [rec, ...doc.archive].slice(0, MAX_ARCHIVE),
      }
    }

    case 'pressAct': {
      const run = runningEntry(doc.entries)
      if (run && run.actId === action.actId) return doc
      const started = new Date(action.now).toISOString()
      const entries = [
        ...closeOpen(doc.entries, action.now),
        { id: action.entryId, actId: action.actId, start: started, end: null },
      ]
      return { ...doc, entries: entries.slice(-MAX_ENTRIES) }
    }

    case 'stopTrack': {
      if (!runningEntry(doc.entries)) return doc
      return { ...doc, entries: closeOpen(doc.entries, action.now) }
    }

    case 'saveAct': {
      const exists = doc.acts.some((a) => a.id === action.act.id)
      return {
        ...doc,
        acts: exists
          ? doc.acts.map((a) => (a.id === action.act.id ? action.act : a))
          : [...doc.acts, action.act],
      }
    }

    case 'deleteAct': {
      // Записи не удаляем — в аналитике они станут «прочим»; идущую закрываем.
      const entries = doc.entries.map((e) =>
        e.actId === action.id && !e.end ? { ...e, end: isoAtLeast(action.now, e.start) } : e,
      )
      // ссылки «дальше → удалённая» уходят совсем — ключ удаляется, как pinned при откреплении
      const acts = doc.acts
        .filter((a) => a.id !== action.id)
        .map((a) => {
          if (a.nextId !== action.id) return a
          const copy = { ...a }
          delete copy.nextId
          return copy
        })
      return { ...doc, acts, entries }
    }

    case 'toggleActPin': {
      const act = doc.acts.find((a) => a.id === action.id)
      if (!act) return doc
      if (act.pinned) {
        // поле уходит совсем: normalize всё равно срезал бы pinned:false
        return {
          ...doc,
          acts: doc.acts.map((a) => {
            if (a.id !== action.id) return a
            const copy = { ...a }
            delete copy.pinned
            return copy
          }),
        }
      }
      // девятую не берём: тост показывает контейнер, редьюсер просто не меняет doc
      if (doc.acts.filter((a) => a.pinned).length >= HOT_MAX) return doc
      return { ...doc, acts: doc.acts.map((a) => (a.id === action.id ? { ...a, pinned: true } : a)) }
    }

    case 'moveAct': {
      const res = moveActTo(doc.acts, action.id, action.target, action.index)
      // отказ (переполнение) и no-op не трогают doc: тосты показывает контейнер
      if (!res.ok || res.acts === doc.acts) return doc
      return { ...doc, acts: res.acts }
    }

    case 'saveEntry': {
      const exists = doc.entries.some((e) => e.id === action.entry.id)
      const entries = exists
        ? doc.entries.map((e) => (e.id === action.entry.id ? action.entry : e))
        : [...doc.entries, action.entry]
      entries.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
      return { ...doc, entries: entries.slice(-MAX_ENTRIES) }
    }

    case 'deleteEntry':
      return { ...doc, entries: doc.entries.filter((e) => e.id !== action.id) }

    case 'toggleHabit':
      return {
        ...doc,
        habits: doc.habits.map((h) => (h.id === action.id ? toggleToday(h, action.now) : h)),
      }

    case 'breakQuit':
      return {
        ...doc,
        habits: doc.habits.map((h) => (h.id === action.id ? resetQuit(h, action.now) : h)),
      }

    case 'saveHabit': {
      const exists = doc.habits.some((h) => h.id === action.habit.id)
      return {
        ...doc,
        habits: exists
          ? doc.habits.map((h) => (h.id === action.habit.id ? action.habit : h))
          : [...doc.habits, action.habit].slice(0, MAX_HABITS),
      }
    }

    case 'deleteHabit':
      return { ...doc, habits: doc.habits.filter((h) => h.id !== action.id) }

    case 'saveReminder': {
      const exists = doc.reminders.some((r) => r.id === action.reminder.id)
      return {
        ...doc,
        reminders: exists
          ? doc.reminders.map((r) => (r.id === action.reminder.id ? action.reminder : r))
          : [...doc.reminders, action.reminder].slice(0, MAX_REMINDERS),
      }
    }

    case 'deleteReminder':
      return { ...doc, reminders: doc.reminders.filter((r) => r.id !== action.id) }

    case 'markReminderDone':
      return {
        ...doc,
        reminders: doc.reminders.map((r) => (r.id === action.id ? markDone(r, action.now) : r)),
      }

    case 'saveIdea': {
      const exists = doc.ideas.some((i) => i.id === action.idea.id)
      return {
        ...doc,
        ideas: exists
          ? doc.ideas.map((i) => (i.id === action.idea.id ? action.idea : i))
          : [...doc.ideas, action.idea].slice(0, MAX_IDEAS),
      }
    }

    case 'deleteIdea':
      return { ...doc, ideas: doc.ideas.filter((i) => i.id !== action.id) }

    case 'patchFinance':
      return { ...doc, fin: { ...doc.fin, ...action.patch } }

    case 'rollFinanceMonth':
      return { ...doc, fin: rollMonth(doc.fin, action.now) }

    case 'saveMandatory': {
      const list = doc.fin.mandatory
      const exists = list.some((x) => x.id === action.item.id)
      return {
        ...doc,
        fin: {
          ...doc.fin,
          mandatory: exists
            ? list.map((x) => (x.id === action.item.id ? action.item : x))
            : [...list, action.item].slice(0, MAX_MANDATORY),
        },
      }
    }

    case 'deleteMandatory':
      return {
        ...doc,
        fin: { ...doc.fin, mandatory: doc.fin.mandatory.filter((x) => x.id !== action.id) },
      }

    case 'saveOneTime': {
      const list = doc.fin.oneTime
      const exists = list.some((x) => x.id === action.item.id)
      return {
        ...doc,
        fin: {
          ...doc.fin,
          oneTime: exists
            ? list.map((x) => (x.id === action.item.id ? action.item : x))
            : [...list, action.item].slice(0, MAX_ONETIME),
        },
      }
    }

    case 'deleteOneTime':
      return {
        ...doc,
        fin: { ...doc.fin, oneTime: doc.fin.oneTime.filter((x) => x.id !== action.id) },
      }

    case 'saveBook': {
      const exists = doc.lib.books.some((b) => b.id === action.book.id)
      return {
        ...doc,
        lib: {
          ...doc.lib,
          books: exists
            ? doc.lib.books.map((b) => (b.id === action.book.id ? action.book : b))
            : [...doc.lib.books, action.book].slice(0, MAX_BOOKS),
        },
      }
    }

    case 'saveCourse': {
      const exists = doc.lib.courses.some((c) => c.id === action.course.id)
      return {
        ...doc,
        lib: {
          ...doc.lib,
          courses: exists
            ? doc.lib.courses.map((c) => (c.id === action.course.id ? action.course : c))
            : [...doc.lib.courses, action.course].slice(0, MAX_COURSES),
        },
      }
    }

    case 'saveVideo': {
      const exists = doc.lib.videos.some((v) => v.id === action.video.id)
      return {
        ...doc,
        lib: {
          ...doc.lib,
          videos: exists
            ? doc.lib.videos.map((v) => (v.id === action.video.id ? action.video : v))
            : [...doc.lib.videos, action.video].slice(0, MAX_VIDEOS),
        },
      }
    }

    case 'saveShow': {
      const exists = doc.lib.shows.some((s) => s.id === action.show.id)
      return {
        ...doc,
        lib: {
          ...doc.lib,
          shows: exists
            ? doc.lib.shows.map((s) => (s.id === action.show.id ? action.show : s))
            : [...doc.lib.shows, action.show].slice(0, MAX_SHOWS),
        },
      }
    }

    case 'toggleSection':
      return {
        ...doc,
        lib: {
          ...doc.lib,
          courses: doc.lib.courses.map((c) =>
            c.id !== action.courseId
              ? c
              : {
                  ...c,
                  sections: c.sections.map((s) =>
                    s.id === action.sectionId ? { ...s, done: !s.done } : s,
                  ),
                },
          ),
        },
      }

    case 'addNote': {
      const put = <T extends { id: string; notes: LibNote[] }>(list: T[]): T[] =>
        list.map((x) =>
          x.id === action.id ? { ...x, notes: [action.note, ...x.notes].slice(0, MAX_NOTES) } : x,
        )
      return {
        ...doc,
        lib:
          action.kind === 'book'
            ? { ...doc.lib, books: put(doc.lib.books) }
            : { ...doc.lib, courses: put(doc.lib.courses) },
      }
    }

    case 'finishLibItem': {
      const item =
        action.kind === 'book'
          ? doc.lib.books.find((b) => b.id === action.id)
          : action.kind === 'course'
            ? doc.lib.courses.find((c) => c.id === action.id)
            : action.kind === 'video'
              ? doc.lib.videos.find((v) => v.id === action.id)
              : doc.lib.shows.find((s) => s.id === action.id)
      if (!item) return doc

      const byline =
        action.kind === 'book'
          ? (item as Book).author
          : action.kind === 'course'
            ? (item as Course).platform
            : action.kind === 'video'
              ? (item as Video).channel
              : SHOW_KIND_LABELS[(item as Show).kind]
      // у видео и шоу нет startedAt-до-начала — очередь на посмотреть начинается с момента добавления
      const startedAt =
        action.kind === 'video' ? (item as Video).addedAt : (item as Book | Course | Show).startedAt

      const rec: LibDone = {
        id: action.doneId,
        kind: action.kind,
        title: item.title,
        byline,
        color: item.color,
        startedAt,
        finishedAt: new Date(action.now).toISOString(),
        quote: action.quote,
      }
      return {
        ...doc,
        lib: {
          ...doc.lib,
          books: action.kind === 'book' ? doc.lib.books.filter((b) => b.id !== action.id) : doc.lib.books,
          courses:
            action.kind === 'course' ? doc.lib.courses.filter((c) => c.id !== action.id) : doc.lib.courses,
          videos: action.kind === 'video' ? doc.lib.videos.filter((v) => v.id !== action.id) : doc.lib.videos,
          shows: action.kind === 'show' ? doc.lib.shows.filter((s) => s.id !== action.id) : doc.lib.shows,
          done: [rec, ...doc.lib.done].slice(0, MAX_LIB_DONE),
        },
      }
    }

    case 'deleteLibItem':
      return {
        ...doc,
        lib: {
          ...doc.lib,
          books: action.kind === 'book' ? doc.lib.books.filter((b) => b.id !== action.id) : doc.lib.books,
          courses:
            action.kind === 'course' ? doc.lib.courses.filter((c) => c.id !== action.id) : doc.lib.courses,
          videos: action.kind === 'video' ? doc.lib.videos.filter((v) => v.id !== action.id) : doc.lib.videos,
          shows: action.kind === 'show' ? doc.lib.shows.filter((s) => s.id !== action.id) : doc.lib.shows,
        },
      }

    case 'dismissCelebration':
      return doc
  }
}

/** Действия, после которых у затронутой цели проверяется взятие 100% */
function celebrationTarget(action: Action): string | null {
  switch (action.type) {
    case 'addAmount':
    case 'toggleStep':
      return action.id
    default:
      return null
  }
}

/**
 * Досборка документа после каждого действия: снимок дня и переход цели через
 * 100%.
 *
 * Поздравление ловится именно на переходе (было меньше 100 — стало 100), а не по
 * текущему проценту в рендере: иначе конфетти сыпались бы при каждом открытии
 * вкладки и при импорте уже выполненной цели.
 */
function finalize(prev: Doc, next: Doc, action: Action): AppState {
  let doc = next
  let celebratingId: string | null = null

  const targetId = celebrationTarget(action)
  if (targetId) {
    const before = prev.sectors.find((s) => s.id === targetId)
    const after = doc.sectors.find((s) => s.id === targetId)
    if (before && after && after.kind !== 'sphere') {
      const wasDone = pct(before) >= 100
      const isDone = pct(after) >= 100
      if (isDone && !wasDone && !after.celebrated) {
        doc = mapSector(doc, targetId, (s) => ({ ...s, celebrated: true }))
        celebratingId = targetId
      } else if (!isDone && after.celebrated) {
        doc = mapSector(doc, targetId, (s) => ({ ...s, celebrated: false }))
      }
    }
  }

  const now = 'now' in action ? action.now : Date.now()
  doc = { ...doc, snapshots: withTodaySnapshot(doc.snapshots, doc.sectors, now) }
  return { doc, celebratingId }
}

export function reducer(state: AppState, action: Action): AppState {
  if (action.type === 'dismissCelebration') return { ...state, celebratingId: null }

  const next = coreReducer(state.doc, action)
  const finalized = finalize(state.doc, next, action)

  // Поздравление держится открытым, пока пользователь его не закроет, но исчезает
  // вместе с самим сектором и при замене всего документа.
  let celebratingId = finalized.celebratingId ?? state.celebratingId
  if (action.type === 'replaceDoc') celebratingId = null
  if (
    (action.type === 'archiveSector' || action.type === 'removeSector') &&
    celebratingId === action.id
  ) {
    celebratingId = null
  }

  return { doc: finalized.doc, celebratingId }
}

export function initialState(doc: Doc): AppState {
  return { doc, celebratingId: null }
}
