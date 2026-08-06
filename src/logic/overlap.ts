import { DAY_MS } from '../constants'
import type { TimeEntry } from '../types'

/**
 * Пересечение полуинтервалов [aS, aE) и [bS, bE).
 *
 * Касание границ (конец одной записи равен началу следующей) пересечением НЕ
 * считается — иначе цепочки записей, которые создаёт сам трекер, стали бы
 * нередактируемыми.
 *
 * Пустой полуинтервал (конец равен началу) не содержит ни одного момента,
 * поэтому не пересекается ни с чем. Проверять это приходится отдельно: сам
 * трекер такие записи создаёт — если нажать две кнопки в пределах одной
 * минуты, предыдущая закрывается тем же временем, с которого началась, — и без
 * этой оговорки одна такая запись запрещала бы любую другую, накрывающую её
 * момент.
 */
export function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  if (aS >= aE || bS >= bE) return false
  return aS < bE && bS < aE
}

export type ResolvedEnd =
  | { ok: true; end: number }
  | { ok: false; error: string }

/**
 * Конец записи по введённым дате и времени.
 *
 * Конец раньше начала означает переход через полночь — прибавляем сутки.
 * Ровно равный конец (нулевая длительность) отклоняем: в моке он тоже уезжал
 * на +24 часа, из-за чего случайный одинаковый ввод давал сутки трекинга.
 */
export function resolveEnd(start: number, end: number): ResolvedEnd {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: 'Не получилось разобрать время' }
  }
  if (end === start) return { ok: false, error: 'Начало и конец совпадают — запись нулевой длины' }
  if (end < start) return { ok: true, end: end + DAY_MS }
  return { ok: true, end }
}

/**
 * Правая граница записи для проверки пересечений.
 *
 * У идущей записи она бесконечна: пока трекинг не остановлен, время занято, и
 * ручную запись «в будущее» поверх него ставить нельзя. Для подсчёта времени в
 * аналитике у той же записи граница другая — текущий момент (см. segs).
 */
function conflictEnd(e: TimeEntry): number {
  return e.end ? new Date(e.end).getTime() : Infinity
}

/**
 * Первая запись, пересекающаяся с кандидатом. excludeId исключает саму
 * редактируемую запись.
 */
export function findConflict(
  entries: TimeEntry[],
  candidate: { start: number; end: number | null },
  excludeId?: string | null,
): TimeEntry | null {
  const cS = candidate.start
  const cE = candidate.end ?? Infinity
  for (const e of entries) {
    if (excludeId && e.id === excludeId) continue
    const s = new Date(e.start).getTime()
    if (!Number.isFinite(s)) continue
    if (overlaps(cS, cE, s, conflictEnd(e))) return e
  }
  return null
}
