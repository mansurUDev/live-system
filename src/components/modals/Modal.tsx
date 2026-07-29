import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { C, iconBtn, modalCard, modalOverlay } from '../../theme'

interface Props {
  title: string
  width?: number
  onClose: () => void
  children: ReactNode
  /** нижняя строка с кнопками */
  footer?: ReactNode
}

export function Modal({ title, width = 500, onClose, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard(width)} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '.5px',
              color: C.textBright,
              flex: 1,
            }}
          >
            {title}
          </div>
          <button style={iconBtn()} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}
