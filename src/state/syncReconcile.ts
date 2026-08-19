import { sameDoc } from '../logic/merge'
import type { Doc } from '../types'

export type SyncPlan =
  /** в облаке пусто — заливаем то, что накопилось на устройстве */
  | { kind: 'push-initial' }
  /** берём облако как есть: свежее устройство либо расхождение, которое нечем слить */
  | { kind: 'apply-cloud'; version: number }
  /** облако и устройство совпадают — остаётся освежить точку согласования */
  | { kind: 'in-sync'; version: number }
  /** облако на нашей версии, а документы разошлись — уезжает наше */
  | { kind: 'push-local'; version: number }
  /** облако ушло вперёд, база есть — объединяем обе стороны */
  | { kind: 'merge'; version: number }

/**
 * Что делать с ответом облака при загрузке. Чистая таблица: в хуке не должно
 * остаться ни одного нетривиального решения — React-окружения в тестах нет,
 * поэтому всё, что ветвится, живёт здесь и проверяется в node.
 *
 * Ключевое отличие от прежней версии: «есть ли неотправленные правки» больше не
 * флаг в памяти вкладки, а факт — локальный документ отличается от базы. Флаг
 * умирал вместе с вкладкой, и правка, не успевшая уехать до закрытия, на
 * следующей загрузке выглядела как «ничего своего нет» и молча заменялась
 * облаком. Именно так пропал вечерний сериал.
 *
 * `known === 0` остаётся особым случаем: устройство видит облако впервые, а
 * локально лежит стартовый документ — заливать его поверх живого аккаунта
 * нельзя ни при каких обстоятельствах.
 */
export function planSync(
  pulled: { doc: Doc | null; version: number },
  known: number,
  base: Doc | null,
  local: Doc,
): SyncPlan {
  if (!pulled.doc) return { kind: 'push-initial' }
  if (known === 0) return { kind: 'apply-cloud', version: pulled.version }

  if (pulled.version > known) {
    // без базы объединять нечем: аддитивное слияние воскресило бы всё, что
    // удалили на другом устройстве, — уступаем облаку, как раньше
    return base ? { kind: 'merge', version: pulled.version } : { kind: 'apply-cloud', version: pulled.version }
  }

  // облако не новее нашего: его содержимое и есть наша база
  if (sameDoc(pulled.doc, local)) return { kind: 'in-sync', version: pulled.version }
  return { kind: 'push-local', version: pulled.version }
}

/**
 * Стоит ли перечитать облако при возврате на вкладку.
 *
 * Вкладку могут не закрывать сутками: без этого макбук показывал бы вчерашнее
 * состояние до перезагрузки. Неотправленные правки чтению больше не мешают —
 * они не теряются, а участвуют в слиянии.
 */
export function shouldPullOnResume(opts: { enabled: boolean; busy: boolean }): boolean {
  return opts.enabled && !opts.busy
}
