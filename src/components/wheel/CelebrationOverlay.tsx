import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { PAL } from '../../constants'
import { summary } from '../../logic/pct'
import { btnGhost, C } from '../../theme'
import type { Sector } from '../../types'

const CONFETTI_COUNT = 80

interface Props {
  sector: Sector
  onArchive: () => void
  onKeep: () => void
}

function ring(color: string, delay: number): CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 440,
    height: 440,
    margin: '-220px 0 0 -220px',
    borderRadius: '50%',
    border: `2px solid ${color}`,
    boxShadow: `0 0 24px ${color}66, inset 0 0 24px ${color}44`,
    animation: `burst 1.5s cubic-bezier(.2,.7,.3,1) ${delay}s both`,
    pointerEvents: 'none',
  }
}

/**
 * Поздравление с конфетти. Частицы рассчитываются один раз при открытии и
 * анимируются средствами CSS, поэтому оверлей не нагружает главный поток.
 */
export function CelebrationOverlay({ sector, onArchive, onKeep }: Props) {
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const color = i % 3 === 0 ? sector.color : PAL[i % PAL.length]!
        const style: CSSProperties = {
          position: 'fixed',
          top: '-8vh',
          left: (Math.random() * 100).toFixed(1) + 'vw',
          width: 5 + Math.round(Math.random() * 6),
          height: 6 + Math.round(Math.random() * 8),
          background: color,
          boxShadow: `0 0 7px ${color}`,
          borderRadius: Math.random() < 0.4 ? '50%' : '1.5px',
          transform: `rotate(${Math.round(Math.random() * 360)}deg)`,
          animation: `confettiFall ${(2.2 + Math.random() * 1.9).toFixed(2)}s ${(Math.random() * 0.7).toFixed(2)}s cubic-bezier(.22,.61,.36,1) forwards`,
          zIndex: 95,
          pointerEvents: 'none',
        }
        return { id: i, style }
      }),
    [sector.color],
  )

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(3,6,14,.78)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
          overflow: 'hidden',
        }}
      >
        <div style={ring(sector.color, 0)} />
        <div style={ring(sector.color, 0.25)} />
        <div style={ring(sector.color, 0.5)} />

        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(165deg, rgba(24,34,60,.96), rgba(11,17,33,.98))',
            border: '1px solid rgba(110,160,255,.3)',
            borderRadius: 18,
            boxShadow: '0 24px 80px rgba(0,0,0,.7), 0 0 40px rgba(34,211,238,.12)',
            textAlign: 'center',
            padding: '30px 32px',
            width: 'min(460px, 100%)',
            boxSizing: 'border-box',
            animation: 'popIn .3s ease',
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '4px', color: C.dim, textTransform: 'uppercase' }}>
            миссия выполнена
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '2px',
              color: C.cyanBright,
              textShadow: '0 0 24px rgba(34,211,238,.6)',
              marginTop: 6,
              textTransform: 'uppercase',
            }}
          >
            Цель достигнута
          </div>
          <div
            style={{
              fontSize: 19,
              marginTop: 10,
              fontWeight: 600,
              overflowWrap: 'anywhere',
              color: sector.color,
              textShadow: `0 0 14px ${sector.color}88`,
            }}
          >
            «{sector.name}»
          </div>
          <div style={{ fontSize: 14.5, color: C.muted, marginTop: 5 }}>Итог: {summary(sector)}</div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
            <button
              className="h-bright"
              style={{
                fontFamily: 'inherit',
                fontSize: 14.5,
                fontWeight: 600,
                color: '#04121a',
                cursor: 'pointer',
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${sector.color}aa`,
                background: `linear-gradient(180deg,${sector.color},${sector.color}bb)`,
                boxShadow: `0 0 18px ${sector.color}66`,
              }}
              onClick={onArchive}
            >
              Отправить в архив достижений
            </button>
            <button style={{ ...btnGhost, padding: '9px 15px' }} onClick={onKeep}>
              Пока оставить
            </button>
          </div>
        </div>
      </div>

      {confetti.map((f) => (
        <div key={f.id} style={f.style} />
      ))}
    </>
  )
}
