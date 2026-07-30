import { useEffect } from 'react'
import { BACKDATE_OFFSETS } from '../../constants'
import { hhmm } from '../../logic/time'
import { C, chipDot } from '../../theme'

export interface BackdateTarget {
  id: string
  name: string
  color: string
  x: number
  y: number
}

interface Props {
  target: BackdateTarget
  onPick: (minutes: number) => void
  onClose: () => void
}

const MENU_W = 186

/**
 * Меню у пальца после долгого нажатия.
 *
 * Нажатие почти никогда не совпадает с моментом перехода: пришёл домой, а
 * телефон достал через десять минут. Сдвиг назад закрывает предыдущий отрезок
 * тем же временем, каким начинается новый, — дырки в ленте не возникает.
 */
export function BackdateMenu({ target, onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const left = Math.max(8, Math.min(target.x - MENU_W / 2, vw - MENU_W - 8))
  const above = target.y > 260
  const top = above ? target.y - 210 : target.y + 18

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 84 }} />
      <div
        style={{
          position: 'fixed',
          left,
          top,
          width: MENU_W,
          zIndex: 85,
          background: 'linear-gradient(165deg, rgba(24,34,60,.97), rgba(11,17,33,.98))',
          border: `1px solid ${target.color}55`,
          borderRadius: 14,
          boxShadow: `0 14px 44px rgba(0,0,0,.6), 0 0 18px ${target.color}33`,
          padding: 8,
          animation: 'lpIn .15s ease',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 6px' }}>
          <span style={chipDot(target.color)} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
            {target.name}
          </span>
        </div>

        <div style={{ fontSize: 11.5, color: C.dim, padding: '0 4px 4px' }}>начать раньше</div>

        {BACKDATE_OFFSETS.map((min) => (
          <button
            key={min}
            onClick={() => onPick(min)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 14,
              color: C.text,
              background: 'rgba(148,163,184,.06)',
              border: '1px solid rgba(148,163,184,.18)',
              borderRadius: 9,
              padding: '10px 12px',
              cursor: 'pointer',
              marginTop: 5,
              boxSizing: 'border-box',
            }}
          >
            <span>{min} мин назад</span>
            <span style={{ color: C.faint }}>{hhmm(Date.now() - min * 60_000)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
