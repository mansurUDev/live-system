/**
 * Чистая логика бота-напоминалки: подсказать обновить статус трекера в ключевые
 * моменты дня — подъём, дорога на работу, сам приход на работу, дорога домой,
 * отбой.
 *
 * Файл самодостаточен: серверные функции Vercel собираются отдельно от
 * приложения, общих импортов с src/ нет.
 *
 * Правило важнее текста: бот молчит, если статус уже соответствует ожидаемому —
 * иначе он превращается в шум, который выключают через день. Окна слотов
 * намеренно широкие: дёргает GitHub Actions по расписанию раз в 20–30 минут, а
 * его собственный крон опаздывает и пропускает запуски, иногда на 10–15 минут.
 */

/** Подмножество активности, которого достаточно, чтобы понять её смысл */
export interface RemindAct {
  id: string
  name: string
  cat: string
}

export interface RemindEntry {
  actId: string
  start: string
  end: string | null
}

export interface RemindDoc {
  acts: RemindAct[]
  entries: RemindEntry[]
}

/** Местное время Ташкента — всегда UTC+5, часовых поясов с переводом стрелок в Узбекистане нет */
export interface TashNow {
  /** локальная дата YYYY-MM-DD */
  dayKey: string
  /** минут от полуночи, 0..1439 */
  minutes: number
  /** 0 — понедельник … 6 — воскресенье */
  weekday: number
}

const TASHKENT_OFFSET_MS = 5 * 3600_000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function tashkentNow(utcMs: number): TashNow {
  const d = new Date(utcMs + TASHKENT_OFFSET_MS)
  const dayKey = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  // getUTCDay(): 0=вс..6=сб → сдвигаем на понедельник=0
  const weekday = (d.getUTCDay() + 6) % 7
  return { dayKey, minutes, weekday }
}

/** Тот же день, сдвинутый на n суток (может быть отрицательным) */
export function dayKeyShift(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const t = Date.UTC(y!, m! - 1, d! + days)
  return `${new Date(t).getUTCFullYear()}-${pad2(new Date(t).getUTCMonth() + 1)}-${pad2(new Date(t).getUTCDate())}`
}

export interface RemindMessage {
  key: string
  text: string
}

/** Что означает идущая прямо сейчас запись — по названию кнопки (приложение личное, набор кнопок известен) */
type TrackKind = 'none' | 'sleep' | 'commute' | 'atwork' | 'homeward' | 'home' | 'other'

interface Running {
  kind: TrackKind
  /** минуты от полуночи по Ташкенту, когда запись началась */
  startMin: number
  /** началась в тот же локальный день, что и now */
  startedToday: boolean
}

function classifyAct(act: RemindAct | undefined): TrackKind {
  if (!act) return 'other'
  const name = act.name.toLowerCase()
  if (act.cat === 'sleep') return 'sleep'
  // «домой» проверяем раньше «дома» — иначе подстрока «дом» поймала бы обе кнопки не в том порядке
  if (/домой/.test(name)) return 'homeward'
  if (/на работу|в пути|дорог/.test(name)) return 'commute'
  if (/на работе/.test(name) || act.cat === 'work') return 'atwork'
  if (/дома/.test(name)) return 'home'
  return 'other'
}

/**
 * Распознанный статус дневного цикла — в отличие от 'none' (ничего не идёт) и
 * 'other' (что-то постороннее вроде «Приём лекарства»). Только такой статус,
 * начатый сегодня, можно считать осознанным ответом на вопрос слота — иначе
 * разовая запись мимо трекера гасила бы commute/work без всякой связи с делом.
 */
function isCycleKind(kind: TrackKind): boolean {
  return kind !== 'none' && kind !== 'other'
}

function runningState(doc: RemindDoc, now: TashNow): Running {
  const entry = doc.entries.find((e) => e.end === null)
  if (!entry) return { kind: 'none', startMin: -1, startedToday: false }

  const act = doc.acts.find((a) => a.id === entry.actId)
  const startMs = Date.parse(entry.start)
  if (!Number.isFinite(startMs)) return { kind: 'none', startMin: -1, startedToday: false }

  const startTash = tashkentNow(startMs)
  const startedToday = startTash.dayKey === now.dayKey
  // если запись началась не сегодня, её «минута начала» для сравнения с окном
  // сегодняшнего дня не нужна — окна проверяют либо kind, либо startedToday
  const startMin = startedToday ? startTash.minutes : -1

  return { kind: classifyAct(act), startMin, startedToday }
}

interface Slot {
  id: string
  fromMin: number
  toMin: number
  workdaysOnly: boolean
  text: string
  /** молчать, если верно — «статус уже соответствует ожидаемому» */
  silence: (r: Running) => boolean
}

const SLOTS: Slot[] = [
  {
    id: 'wake',
    fromMin: 5 * 60 + 10,
    toMin: 6 * 60 + 50,
    workdaysOnly: false,
    text: 'Доброе утро! В трекере всё ещё «Сон» — отметь подъём 🌅',
    // идущий сон, начатый сегодня совсем недавно (после 3 ночи) — это ночной
    // сон на исходе, а не досыпание; настоящий повод молчать один: сна сейчас нет
    silence: (r) => r.kind !== 'sleep',
  },
  {
    id: 'commute',
    fromMin: 5 * 60 + 55,
    toMin: 6 * 60 + 45,
    workdaysOnly: true,
    text: 'Сегодня рабочий день? Если выходишь — переключи трекер на дорогу 🚌',
    // startedToday гасит слот только для распознанных статусов дневного цикла:
    // разовая запись вроде «Приём лекарства» тоже startedToday, но ничего не
    // говорит про дорогу на работу и не должна выключать напоминание о ней
    silence: (r) => r.kind === 'sleep' || r.kind === 'commute' || r.kind === 'atwork' || (r.startedToday && isCycleKind(r.kind)),
  },
  {
    id: 'work',
    fromMin: 7 * 60 + 5,
    toMin: 8 * 60 + 15,
    workdaysOnly: true,
    text: 'Уже на работе? Отметь «На работе» 💼',
    // «в пути», зависшее с самого утра, — это ровно то, о чём слот должен
    // спросить, поэтому startedToday гасит всё распознанное, КРОМЕ незакрытого
    // commute; посторонняя запись (kind='other') не гасит вовсе — см. commute выше
    silence: (r) =>
      r.kind === 'sleep' || r.kind === 'atwork' || r.kind === 'homeward' || (r.startedToday && r.kind !== 'commute' && isCycleKind(r.kind)),
  },
  {
    id: 'home',
    fromMin: 17 * 60 + 5,
    toMin: 18 * 60 + 45,
    // без фильтра по будням: если по трекеру человек не на работе, он либо уже
    // переключился, либо сегодня и не работал — в обоих случаях слот сам гасится
    workdaysOnly: false,
    text: 'Едешь домой? Переключи трекер 🏠',
    silence: (r) => r.kind !== 'atwork' && r.kind !== 'commute',
  },
  {
    id: 'sleep',
    fromMin: 21 * 60 + 30,
    toMin: 23 * 60,
    workdaysOnly: false,
    text: 'Скоро подъём — не забудь отметить «Сон», когда ляжешь 😴',
    silence: (r) => r.kind === 'sleep',
  },
]

/**
 * Что слать прямо сейчас, если вообще что-то. Проверяет слоты по порядку и
 * возвращает первый подходящий — одно сообщение за прогон, чтобы проспавший
 * подъём не получил следом ещё и «дорога», и «работа» одним пакетом.
 */
export function remindPlan(doc: RemindDoc, now: TashNow, sentKeys: ReadonlySet<string>): RemindMessage | null {
  const running = runningState(doc, now)

  for (const slot of SLOTS) {
    if (now.minutes < slot.fromMin || now.minutes > slot.toMin) continue
    if (slot.workdaysOnly && now.weekday > 4) continue

    const key = `${now.dayKey}#${slot.id}`
    if (sentKeys.has(key)) continue
    if (slot.silence(running)) continue

    return { key, text: slot.text }
  }
  return null
}

/**
 * Отправленные ключи не растут бесконечно: держим только сегодняшний и
 * вчерашний день — вчерашний нужен, чтобы прогон сразу после полуночи не
 * потерял вечерний ключ на границе суток.
 */
export function pruneSentKeys(sent: string[], todayKey: string): string[] {
  const yesterday = dayKeyShift(todayKey, -1)
  return sent.filter((k) => k.startsWith(todayKey + '#') || k.startsWith(yesterday + '#'))
}
