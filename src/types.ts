export type Category = 'work' | 'health' | 'rest' | 'byt' | 'sleep'
export type SectorKind = 'sphere' | 'number' | 'steps'
export type Period = 'day' | 'week' | 'month'
export type Tab = 'brief' | 'wheel' | 'track' | 'habits' | 'fin' | 'lib' | 'an' | 'arch'

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

/** Привычка: «делаю каждый день» либо «держусь без» */
export type HabitType = 'do' | 'quit'

export interface Habit {
  id: string
  type: HabitType
  name: string
  color: string
  /** do: дни, когда отмечено (ключи YYYY-MM-DD) */
  done: string[]
  /** do: лучшая серия подряд */
  record: number
  /** quit: момент последнего срыва — от него растёт счётчик */
  start: string
  /** quit: лучшая серия без срывов, в днях */
  best: number
  createdAt: string
}

/** Обязательный ежемесячный расход */
export interface MandatoryExpense {
  id: string
  name: string
  amount: number
}

/** Разовый запланированный расход с датой */
export interface OneTimeExpense {
  id: string
  name: string
  amount: number
  /** YYYY-MM-DD; пустая строка — дата не назначена */
  date: string
}

export interface Finance {
  /** планка минимального дохода в месяц */
  goal: number
  /** получено в текущем месяце */
  got: number
  /** месяц, к которому относится got (YYYY-MM) */
  monthKey: string
  /** выполнено ли по месяцам */
  hist: Record<string, boolean>
  /** денег на руках — вводится вручную при сверке */
  onHand: number
  /** неприкосновенный запас на непредвиденное */
  cushion: number
  /** дата следующего поступления, YYYY-MM-DD */
  nextIncome: string
  mandatory: MandatoryExpense[]
  oneTime: OneTimeExpense[]
}

export interface LibNote {
  d: string
  text: string
}

export interface Book {
  id: string
  title: string
  author: string
  color: string
  pageCur: number
  pageTotal: number
  /** минуты аудиокниги */
  audioCur: number
  audioTotal: number
  /** отрывок, на котором остановился */
  excerpt: string
  notes: LibNote[]
  startedAt: string
}

export interface CourseSection {
  id: string
  text: string
  done: boolean
}

export interface Course {
  id: string
  title: string
  platform: string
  color: string
  /** где остановился: номер лекции или название раздела */
  pos: string
  minute: number
  sections: CourseSection[]
  notes: LibNote[]
  startedAt: string
}

export interface LibDone {
  id: string
  kind: 'book' | 'course'
  title: string
  byline: string
  color: string
  startedAt: string
  finishedAt: string
  quote: string
}

export interface Library {
  books: Book[]
  courses: Course[]
  done: LibDone[]
}

/** Текущая версия схемы документа */
export const DOC_VERSION = 2

export interface Doc {
  v: number
  sectors: Sector[]
  acts: Activity[]
  entries: TimeEntry[]
  archive: ArchiveRec[]
  snapshots: Snapshots
  habits: Habit[]
  fin: Finance
  lib: Library
}

/** Отрезок времени, обрезанный по окну наблюдения */
export interface Seg {
  actId: string
  s: number
  e: number
}
