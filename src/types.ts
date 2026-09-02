export type Category = 'work' | 'health' | 'rest' | 'byt' | 'sleep'
export type SectorKind = 'sphere' | 'number' | 'steps'
export type Period = 'day' | 'week' | 'month'
export type Tab =
  | 'brief'
  | 'wheel'
  | 'track'
  | 'habits'
  | 'fin'
  | 'books'
  | 'lib'
  | 'watch'
  | 'an'
  | 'arch'
  | 'ideas'

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
  /** в горячем ряду — хранится только как true, открепление удаляет поле совсем */
  pinned?: boolean
  /** id кнопки, которая обычно идёт следом («дальше → …» в RunningBar);
   *  хранится только когда ссылка валидна — на себя и в никуда не бывает */
  nextId?: string
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

/** Привычка: «делаю каждый день», «держусь без» либо «замер» — число без оценки */
export type HabitType = 'do' | 'quit' | 'log'

/** Запись о срыве: когда и почему. Причина — необязательная строка в одну мысль */
export interface Slip {
  d: string
  why: string
}

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
  /**
   * quit: журнал срывов. Обнулённый счётчик выглядит как чистый лист и
   * позволяет забыть, что это уже пятый раз, — журнал не позволяет.
   */
  slips: Slip[]
  /**
   * Час, к которому обычно случается срыв или становится поздно (0–23);
   * брифинг предупреждает заранее, пока решение ещё можно принять. null — не задан.
   */
  riskHour: number | null
  /** log: отметка по дням — минуты от полуночи (время отбоя и т.п.), ключ YYYY-MM-DD */
  logs: Record<string, number>
  /** заметка со ссылками в разметке телеграма: `[подпись](адрес)`; пусто — нет */
  note: string
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
  /** своя валюта у каждого расхода: подписка в долларах, аренда в сумах */
  currency: CurrencyCode
  /** число месяца, когда списывается: 1–31; 0 — не задано */
  day: number
}

/** Разовый запланированный расход с датой */
export interface OneTimeExpense {
  id: string
  name: string
  amount: number
  currency: CurrencyCode
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
  /** где слушаю: ссылка на плеер аудиокниги; пусто — нет */
  audioLink: string
  /** отрывок, на котором остановился */
  excerpt: string
  /** план по прочтению: дата, к которой хочешь дочитать; YYYY-MM-DD, пусто — без срока */
  targetDate: string
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

/** Встроенные виды; категория записи — любая строка, эти шесть просто с готовыми подписями */
export type ShowKind = 'film' | 'series' | 'dorama' | 'anime' | 'cartoon' | 'documentary'

export interface Show {
  id: string
  title: string
  /** категория: встроенный вид или своя строка («Стендапы», «Лекции»…) */
  kind: string
  color: string
  /** для сериалов/аниме/мультфильмов; у фильма всегда 0 */
  season: number
  episode: number
  minute: number
  /** где смотрю — необязательно */
  link: string
  /** внешний рейтинг (Кинопоиск/IMDb/MAL), 0–10 с шагом 0.1; 0 — не указан */
  rating: number
  /** насколько хочется посмотреть, 1–10; 10 уезжает в отсек «в первую очередь»; 0 — не задан */
  priority: number
  /** «не хочу смотреть»: хранится только как true — запись уезжает на нижнюю полку */
  dropped?: boolean
  startedAt: string
  /** момент последнего сохранения — по нему список сортируется, свежее сверху */
  updatedAt: string
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

/** Сколько единиц внутренней базы стоит одна единица валюты; база — та, у которой курс 1 */
export type Rates = Record<CurrencyCode, number>

export interface IdeaLink {
  id: string
  url: string
  /** название или домен — то, что видно вместо голой ссылки */
  label: string
}

/** Пункт чек-листа воплощения — деталь/шаг, часто с ценой и местом покупки прямо в тексте */
export interface IdeaCheck {
  id: string
  text: string
  done: boolean
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
  /** что нужно, чтобы воплотить: деталь, шаг — каждый со своей отметкой */
  checklist: IdeaCheck[]
  /** воплощена в жизнь */
  done: boolean
  /**
   * Приоритетная: показывается наверху и отмечена звездой. Хранится только
   * как true — снятие удаляет поле совсем, чтобы normalize оставался
   * неподвижной точкой (та же договорённость, что у кнопок трекера).
   */
  pinned?: boolean
  createdAt: string
}

/** Текущая версия схемы документа */
export const DOC_VERSION = 13

export interface Doc {
  v: number
  /** валюта отображения: в ней хранятся суммы «на руках», планка и запас, в неё же сводятся расходы */
  currency: CurrencyCode
  /** курсы валют, вводятся вручную; по ним расходы в чужой валюте пересчитываются в валюту отображения */
  rates: Rates
  /** убрать «Смотреть» из навигации — раздел остаётся доступен по скрытому переходу из шапки */
  hideWatch: boolean
  /** id обводки приоритетных карточек «Смотреть» — см. PREMIUM_STYLES */
  premiumStyle: string
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
