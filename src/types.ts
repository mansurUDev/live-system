export type Category = 'work' | 'health' | 'rest' | 'byt' | 'sleep'
export type SectorKind = 'sphere' | 'number' | 'steps'
export type Period = 'day' | 'week' | 'month'
export type Tab = 'wheel' | 'track' | 'an' | 'arch'

export interface HistoryRec {
  /** ISO-момент записи */
  d: string
  /** процент выполнения на момент записи */
  p: number
  label: string
  /** значение числовой цели; у сфер и этапов отсутствует */
  v?: number
}

export interface Step {
  id: string
  text: string
  done: boolean
}

export interface Sector {
  id: string
  name: string
  color: string
  kind: SectorKind
  /** sphere: оценка 1..10 */
  value: number
  /** number: текущее значение */
  current: number
  /** number: целевое значение */
  target: number
  /** number: единица измерения */
  unit: string
  /** steps: чек-лист этапов */
  steps: Step[]
  /** новые записи в начале массива */
  history: HistoryRec[]
  createdAt: string
  /** цель уже отпраздновала достижение 100% */
  celebrated: boolean
  /** связанная категория трекера — для подсказок в аналитике */
  cat: Category | null
}

export interface Activity {
  id: string
  name: string
  color: string
  cat: Category
}

export interface TimeEntry {
  id: string
  actId: string
  start: string
  /** null — запись идёт прямо сейчас; такая запись может быть только одна */
  end: string | null
}

export interface ArchiveRec {
  id: string
  name: string
  color: string
  kindLabel: string
  startedAt: string
  completedAt: string
  summary: string
}

export interface SnapshotSector {
  id: string
  name: string
  color: string
  p: number
}

export interface Snapshot {
  d: string
  sectors: SnapshotSector[]
}

/** Ключ — локальная дата YYYY-MM-DD */
export type Snapshots = Record<string, Snapshot>

export interface Doc {
  v: 1
  sectors: Sector[]
  acts: Activity[]
  entries: TimeEntry[]
  archive: ArchiveRec[]
  snapshots: Snapshots
}

/** Отрезок времени, обрезанный по окну наблюдения */
export interface Seg {
  actId: string
  s: number
  e: number
}
