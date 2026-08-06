import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { C, iconBtn } from '../../theme'

interface Props {
  images: string[]
  startIndex: number
  onClose: () => void
}

/** Свайп короче этого считается тапом, а не листанием */
const SWIPE_THRESHOLD_PX = 40

/** Полноэкранный просмотр фото идеи — вместо открытия ссылки в новой вкладке */
export function Lightbox({ images, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const touchX = useRef<number | null>(null)

  const prev = () => setIndex((i) => Math.max(i - 1, 0))
  const next = () => setIndex((i) => Math.min(i + 1, images.length - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hasMultiple = images.length > 1

  // Портал в body: без него оверлей стекуется внутри z-index-контекста Shell
  // и уходит под нижнюю панель (та выше по z-index, но снаружи этого контекста).
  return createPortal(
    <div
      onClick={onClose}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]!.clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0]!.clientX - touchX.current
        touchX.current = null
        if (dx > SWIPE_THRESHOLD_PX) prev()
        else if (dx < -SWIPE_THRESHOLD_PX) next()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(3,6,14,.92)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeSwap .15s ease',
      }}
    >
      <button onClick={onClose} aria-label="Закрыть" style={{ ...iconBtn(36), position: 'absolute', top: 14, right: 14 }}>
        ✕
      </button>

      {hasMultiple && index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            prev()
          }}
          aria-label="Предыдущее фото"
          style={{ ...iconBtn(40), position: 'absolute', left: 10, fontSize: 18 }}
        >
          ‹
        </button>
      )}

      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10 }}
      />

      {hasMultiple && index < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
          aria-label="Следующее фото"
          style={{ ...iconBtn(40), position: 'absolute', right: 10, fontSize: 18 }}
        >
          ›
        </button>
      )}

      {hasMultiple && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            fontSize: 12.5,
            color: C.muted,
            fontFamily: 'inherit',
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body,
  )
}
