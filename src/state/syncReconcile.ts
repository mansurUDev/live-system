import type { Doc } from '../types'

export type ReconcileDecision =
  /** в облаке пусто — заливаем то, что накопилось на устройстве */
  | { kind: 'push-initial' }
  /** в облаке версия новее, чем последняя увиденная этим устройством — берём её */
  | { kind: 'apply-cloud'; version: number }
  /** облако на нашей версии — локальные данные не старше, при расхождении досылаем их */
  | { kind: 'keep-local'; version: number; push: boolean }

/**
 * Решает, что делать с результатом pull, не трогая ни React, ни сеть.
 *
 * Ключевое правило: cloud-версия сравнивается не с «0», а с версией, которую
 * это устройство последний раз само подтвердило (`known`). Без этого при
 * каждой загрузке облако считалось бы истиной по умолчанию — и правка,
 * которую предыдущая сессия не успела отправить (например, вкладку закрыли
 * раньше отложенного PUT), стиралась бы уже на этом же устройстве, без
 * какого-либо участия второго.
 */
export function reconcile(
  pulled: { doc: Doc | null; version: number },
  known: number,
  localDoc: Doc,
): ReconcileDecision {
  if (!pulled.doc) return { kind: 'push-initial' }
  if (pulled.version > known) return { kind: 'apply-cloud', version: pulled.version }

  const same = JSON.stringify(pulled.doc) === JSON.stringify(localDoc)
  return { kind: 'keep-local', version: pulled.version, push: !same }
}
