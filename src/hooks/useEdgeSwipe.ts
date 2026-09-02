import { useEffect, useRef } from 'react'

/** Полоса у левого края, с которой начинается жест — как системная «назад» */
const EDGE_PX = 24
/** Сдвиг вправо, после которого панель открывается */
const OPEN_DX = 40

/**
 * Свайп от левого края открывает боковую панель.
 *
 * Слушатели пассивные и жест начинается только у самой кромки, поэтому обычная
 * прокрутка и «потянуть, чтобы обновить» не задеты: там палец ложится в глубине
 * экрана и ведёт вертикально.
 */
export function useEdgeSwipe(enabled: boolean, onOpen: () => void): void {
  const start = useRef<{ x: number; y: number } | null>(null)
  const fire = useRef(onOpen)
  fire.current = onOpen

  useEffect(() => {
    if (!enabled) return

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = e.touches.length === 1 && t && t.clientX <= EDGE_PX ? { x: t.clientX, y: t.clientY } : null
    }

    const onMove = (e: TouchEvent) => {
      const s = start.current
      const t = e.touches[0]
      if (!s || !t) return
      const dx = t.clientX - s.x
      const dy = Math.abs(t.clientY - s.y)
      // явно горизонтальное движение: иначе диагональная прокрутка открывала бы панель
      if (dx > OPEN_DX && dy < dx * 0.6) {
        start.current = null
        fire.current()
      }
    }

    const reset = () => {
      start.current = null
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', reset, { passive: true })
    window.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', reset)
      window.removeEventListener('touchcancel', reset)
    }
  }, [enabled])
}
