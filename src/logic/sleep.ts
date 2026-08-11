import { DAY_MS } from '../constants'
import { addDays, startOfDay } from './time'
import type { Activity, TimeEntry } from '../types'

/**
 * Средняя длина цикла сна.
 *
 * Настоящий цикл плавает в пределах 70–120 минут и за ночь меняется, поэтому
 * 90 — ориентир, а не расписание. Смысл расчёта в том, чтобы будильник не
 * пришёлся на середину глубокой фазы, а не в том, чтобы попасть в минуту.
 */
export const CYCLE_MIN = 90

/** Сколько в среднем уходит на засыпание — прибавляется к моменту «лёг» */
export const FALL_ASLEEP_MIN = 15

/** Дольше суток без сна — это не бодрствование, а дыра в записях */
export const AWAKE_STALE_MS = DAY_MS

/** Сколько циклов показываем: от 9 часов сна до 4:30 */
export const CYCLE_CHOICES = [6, 5, 4, 3]

const MIN_MS = 60_000

export interface SleepOption {
  cycles: number
  /** момент — подъёма в прямом расчёте, отбоя в обратном */
  at: number
  /** сколько выйдет собственно сна, минут */
  sleepMin: number
}

/** Во сколько вставать, если лечь в `bedAt` */
export function wakeOptions(bedAt: number, cycles: number[] = CYCLE_CHOICES): SleepOption[] {
  const asleep = bedAt + FALL_ASLEEP_MIN * MIN_MS
  return cycles.map((n) => ({
    cycles: n,
    at: asleep + n * CYCLE_MIN * MIN_MS,
    sleepMin: n * CYCLE_MIN,
  }))
}

/** Во сколько ложиться, чтобы встать в `wakeAt` — засыпание заложено в запас */
export function bedOptions(wakeAt: number, cycles: number[] = CYCLE_CHOICES): SleepOption[] {
  return cycles.map((n) => ({
    cycles: n,
    at: wakeAt - (n * CYCLE_MIN + FALL_ASLEEP_MIN) * MIN_MS,
    sleepMin: n * CYCLE_MIN,
  }))
}

/**
 * Ближайший момент в будущем, когда на часах будет `minutes` от полуночи.
 * Границы суток берутся календарным сдвигом, поэтому перевод часов не сдвигает
 * результат на час.
 */
export function nextClockTime(minutes: number, now: number = Date.now()): number {
  const today = startOfDay(now) + minutes * MIN_MS
  return today > now ? today : addDays(startOfDay(now), 1) + minutes * MIN_MS
}

export type AwakeState =
  /** сна в записях ещё не было — считать не от чего */
  | { kind: 'none' }
  /** сон идёт прямо сейчас */
  | { kind: 'sleeping'; since: number }
  | { kind: 'awake'; since: number; ms: number }

/**
 * Сколько времени на ногах — от конца последней записи сна до сейчас.
 *
 * Сон узнаётся по категории активности, а не по названию кнопки: назвать её
 * можно как угодно, а `cat: 'sleep'` задаётся явно.
 */
export function awakeState(entries: TimeEntry[], acts: Activity[], now: number = Date.now()): AwakeState {
  const sleepIds = new Set(acts.filter((a) => a.cat === 'sleep').map((a) => a.id))
  let lastEnd: number | null = null

  for (const e of entries) {
    if (!sleepIds.has(e.actId)) continue
    const s = new Date(e.start).getTime()
    if (!Number.isFinite(s)) continue
    if (!e.end) return { kind: 'sleeping', since: s }
    const end = new Date(e.end).getTime()
    if (!Number.isFinite(end)) continue
    if (lastEnd === null || end > lastEnd) lastEnd = end
  }

  if (lastEnd === null) return { kind: 'none' }
  // часы на устройстве могли уехать назад — отрицательного бодрствования не бывает
  return { kind: 'awake', since: lastEnd, ms: Math.max(0, now - lastEnd) }
}
