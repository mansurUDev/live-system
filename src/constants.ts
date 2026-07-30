import type { Category } from './types'

export const LS_KEY = 'sistema-zhizni-v1'
export const BACKUP_KEY = 'sistema-zhizni-v1-backup'

/** Палитра секторов и кнопок-активностей */
export const PAL = [
  '#22d3ee',
  '#34d399',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#60a5fa',
  '#2dd4bf',
  '#fb923c',
  '#f87171',
  '#e2e8f0',
] as const

export const CATS: Record<Category, { label: string; color: string }> = {
  work: { label: 'Работа', color: '#22d3ee' },
  health: { label: 'Здоровье', color: '#34d399' },
  rest: { label: 'Отдых', color: '#a78bfa' },
  byt: { label: 'Быт', color: '#fbbf24' },
  sleep: { label: 'Сон', color: '#818cf8' },
}

export const CAT_KEYS = Object.keys(CATS) as Category[]

/** Псевдокатегория для записей без категории и по удалённым кнопкам */
export const OTHER = { label: 'Прочее', color: '#64748b' }

export const DELETED_ACT = { name: '(удалённая)', color: '#64748b' }

export const MAX_SECTORS = 16
export const MAX_ACTS = 40
export const MAX_STEPS = 40
export const MAX_ENTRIES = 4000
export const MAX_ARCHIVE = 300
export const MAX_HISTORY = 80
export const MAX_SNAPSHOT_DAYS = 180

export const MAX_NAME = 60
export const MAX_ACT_NAME = 40
export const MAX_STEP_TEXT = 90
export const MAX_UNIT = 14

export const MAX_HABITS = 30
export const MAX_HABIT_NAME = 50
/** сколько отметок хранит привычка — с запасом больше года */
export const MAX_HABIT_DAYS = 500

export const MAX_MANDATORY = 40
export const MAX_ONETIME = 60
export const MAX_EXPENSE_NAME = 60

export const MAX_BOOKS = 30
export const MAX_COURSES = 30
export const MAX_LIB_DONE = 100
export const MAX_SECTIONS = 40
export const MAX_NOTES = 40
export const MAX_NOTE_TEXT = 400
export const MAX_TITLE = 80
export const MAX_BYLINE = 60
export const MAX_EXCERPT = 400
export const MAX_QUOTE = 300

/** Ключ, под которым лежит код доступа текущей сессии */
export const CODE_KEY = 'sistema-zhizni-code'

/** Сдвиги для быстрой отметки задним числом, минуты */
export const BACKDATE_OFFSETS = [5, 15, 30]

/** Подсказка срабатывает, если на связанную категорию за неделю потрачено меньше */
export const HINT_THRESHOLD_MS = 30 * 60 * 1000

/** Окно, по которому считается темп числовой цели */
export const FORECAST_WINDOW_DAYS = 14

/** Горизонт графика «Динамика сфер» */
export const SPHERE_CHART_DAYS = 30

export const DAY_MS = 86400000

/** Предел размера импортируемого файла */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

export const HEX_RE = /^#[0-9a-fA-F]{6}$/
