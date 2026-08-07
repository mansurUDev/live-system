import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { detectIos, detectSafari, installHint, type InstallHint } from '../logic/install'
import { btnAccent, btnGhostSm, C } from '../theme'

/** Отказ помнится по этому ключу — предложение больше не всплывает */
const DISMISS_KEY = 'sistema-zhizni-install-dismissed'

/**
 * Событие, которым любая кнопка «Установить приложение» открывает инструкцию.
 * Через событие, а не через пропсы: кнопка нужна и на экране входа, и в меню
 * вошедшего пользователя — это разные ветки дерева, тащить состояние через обе
 * было бы дороже, чем одно имя события.
 */
export const INSTALL_HELP_EVENT = 'sz:install-help'

export function askInstallHelp(): void {
  window.dispatchEvent(new Event(INSTALL_HELP_EVENT))
}

/**
 * Событие Chrome, которым браузер сообщает, что готов показать своё окно
 * установки. В типах TypeScript его нет — описываем сами.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Предложение установить приложение на устройство.
 *
 * На Android/Chrome браузер сам присылает beforeinstallprompt — тогда хватает
 * одной кнопки. На iPhone такого события нет вовсе: Safari умеет добавлять
 * сайт на домашний экран только руками пользователя, поэтому там показывается
 * короткая инструкция. В обоих случаях приложение ставится без App Store и
 * Play Market.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(readDismissed)
  const [installed, setInstalled] = useState(isStandalone)
  const [forced, setForced] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // без preventDefault Chrome покажет свою мини-панель, и наша станет второй
      e.preventDefault()
      setDeferred(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setForced(false)
    }
    const onAsk = () => setForced(true)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener(INSTALL_HELP_EVENT, onAsk)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(INSTALL_HELP_EVENT, onAsk)
    }
  }, [])

  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const hint: InstallHint = installHint({
    standalone: installed,
    nativePromptReady: !!deferred,
    isIos: detectIos(ua, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints),
    isSafari: detectSafari(ua),
    dismissed,
    forced,
  })

  if (hint.kind === 'none') return null

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* без хранилища предложение просто вернётся в следующий раз */
    }
    setDismissed(true)
    setForced(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    // повторно показать это же событие нельзя — панель в любом случае убираем
    setDeferred(null)
  }

  return createPortal(
    // Портал в body обязателен: контент приложения лежит в слое с z-index 1, и
    // панель, отрисованная внутри него, ушла бы под нижнюю навигацию.
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <img src="/icon-192.png" alt="" style={icon} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: C.textBright }}>
              Установить «Систему жизни»
            </div>
            <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
              {hint.kind === 'native'
                ? 'Появится на экране как обычное приложение — открывается быстрее и работает без интернета.'
                : 'Откроется как приложение и заработает без интернета. Ставится с сайта, без App Store.'}
            </div>
          </div>
          <button onClick={close} aria-label="Закрыть" style={closeBtn}>
            ✕
          </button>
        </div>

        {hint.kind === 'ios' && (
          <>
            <ol style={steps}>
              <li>
                Нажми <b style={{ color: C.textBright }}>Поделиться</b>
                <span style={{ color: C.cyanBright }}> ⬆︎</span> — внизу экрана или в меню браузера
              </li>
              <li>
                Пролистай список и выбери{' '}
                <b style={{ color: C.textBright }}>«На экран „Домой“»</b>
              </li>
              <li>Нажми «Добавить» — иконка встанет рядом с остальными</li>
            </ol>
            {!hint.inSafari && (
              <div style={note}>
                Не нашёл такого пункта? Значит сайт открыт во встроенном браузере (например, из
                мессенджера). Выбери в том же меню <b style={{ color: C.textBright }}>«Открыть в Safari»</b> и
                повтори.
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 13 }}>
          <button style={btnGhostSm} onClick={close}>
            {hint.kind === 'native' ? 'Не сейчас' : 'Понятно'}
          </button>
          {hint.kind === 'native' && (
            <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 16px' }} onClick={() => void install()}>
              Установить
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const wrap: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  // над нижней навигацией телефона и её безопасной зоной
  bottom: 'calc(env(safe-area-inset-bottom) + 72px)',
  // выше приветственного экрана (z-index 100): предложение установить нужно
  // именно при первом открытии, а первым открытием и является этот экран
  zIndex: 101,
  display: 'flex',
  justifyContent: 'center',
  padding: '0 10px',
  pointerEvents: 'none',
}

const card: React.CSSProperties = {
  pointerEvents: 'auto',
  width: '100%',
  maxWidth: 460,
  boxSizing: 'border-box',
  background: 'linear-gradient(165deg, rgba(24,34,60,.97), rgba(11,17,33,.98))',
  border: '1px solid rgba(110,160,255,.28)',
  borderRadius: 16,
  boxShadow: '0 -14px 50px rgba(0,0,0,.6), 0 0 26px rgba(34,211,238,.08)',
  padding: '14px 15px 12px',
  animation: 'sheetUp .24s ease',
}

const icon: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  flex: 'none',
  border: '1px solid rgba(110,160,255,.2)',
}

const closeBtn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: 1,
  color: C.muted,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  flex: 'none',
}

const note: React.CSSProperties = {
  marginTop: 9,
  padding: '8px 10px',
  borderRadius: 9,
  background: 'rgba(148,163,184,.07)',
  border: '1px solid rgba(148,163,184,.18)',
  fontSize: 12.5,
  color: C.muted,
  lineHeight: 1.5,
}

const steps: React.CSSProperties = {
  margin: '11px 0 0',
  paddingLeft: 20,
  fontSize: 13.5,
  color: C.textSoft,
  lineHeight: 1.7,
}
