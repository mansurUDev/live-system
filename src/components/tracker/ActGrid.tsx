import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { CATS, OTHER } from '../../constants'
import { useIsMobile } from '../../hooks/useIsMobile'
import { btnGhostSm, C } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  acts: Activity[]
  running: TimeEntry | null
  editing: boolean
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onToggleEditing: () => void
  onAdd: () => void
  /** долгое нажатие — предложить сдвиг начала назад */
  onLongPress: (act: Activity, x: number, y: number) => void
}

const LONG_PRESS_MS = 430

// На телефоне плитки чуть плотнее: так на экран помещается больше кнопок,
// но палец по-прежнему попадает без промаха.
function gridStyle(mobile: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill,minmax(${mobile ? 136 : 150}px,1fr))`,
    gap: mobile ? 9 : 11,
  }
}

export function ActGrid({
  acts,
  running,
  editing,
  onPress,
  onEdit,
  onToggleEditing,
  onAdd,
  onLongPress,
}: Props) {
  const isMobile = useIsMobile()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // после срабатывания долгого нажатия обычный клик гасим, иначе отсчёт
  // запустится дважды — и меню, и по отпусканию
  const fired = useRef(false)

  const startPress = (e: ReactPointerEvent<HTMLButtonElement>, act: Activity) => {
    if (editing) return
    fired.current = false
    const { clientX, clientY } = e
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress(act, clientX, clientY)
    }, LONG_PRESS_MS)
  }

  const endPress = () => {
    if (timer.current) clearTimeout(timer.current)
  }

  const click = (act: Activity) => {
    if (fired.current) {
      fired.current = false
      return
    }
    if (editing) onEdit(act)
    else onPress(act.id)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>Активности</div>
        <div style={{ flex: 1 }} />
        <button className="h-ghost-bright" style={btnGhostSm} onClick={onAdd}>
          + Кнопка
        </button>
        <button className="h-ghost-bright" style={btnGhostSm} onClick={onToggleEditing}>
          {editing ? 'Готово' : 'Настроить кнопки'}
        </button>
      </div>

      <div style={gridStyle(isMobile)}>
        {acts.map((a) => {
          const isRunning = running?.actId === a.id
          return (
            <button
              key={a.id}
              className="h-tile"
              onClick={() => click(a)}
              onPointerDown={(e) => startPress(e, a)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              onContextMenu={(e) => e.preventDefault()}
              style={
                {
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: isMobile ? '11px 12px 9px' : '13px 14px 11px',
                  minHeight: isMobile ? 74 : 84,
                  borderRadius: 14,
                  background: 'linear-gradient(165deg, rgba(22,32,58,.7), rgba(10,16,32,.85))',
                  border: `1px solid ${a.color}${isRunning ? 'cc' : '44'}`,
                  boxShadow: isRunning
                    ? `0 0 18px ${a.color}55, inset 0 0 24px ${a.color}18`
                    : `inset 0 0 16px ${a.color}0e`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 6,
                  transition: 'border-color .2s, box-shadow .2s, transform .15s',
                  '--tile-hov-border': `${a.color}cc`,
                  '--tile-hov-shadow': `0 0 16px ${a.color}44, inset 0 0 20px ${a.color}16`,
                } as CSSProperties
              }
            >
              <span
                style={{
                  fontSize: isMobile ? 15.5 : 16.5,
                  fontWeight: 600,
                  color: '#e9f1ff',
                  letterSpacing: '.3px',
                  lineHeight: 1.2,
                  overflowWrap: 'anywhere',
                }}
              >
                {a.name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: a.color,
                    boxShadow: `0 0 8px ${a.color}`,
                    flex: 'none',
                  }}
                />
                <span style={{ fontSize: 11.5, letterSpacing: '.8px', color: C.muted, textTransform: 'uppercase' }}>
                  {(CATS[a.cat] ?? OTHER).label}
                </span>
                {isRunning && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10.5,
                      letterSpacing: '1.5px',
                      color: C.cyanBright,
                      animation: 'blink 1.4s ease-in-out infinite',
                    }}
                  >
                    ИДЁТ
                  </span>
                )}
                {editing && (
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.cyanBright }}>править ▸</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
