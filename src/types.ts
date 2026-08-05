export type Category = 'work' | 'health' | 'rest' | 'byt' | 'sleep'
export type SectorKind = 'sphere' | 'number' | 'steps'
export type Period = 'day' | 'week' | 'month'
export type Tab = 'brief' | 'wheel' | 'track' | 'habits' | 'fin' | 'lib' | 'an' | 'arch' | 'ideas'

export interface HistoryRec {
  id: string
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
  /** number: единица измерения — если isMoney, хранит код валюты */
  unit: string
  /** number: сектор в деньгах — unit тогда код валюты, отображение через money() */
  isMoney: boolean
  /** number: суммы быстрых кнопок +N в панели */
  quickAmounts: number[]
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

/** Периодическое напоминание — не привычка на каждый день, а «раз в N дней» */
export interface Reminder {
  id: string
  name: string
  /** через сколько дней после последней отметки считается просроченным */
  intervalDays: number
  /** ISO момент последней отметки; null — ни разу не отмечался с создания */
  lastDone: string | null
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

/** Видео на посмотреть позже — без прогресса и позиции, только добавил → посмотрел */
export interface Video {
  id: string
  url: string
  title: string
  /** из oEmbed author_name; пусто, если не удалось получить */
  channel: string
  /** пусто, если превью не нашлось — не YouTube или сеть недоступна; тогда вместо неё цветной квадрат */
  thumbnail: string
  color: string
  /** личная пометка — зачем сохранил; необязательна */
  note: string
  addedAt: string
}

/** Фильм / сериал / аниме / мультфильм — очередь на посмотреть с позицией */
export type ShowKind = 'film' | 'series' | 'anime' | 'cartoon'

export interface Show {
  id: string
  title: string
  kind: ShowKind
  color: string
  /** для сериалов/аниме/мультфильмов; у фильма всегда 0 */
  season: number
  episode: number
  minute: number
  /** где смотрю — необязательно */
  link: string
  startedAt: string
}

export interface LibDone {
  id: string
  kind: 'book' | 'course' | 'video' | 'show'
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
  videos: Video[]
  shows: Show[]
  done: LibDone[]
}

/** Фиксированный список поддерживаемых валют */
export type CurrencyCode = 'UZS' | 'USD' | 'EUR' | 'RUB'

export interface IdeaLink {
  id: string
  url: string
  /** название или домен — то, что видно вместо голой ссылки */
  label: string
}

/** Идея на будущее — заметка + фото + ссылки, без срока и без прогресса */
export interface Idea {
  id: string
  title: string
  /** своя категория текстом — «Ардуино», «Кулинария» и т.п. */
  category: string
  text: string
  links: IdeaLink[]
  /** URL в Supabase Storage — в документе только адреса */
  images: string[]
  /** воплощена в жизнь */
  done: boolean
  createdAt: string
}

/** Текущая версия схемы документа */
export const DOC_VERSION = 5

export interface Doc {
  v: number
  /** валюта отображения — общая для Финансов и денежных целей на колесе */
  currency: CurrencyCode
  /** курс каждой валюты к фиксированной внутренней базе; вводится вручную, ни в одном расчёте пока не участвует */
  rates: Record<CurrencyCode, number>
  sectors: Sector[]
  acts: Activity[]
  entries: TimeEntry[]
  archive: ArchiveRec[]
  snapshots: Snapshots
  habits: Habit[]
  reminders: Reminder[]
  ideas: Idea[]
  fin: Finance
  lib: Library
}

/** Отрезок времени, обрезанный по окну наблюдения */
export interface Seg {
  actId: string
  s: number
  e: number
}
