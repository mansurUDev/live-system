import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Подсветка записи, на которую человек только что нажал в сводке.
 *
 * Переход из «Ближайших 30 дней» открывает вкладку целиком — и там человек
 * оказывается перед общим списком, не понимая, зачем его сюда привели. Вспышка
 * с прокруткой отвечает на этот вопрос молча: вот та самая строка.
 *
 * Прокрутка идёт по центру и без анимации, если человек просил уменьшить
 * движение, — само подсвечивание в этом случае остаётся, оно не мешает.
 */
export function FocusFlash({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
  }, [active])

  return (
    <div ref={ref} className={active ? 'focus-flash' : undefined} style={{ borderRadius: 14 }}>
      {children}
    </div>
  )
}
