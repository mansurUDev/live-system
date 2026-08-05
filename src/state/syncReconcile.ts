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
 * Правило 1: cloud-версия сравнивается не с «0», а с версией, которую это
 * устройство последний раз само подтвердило (`known`). Без этого при каждой
 * загрузке облако считалось бы истиной по умолчанию — и правка, которую
 * предыдущая сессия не успела отправить (например, вкладку закрыли раньше
 * отложенного PUT), стиралась бы уже на этом же устройстве, без какого-либо
 * участия второго.
 *
 * Правило 2 (`dirtyLocal`): pull идёт в фоне при каждой загрузке страницы —
 * пока он летит, пользователь мог успеть что-то отметить. Раньше ответ
 * pull'а с более новой версией облака безусловно затирал такую правку
 * (`replaceDoc`), даже если она случилась уже ПОСЛЕ момента, на который
 * отвечает облако. Если что-то поменялось локально — считаем активное
 * устройство источником истины и отправляем его версию, а не молча
 * принимаем чужую.
 *
 * Исключение — `known === 0`: свежее устройство/первый вход, локально лежит
 * пустой сид-документ. Здесь `dirtyLocal` от одного случайного тапа не
 * должен перевесить весь настоящий аккаунт в облаке — при known=0 облако
 * побеждает всегда, независимо от dirtyLocal.
 */
export function reconcile(
  pulled: { doc: Doc | null; version: number },
  known: number,
  localDoc: Doc,
  dirtyLocal: boolean,
): ReconcileDecision {
  if (!pulled.doc) return { kind: 'push-initial' }

  if (pulled.version > known) {
    if (dirtyLocal && known > 0) return { kind: 'keep-local', version: pulled.version, push: true }
    return { kind: 'apply-cloud', version: pulled.version }
  }

  const same = JSON.stringify(pulled.doc) === JSON.stringify(localDoc)
  return { kind: 'keep-local', version: pulled.version, push: !same }
}
