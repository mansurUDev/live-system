import {
  HEX_RE,
  MAX_ACT_NAME,
  MAX_ACTS,
  MAX_ARCHIVE,
  MAX_ENTRIES,
  MAX_HISTORY,
  MAX_NAME,
  MAX_SECTORS,
  MAX_SNAPSHOT_DAYS,
  MAX_STEP_TEXT,
  MAX_STEPS,
  MAX_UNIT,
  PAL,
  CATS,
} from '../constants'
import { defaultDoc } from './defaults'
import { normFinance, normHabits, normLibrary } from './normalizeModules'
import { clamp } from './pct'
import { DOC_VERSION } from '../types'
import type {
  Activity,
  ArchiveRec,
  Category,
  Doc,
  HistoryRec,
  Sector,
  SectorKind,
  Snapshots,
  Step,
  TimeEntry,
} from '../types'

const KINDS: SectorKind[] = ['sphere', 'number', 'steps']
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

type Unknown = Record<string, unknown>

function obj(x: unknown): Unknown {
  return x && typeof x === 'object' ? (x as Unknown) : {}
}

function str(x: unknown, max: number, fallback = ''): string {
  const s = typeof x === 'string' || typeof x === 'number' ? String(x) : ''
  return (s || fallback).slice(0, max)
}

function int(x: unknown, fallback: number, min: number, max: number): number {
  const n = Number(x)
  if (!Number.isFinite(n)) return fallback
  return clamp(Math.round(n), min, max)
}

function dec(x: unknown, fallback: number, min: number, max: number): number {
  const n = Number(x)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

/** Цвет попадает в inline style и в SVG fill, поэтому пропускаем только #rrggbb */
function color(x: unknown, i: number): string {
  return typeof x === 'string' && HEX_RE.test(x) ? x : PAL[i % PAL.length]!
}

function cat(x: unknown): Category | null {
  return typeof x === 'string' && x in CATS ? (x as Category) : null
}

function iso(x: unknown, fallback: string): string {
  if (typeof x !== 'string') return fallback
  const t = new Date(x).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback
}

function normSteps(x: unknown): Step[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_STEPS).map((raw, j) => {
    const t = obj(raw)
    return {
      id: str(t.id, 40, 't' + j),
      text: str(t.text, MAX_STEP_TEXT, 'Этап ' + (j + 1)),
      done: !!t.done,
    }
  })
}

function normHistory(x: unknown, fallbackIso: string): HistoryRec[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_HISTORY).map((raw) => {
    const h = obj(raw)
    const v = Number(h.v)
    const rec: HistoryRec = {
      d: iso(h.d, fallbackIso),
      p: int(h.p, 0, 0, 100),
      label: str(h.label, 120),
    }
    if (typeof h.v === 'number' && Number.isFinite(v)) rec.v = v
    return rec
  })
}

function normSectors(x: unknown, nowIso: string): Sector[] {
  if (!Array.isArray(x)) return []
  return x.slice(0, MAX_SECTORS).map((raw, i) => {
    const s = obj(raw)
    const kind = KINDS.includes(s.kind as SectorKind) ? (s.kind as SectorKind) : 'sphere'
    return {
      id: str(s.id, 60, 's' + i),
      name: str(s.name, MAX_NAME, 'Сектор ' + (i + 1)),
      color: color(s.color, i),
      kind,
      value: int(s.value, 5, 1, 10),
      current: dec(s.current, 0, 0, 1e12),
      target: dec(s.target, 0, 0, 1e12),
      unit: str(s.unit, MAX_UNIT),
      steps: normSteps(s.steps),
      history: normHistory(s.history, nowIso),
      createdAt: iso(s.createdAt, nowIso),
      celebrated: !!s.celebrated,
      cat: cat(s.cat),
    }
  })
}

function normActs(x: unknown, fallback: Activity[]): Activity[] {
  if (!Array.isArray(x)) return fallback
  return x.slice(0, MAX_ACTS).map((raw, i) => {
    const a = obj(raw)
    return {
      id: str(a.id, 60, 'act' + i),
      name: str(a.name, MAX_ACT_NAME, 'Кнопка ' + (i + 1)),
      color: color(a.color, i),
      cat: cat(a.cat) ?? 'byt',
    }
  })
}

/**
 * Записи времени: битые даты отбрасываются, конец не может быть раньше начала,
 * список сортируется по началу и обрезается до свежих. Идущей записи может быть
 * только одна — все предыдущие «зависшие» закрываются.
 */
function normEntries(x: unknown): TimeEntry[] {
  if (!Array.isArray(x)) return []

  const parsed: TimeEntry[] = []
  for (const [i, raw] of x.entries()) {
    const e = obj(raw)
    const s = new Date(String(e.start)).getTime()
    if (!Number.isFinite(s)) continue

    let end: string | null = null
    if (e.end != null) {
      const t = new Date(String(e.end)).getTime()
      end = Number.isFinite(t) ? new Date(Math.max(t, s)).toISOString() : new Date(s).toISOString()
    }
    parsed.push({
      id: str(e.id, 60, 'e' + i),
      actId: str(e.actId, 60),
      start: new Date(s).toISOString(),
      end,
    })
  }

  parsed.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const list = parsed.slice(-MAX_ENTRIES)

  let seenRunning = false
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]!
    if (e.end) continue
    if (seenRunning) list[i] = { ...e, end: e.start }
    seenRunning = true
  }
  return list
}

function normArchive(x: unknown, nowIso: string): ArchiveRec[] {
  if (!Array.isArray(x)) return []
  return x.slice(-MAX_ARCHIVE).map((raw, i) => {
    const a = obj(raw)
    return {
      id: str(a.id, 60, 'ar' + i),
      name: str(a.name, MAX_NAME),
      color: color(a.color, i),
      kindLabel: str(a.kindLabel, 40),
      startedAt: iso(a.startedAt, nowIso),
      completedAt: iso(a.completedAt, nowIso),
      summary: str(a.summary, 120),
    }
  })
}

/**
 * Снимки колеса по дням. Ключи-неформаты отбрасываются — заодно это отсекает
 * `__proto__` и прочие служебные имена из чужого JSON.
 */
function normSnapshots(x: unknown, nowIso: string): Snapshots {
  const src = obj(x)
  const out: Snapshots = {}
  const keys = Object.keys(src)
    .filter((k) => DAY_KEY_RE.test(k))
    .sort()
    .slice(-MAX_SNAPSHOT_DAYS)

  for (const k of keys) {
    const snap = obj(src[k])
    const list = Array.isArray(snap.sectors) ? snap.sectors : []
    out[k] = {
      d: iso(snap.d, nowIso),
      sectors: list.slice(0, MAX_SECTORS).map((raw, i) => {
        const s = obj(raw)
        return {
          id: str(s.id, 60, 's' + i),
          name: str(s.name, MAX_NAME),
          color: color(s.color, i),
          p: int(s.p, 0, 0, 100),
        }
      }),
    }
  }
  return out
}

/**
 * Приведение произвольных данных к валидному документу текущей версии.
 *
 * Единая точка санитайзинга: через неё проходит и загрузка из localStorage, и
 * импорт файла, и приезжающее из облака. Каждый объект собирается литералом с
 * явным перечислением полей, поэтому посторонние ключи из чужого JSON (включая
 * `__proto__`) не проходят.
 *
 * Переход со старых версий бесшовный: документ первой версии просто не содержал
 * привычек, финансов и библиотеки — они добавляются пустыми, остальное
 * сохраняется как было. Функция идемпотентна.
 */
export function normalize(input: unknown, now: number = Date.now()): Doc {
  const d = obj(input)
  if (!Array.isArray(d.sectors)) return defaultDoc(now)

  const nowIso = new Date(now).toISOString()
  return {
    v: DOC_VERSION,
    sectors: normSectors(d.sectors, nowIso),
    acts: normActs(d.acts, defaultDoc(now).acts),
    entries: normEntries(d.entries),
    archive: normArchive(d.archive, nowIso),
    snapshots: normSnapshots(d.snapshots, nowIso),
    habits: normHabits(d.habits, nowIso),
    fin: normFinance(d.fin, now),
    lib: normLibrary(d.lib, nowIso),
  }
}
