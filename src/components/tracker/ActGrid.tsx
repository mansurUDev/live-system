import type { CSSProperties } from 'react'
import { CATS, OTHER } from '../../constants'
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
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
  gap: 11,
}

export function ActGrid({ acts, running, editing, onPress, onEdit, onToggleEditing, onAdd }: Props) {
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

      <div style={gridStyle}>
        {acts.map((a) => {
          const isRunning = running?.actId === a.id
          return (
            <button
              key={a.id}
              className="h-tile"
              onClick={() => (editing ? onEdit(a) : onPress(a.id))}
              style={
                {
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '13px 14px 11px',
                  minHeight: 84,
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
                  fontSize: 16.5,
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
