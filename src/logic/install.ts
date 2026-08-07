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
  /** iPhone/iPad: своего окна установки нет, нужна инструкция «Поделиться» */
  | { kind: 'ios'; inSafari: boolean }

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
  /** пользователь сам попросил инструкцию — тогда отказ и прочее не важны */
  forced?: boolean
}

/**
 * Что показать.
 *
 * Само по себе предложение всплывает один раз и только по делу: установленному
 * приложению оно бессмысленно, отказ запоминается. Но если человек попросил
 * инструкцию сам (`forced`), она показывается всегда — иначе закрытую однажды
 * панель было бы не вернуть.
 *
 * На iOS инструкция даётся в любом браузере, а не только в Safari: Chrome и
 * Edge на iPhone тоже умеют «На экран „Домой“», а встроенные браузеры мессенджеров
 * не умеют — но там выручает пункт «Открыть в Safari», о котором и сообщает
 * `inSafari: false`. Молчать в этих случаях хуже всего: человек остаётся без
 * единой подсказки.
 */
export function installHint(env: InstallEnv): InstallHint {
  if (env.standalone) return { kind: 'none' }
  if (env.nativePromptReady) return { kind: 'native' }
  if (env.isIos) {
    if (env.dismissed && !env.forced) return { kind: 'none' }
    return { kind: 'ios', inSafari: env.isSafari }
  }
  // не iOS и родного окна нет: браузер либо не умеет ставить приложения, либо
  // уже установил. Показываем инструкцию только по прямой просьбе.
  return env.forced ? { kind: 'ios', inSafari: env.isSafari } : { kind: 'none' }
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
