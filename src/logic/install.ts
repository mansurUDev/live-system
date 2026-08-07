/**
 * Установка приложения на устройство — решение «показывать ли предложение».
 *
 * Чистые функции без обращения к window: так их можно проверить тестами, а
 * браузерные детали остаются в компоненте (см. components/InstallPrompt.tsx).
 */

/** Что показывать пользователю */
export type InstallHint =
  /** ничего: уже установлено, отказался, или браузер не умеет */
  | { kind: 'none' }
  /** есть родное окно установки — достаточно одной кнопки */
  | { kind: 'native' }
  /** Safari на iPhone/iPad: своего окна нет, нужна инструкция «Поделиться» */
  | { kind: 'ios' }

export interface InstallEnv {
  /** приложение уже запущено с домашнего экрана */
  standalone: boolean
  /** браузер прислал beforeinstallprompt — родное окно доступно */
  nativePromptReady: boolean
  /** iOS/iPadOS (там установка только вручную через «Поделиться») */
  isIos: boolean
  /** Safari — в сторонних браузерах на iOS пункта «На экран „Домой“» нет */
  isSafari: boolean
  /** пользователь уже закрывал предложение */
  dismissed: boolean
}

/**
 * Предложение показывается один раз и только по делу: установленному
 * приложению оно бессмысленно, отказ запоминается, а инструкция для iPhone
 * имеет смысл только в Safari — в Chrome на iOS такого пункта меню нет.
 */
export function installHint(env: InstallEnv): InstallHint {
  if (env.standalone || env.dismissed) return { kind: 'none' }
  if (env.nativePromptReady) return { kind: 'native' }
  if (env.isIos && env.isSafari) return { kind: 'ios' }
  return { kind: 'none' }
}

/**
 * iOS по user-agent. iPadOS с версии 13 представляется маководом, поэтому
 * отдельная примета — «Mac с тач-экраном».
 */
export function detectIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

/** Safari, а не Chrome/Firefox/Edge, притворяющиеся им в строке user-agent */
export function detectSafari(userAgent: string): boolean {
  if (!/Safari/i.test(userAgent)) return false
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/i.test(userAgent)
}
