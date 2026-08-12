import type { MoveTarget } from '../logic/actLayout'
import { uid } from '../logic/uid'
import type { Action } from './reducer'
import { DEFAULT_REMINDER_INTERVAL_DAYS } from '../constants'
import type {
  Activity,
  Book,
  Category,
  Course,
  Doc,
  Finance,
  Habit,
  HabitType,
  Idea,
  IdeaLink,
  MandatoryExpense,
  OneTimeExpense,
  Reminder,
  Sector,
  Show,
  ShowKind,
  TimeEntry,
  Video,
} from '../types'

/**
 * Границы записей времени живут с точностью до минуты: кнопка, нажатая в
 * 6:04:37, писала бы 6:04:37, а ручная правка оперирует «6:04» — и невидимые
 * секунды давали ложные пересечения при редактировании соседних записей.
 */
function minuteStart(backMinutes = 0): number {
  const t = Date.now() - backMinutes * 60_000
  return t - (t % 60_000)
}

/**
 * Создатели действий — единственное место, где берётся текущее время и
 * генерируются идентификаторы. Благодаря этому редьюсер остаётся чистым и
 * полностью проверяемым в тестах.
 */
export const A = {
  replaceDoc: (doc: Doc): Action => ({ type: 'replaceDoc', doc, now: Date.now() }),

  setSphere: (id: string, value: number): Action => ({
    type: 'setSphere',
    id,
    value,
    now: Date.now(),
  }),
  commitSphere: (id: string): Action => ({ type: 'commitSphere', id, now: Date.now() }),
  stepSphere: (id: string, delta: number): Action => ({
    type: 'stepSphere',
    id,
    delta,
    now: Date.now(),
  }),
  addAmount: (id: string, delta: number): Action => ({
    type: 'addAmount',
    id,
    delta,
    now: Date.now(),
  }),
  toggleStep: (id: string, stepId: string): Action => ({
    type: 'toggleStep',
    id,
    stepId,
    now: Date.now(),
  }),
  setSectorCat: (id: string, cat: Category | null): Action => ({
    type: 'setSectorCat',
    id,
    cat,
    now: Date.now(),
  }),
  deleteHistoryEntry: (id: string, historyId: string): Action => ({
    type: 'deleteHistoryEntry',
    id,
    historyId,
    now: Date.now(),
  }),
  setQuickAmounts: (id: string, amounts: number[]): Action => ({
    type: 'setQuickAmounts',
    id,
    amounts,
    now: Date.now(),
  }),
  addSector: (sector: Sector): Action => ({ type: 'addSector', sector, now: Date.now() }),
  removeSector: (id: string): Action => ({ type: 'removeSector', id, now: Date.now() }),
  archiveSector: (id: string): Action => ({
    type: 'archiveSector',
    id,
    archiveId: uid('ar'),
    now: Date.now(),
  }),
  patchDoc: (patch: Partial<Pick<Doc, 'currency' | 'rates' | 'hideWatch'>>): Action => ({
    type: 'patchDoc',
    patch,
    now: Date.now(),
  }),
  dismissCelebration: (): Action => ({ type: 'dismissCelebration' }),

  /**
   * Нажатие кнопки активности. backMinutes сдвигает момент перехода назад —
   * для случая «пришёл домой, а телефон достал позже»: предыдущий отрезок
   * закроется тем же временем, что и начнётся новый.
   */
  pressAct: (actId: string, backMinutes = 0): Action => ({
    type: 'pressAct',
    actId,
    entryId: uid('e'),
    now: minuteStart(backMinutes),
  }),
  stopTrack: (): Action => ({ type: 'stopTrack', now: minuteStart() }),
  saveAct: (act: Activity): Action => ({ type: 'saveAct', act, now: Date.now() }),
  deleteAct: (id: string): Action => ({ type: 'deleteAct', id, now: minuteStart() }),
  toggleActPin: (id: string): Action => ({ type: 'toggleActPin', id, now: Date.now() }),
  moveAct: (id: string, target: MoveTarget, index: number): Action => ({
    type: 'moveAct',
    id,
    target,
    index,
    now: Date.now(),
  }),
  saveEntry: (entry: TimeEntry): Action => ({ type: 'saveEntry', entry, now: Date.now() }),
  deleteEntry: (id: string): Action => ({ type: 'deleteEntry', id, now: Date.now() }),

  toggleHabit: (id: string): Action => ({ type: 'toggleHabit', id, now: Date.now() }),
  breakQuit: (id: string, why: string = ''): Action => ({ type: 'breakQuit', id, why, now: Date.now() }),
  logHabit: (id: string, minutes: number): Action => ({ type: 'logHabit', id, minutes, now: Date.now() }),
  saveHabit: (habit: Habit): Action => ({ type: 'saveHabit', habit, now: Date.now() }),
  deleteHabit: (id: string): Action => ({ type: 'deleteHabit', id, now: Date.now() }),
  newHabit: (type: HabitType, name: string, color: string): Habit => ({
    id: uid('h'),
    type,
    name,
    color,
    done: [],
    record: 0,
    start: new Date().toISOString(),
    best: 0,
    slips: [],
    riskHour: null,
    note: '',
    logs: {},
    createdAt: new Date().toISOString(),
  }),

  saveReminder: (reminder: Reminder): Action => ({ type: 'saveReminder', reminder, now: Date.now() }),
  deleteReminder: (id: string): Action => ({ type: 'deleteReminder', id, now: Date.now() }),
  markReminderDone: (id: string): Action => ({ type: 'markReminderDone', id, now: Date.now() }),
  newReminder: (name: string, intervalDays: number = DEFAULT_REMINDER_INTERVAL_DAYS): Reminder => ({
    id: uid('rm'),
    name,
    intervalDays,
    lastDone: null,
    createdAt: new Date().toISOString(),
  }),

  saveIdea: (idea: Idea): Action => ({ type: 'saveIdea', idea, now: Date.now() }),
  deleteIdea: (id: string): Action => ({ type: 'deleteIdea', id, now: Date.now() }),
  newIdea: (title: string, category: string, text: string, links: IdeaLink[], images: string[]): Idea => ({
    id: uid('i'),
    title,
    category,
    text,
    links,
    images,
    done: false,
    createdAt: new Date().toISOString(),
  }),
  newIdeaLink: (url: string, label: string): IdeaLink => ({ id: uid('il'), url, label }),

  patchFinance: (patch: Partial<Finance>): Action => ({ type: 'patchFinance', patch, now: Date.now() }),
  rollFinanceMonth: (): Action => ({ type: 'rollFinanceMonth', now: Date.now() }),
  saveMandatory: (item: MandatoryExpense): Action => ({ type: 'saveMandatory', item, now: Date.now() }),
  deleteMandatory: (id: string): Action => ({ type: 'deleteMandatory', id, now: Date.now() }),
  saveOneTime: (item: OneTimeExpense): Action => ({ type: 'saveOneTime', item, now: Date.now() }),
  deleteOneTime: (id: string): Action => ({ type: 'deleteOneTime', id, now: Date.now() }),
  payOneTime: (id: string): Action => ({ type: 'payOneTime', id, now: Date.now() }),
  newExpenseId: () => uid('x'),

  saveBook: (book: Book): Action => ({ type: 'saveBook', book, now: Date.now() }),
  saveCourse: (course: Course): Action => ({ type: 'saveCourse', course, now: Date.now() }),
  saveVideo: (video: Video): Action => ({ type: 'saveVideo', video, now: Date.now() }),
  saveShow: (show: Show): Action => ({ type: 'saveShow', show, now: Date.now() }),
  toggleSection: (courseId: string, sectionId: string): Action => ({
    type: 'toggleSection',
    courseId,
    sectionId,
    now: Date.now(),
  }),
  addNote: (kind: 'book' | 'course', id: string, text: string): Action => ({
    type: 'addNote',
    kind,
    id,
    note: { d: new Date().toISOString(), text },
    now: Date.now(),
  }),
  finishLibItem: (kind: 'book' | 'course' | 'video' | 'show', id: string, quote: string): Action => ({
    type: 'finishLibItem',
    kind,
    id,
    doneId: uid('ld'),
    quote,
    now: Date.now(),
  }),
  deleteLibItem: (kind: 'book' | 'course' | 'video' | 'show', id: string): Action => ({
    type: 'deleteLibItem',
    kind,
    id,
    now: Date.now(),
  }),
  newBook: (
    title: string,
    author: string,
    color: string,
    pageTotal: number,
    audioTotal: number,
    audioLink = '',
  ): Book => ({
    id: uid('b'),
    title,
    author,
    color,
    pageCur: 0,
    pageTotal,
    audioCur: 0,
    audioTotal,
    audioLink,
    excerpt: '',
    targetDate: '',
    notes: [],
    startedAt: new Date().toISOString(),
  }),
  newCourse: (title: string, platform: string, color: string, sections: string[]): Course => ({
    id: uid('c'),
    title,
    platform,
    color,
    pos: '',
    minute: 0,
    sections: sections.map((text, i) => ({ id: uid('cs' + i + '-'), text, done: false })),
    notes: [],
    startedAt: new Date().toISOString(),
  }),
  newVideo: (url: string, title: string, channel: string, thumbnail: string, color: string, note: string): Video => ({
    id: uid('v'),
    url,
    title,
    channel,
    thumbnail,
    color,
    note,
    addedAt: new Date().toISOString(),
  }),
  newShow: (title: string, kind: ShowKind, color: string, link: string): Show => ({
    id: uid('sh'),
    title,
    kind,
    color,
    season: 0,
    episode: 0,
    minute: 0,
    link,
    startedAt: new Date().toISOString(),
  }),
}
