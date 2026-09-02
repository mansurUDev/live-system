import { useRef, useState } from 'react'
import type { TouchEvent as ReactTouchEvent, MouseEvent as ReactMouseEvent } from 'react'
import { isTouchDrift, LONG_PRESS_MS } from '../logic/popover'

export interface MenuState<T> {
  x: number
  y: number
  data: T
}

/**
 * Контекстное меню элемента списка — как в мессенджерах: правый клик на
 * десктопе, долгое нажатие на таче.
 *
 * Хук держит только «где и над чем открыто»; сами пункты собирает вызывающий
 * компонент и рендерит через <ContextMenu>. Так меню не знает про действия,
 * а карточки не знают про позиционирование.
 *
 * Долгое нажатие реализовано своим таймером: Android шлёт contextmenu сам,
 * iOS Safari — нет. Чтобы на Android меню не открылось дважды, contextmenu,
 * пришедший вскоре после touch-открытия, только гасится — окно широкое,
 * потому что системная задержка long-press настраивается и бывает ~1.5 с.
 * Отмена по сдвигу пальца обязательна: карточки живут в прокручиваемых
 * списках, и без неё меню выскакивало бы посреди скролла.
 */
export function useContextMenu<T>() {
  const [state, setState] = useState<MenuState<T> | null>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  // флаг конкретного жеста, а не окно по часам: «это касание открыло меню»
  const openedByThisTouch = useRef(false)
  const suppressCtxUntil = useRef(0)

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const close = () => setState(null)

  /**
   * Поля ввода, ссылки и drag-ручка меню не вызывают: у полей и ссылок
   * нативное меню «Вставить/Открыть в новой вкладке» важнее нашего, а
   * удержание ручки — начало перетаскивания.
   */
  const foreignTarget = (target: EventTarget | null): 'native' | 'drag' | null => {
    const el = target as HTMLElement | null
    if (!el?.closest) return null
    if (el.closest('input, textarea, a, [contenteditable="true"]')) return 'native'
    if (el.closest('[data-drag-handle]')) return 'drag'
    return null
  }

  const bind = (data: T) => ({
    onContextMenu: (e: ReactMouseEvent) => {
      const foreign = foreignTarget(e.target)
      if (foreign === 'native') return
      e.preventDefault()
      e.stopPropagation()
      if (foreign === 'drag') return
      // Android поднимает contextmenu тем же долгим нажатием — меню уже открыто
      if (performance.now() < suppressCtxUntil.current) return
      setState({ x: e.clientX, y: e.clientY, data })
    },
    onTouchStart: (e: ReactTouchEvent) => {
      openedByThisTouch.current = false
      if (e.touches.length !== 1) return
      if (foreignTarget(e.target) !== null) return
      const t = e.touches[0]!
      start.current = { x: t.clientX, y: t.clientY }
      clearTimer()
      timer.current = window.setTimeout(() => {
        timer.current = null
        openedByThisTouch.current = true
        suppressCtxUntil.current = performance.now() + 1600
        if (navigator.vibrate) navigator.vibrate(10)
        setState({ x: start.current!.x, y: start.current!.y, data })
      }, LONG_PRESS_MS)
    },
    onTouchMove: (e: ReactTouchEvent) => {
      const s = start.current
      const t = e.touches[0]
      if (!s || !t) return
      if (isTouchDrift(s.x, s.y, t.clientX, t.clientY)) clearTimer()
    },
    onTouchEnd: (e: ReactTouchEvent) => {
      clearTimer()
      // касание открыло меню — отпускание не должно дослать click: он попал бы
      // в подложку (меню закрылось бы само) или в пункт меню под пальцем
      if (openedByThisTouch.current) {
        e.preventDefault()
        openedByThisTouch.current = false
      }
    },
    onTouchCancel: () => clearTimer(),
  })

  return { state, bind, close }
}
