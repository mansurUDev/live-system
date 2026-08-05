import { useEffect, useRef, useState } from 'react'
import { C } from '../theme'

/** Сколько нужно протянуть пальцем, чтобы отпускание перезагрузило страницу */
const READY_DY = 150
/** Максимальный видимый ход индикатора */
const MAX_SHIFT = 86

function isStandaloneIos(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS прикидывается макбуком — выдаёт его только мультитач
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return ios && standalone
}

/** Жест начался внутри прокрученного блока — тянуть должен он, а не страница */
function insideScrolledArea(el: unknown): boolean {
  let node = el instanceof Element ? el : null
  for (; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true
  }
  return false
}

/**
 * Обновление страницы жестом «потянуть вниз».
 *
 * Установленное на домашний экран iPhone приложение живёт без браузерного
 * интерфейса, а собственного pull-to-refresh у iOS в этом режиме нет — в
 * отличие от Android. Вне standalone-режима iOS компонент не делает ничего.
 */
export function PullToRefresh() {
  const [shift, setShift] = useState(0)
  const [ready, setReady] = useState(false)
  const [reloading, setReloading] = useState(false)
  const startY = useRef<number | null>(null)
  const lastDy = useRef(0)

  useEffect(() => {
    if (!isStandaloneIos()) return

    const atTop = () => (document.scrollingElement?.scrollTop ?? 0) <= 0

    const onStart = (e: TouchEvent) => {
      if (!atTop() || insideScrolledArea(e.target)) return
      startY.current = e.touches[0]?.clientY ?? null
      lastDy.current = 0
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const y = e.touches[0]?.clientY
      if (y === undefined) return
      const dy = y - startY.current
      if (dy <= 0 || !atTop()) {
        lastDy.current = 0
        setShift(0)
        setReady(false)
        return
      }
      lastDy.current = dy
      // индикатор идёт медленнее пальца — жест ощущается упругим
      setShift(Math.min(MAX_SHIFT, dy / 2))
      setReady(dy >= READY_DY)
    }

    const onEnd = () => {
      if (startY.current === null) return
      startY.current = null
      if (lastDy.current >= READY_DY) {
        setReloading(true)
        window.location.reload()
        return
      }
      setShift(0)
      setReady(false)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (shift <= 0 && !reloading) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 6px)',
        left: 0,
        right: 0,
        zIndex: 300,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        transform: `translateY(${reloading ? MAX_SHIFT / 2 : shift - MAX_SHIFT}px)`,
        opacity: reloading ? 1 : Math.min(1, shift / 30),
        transition: startY.current === null ? 'transform .2s ease, opacity .2s ease' : 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: ready || reloading ? C.cyanBright : C.muted,
          background: 'linear-gradient(165deg, rgba(24,34,60,.96), rgba(11,17,33,.97))',
          border: `1px solid ${ready || reloading ? 'rgba(94,234,255,.5)' : 'rgba(148,163,184,.25)'}`,
          borderRadius: 999,
          padding: '7px 14px',
          boxShadow: '0 6px 24px rgba(0,0,0,.45)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: `rotate(${ready ? 180 : 0}deg)`,
            transition: 'transform .15s ease',
            ...(reloading ? { animation: 'blink 1s ease-in-out infinite' } : null),
          }}
        >
          {reloading ? '↻' : '↓'}
        </span>
        {reloading ? 'Обновляю…' : ready ? 'Отпусти — обновлю' : 'Потяни, чтобы обновить'}
      </span>
    </div>
  )
}
