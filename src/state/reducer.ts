import { MAX_ENTRIES, MAX_HISTORY, MAX_ARCHIVE } from '../constants'
import { kindLabel, pct, summary } from '../logic/pct'
import { runningEntry } from '../logic/segs'
import { withTodaySnapshot } from '../logic/snapshot'
import { num } from '../logic/time'
import type {
  Activity,
  ArchiveRec,
  Category,
  Doc,
  HistoryRec,
  Sector,
  TimeEntry,
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
  | { type: 'addSector'; sector: Sector; now: number }
  | { type: 'removeSector'; id: string; now: number }
  | { type: 'archiveSector'; id: string; archiveId: string; now: number }
  | { type: 'dismissCelebration' }
  | { type: 'pressAct'; actId: string; entryId: string; now: number }
  | { type: 'stopTrack'; now: number }
  | { type: 'saveAct'; act: Activity; now: number }
  | { type: 'deleteAct'; id: string; now: number }
  | { type: 'saveEntry'; entry: TimeEntry; now: number }
  | { type: 'deleteEntry'; id: string; now: number }

function isoAtLeast(now: number, notBefore: string): string {
  const start = new Date(notBefore).getTime()
  const t = Number.isFinite(start) ? Math.max(now, start) : now
  return new Date(t).toISOString()
}

/** Дописывает запись в историю сектора; процент берётся уже после изменения */
function pushHistory(s: Sector, label: string, now: number): Sector {
  const rec: HistoryRec = {
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
        const unit = s.unit ? ' ' + s.unit : ''
        const label = sign + num(Math.abs(action.delta)) + unit + ' → ' + num(current)
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

    case 'addSector':
      return { ...doc, sectors: [...doc.sectors, action.sector] }

    case 'removeSector':
      return { ...doc, sectors: doc.sectors.filter((s) => s.id !== action.id) }

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
      return { ...doc, acts: doc.acts.filter((a) => a.id !== action.id), entries }
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
