import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

export const LONG_PRESS_MS = 430

/**
 * Долгое нажатие на плитку активности — предложить сдвиг начала назад
 * (BackdateMenu). Один экземпляр на плитку: работает одинаково на горячем
 * ряду, полосах и доке телефона.
 */
export function useLongPress(fire: (x: number, y: number) => void, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // после срабатывания долгого нажатия обычный клик гасим, иначе отсчёт
  // запустится дважды — и меню, и по отпусканию
  const fired = useRef(false)

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
  }

  useEffect(() => cancel, [])

  return {
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (!enabled) return
        fired.current = false
        const { clientX, clientY } = e
        timer.current = setTimeout(() => {
          fired.current = true
          fire(clientX, clientY)
        }, LONG_PRESS_MS)
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    },
    /** true — обычный клик надо проглотить, меню уже показано */
    swallowClick: () => {
      if (!fired.current) return false
      fired.current = false
      return true
    },
  }
}
