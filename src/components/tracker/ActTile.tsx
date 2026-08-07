import type { CSSProperties } from 'react'
import { CATS, OTHER } from '../../constants'
import { useLongPress } from '../../hooks/useLongPress'
import { C, MONO, actTileShell } from '../../theme'
import type { Activity } from '../../types'

export type TileVariant = 'hotWide' | 'hot' | 'chip' | 'chipPhone' | 'dock'

interface Spec {
  minH: number
  pad: string
  font: number
  radius: number
  /** имя сверху, точка+категория+минуты отдельной строкой снизу */
  stack: boolean
  /** показывать подпись категории (только горячий ряд ≥1800 — он смешанный) */
  cat: boolean
  /** показывать минуты вовсе */
  ms: boolean
  /** минуты прижаты вправо (marginLeft:auto), иначе — сразу после имени */
  msRight: boolean
}

const SPEC: Record<TileVariant, Spec> = {
  hotWide: { minH: 64, pad: '10px 13px', font: 16, radius: 13, stack: true, cat: true, ms: true, msRight: true },
  hot: { minH: 56, pad: '9px 12px', font: 13.5, radius: 12, stack: true, cat: false, ms: true, msRight: true },
  chip: { minH: 44, pad: '0 13px', font: 13.5, radius: 11, stack: false, cat: false, ms: true, msRight: false },
  chipPhone: { minH: 52, pad: '0 13px', font: 15, radius: 12, stack: false, cat: false, ms: true, msRight: true },
  dock: { minH: 50, pad: '0 11px', font: 13.5, radius: 11, stack: false, cat: false, ms: false, msRight: false },
}

interface Props {
  act: Activity
  variant: TileVariant
  running: boolean
  /** минуты за сегодня, уже отформатированные («0:45»); пусто — не отслеживалось */
  ms: string
  editing: boolean
  /** сейчас перетаскивается — плитка держит место, но невидима и не кликается (плейсхолдер) */
  dragged?: boolean
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onLongPress: (act: Activity, x: number, y: number) => void
  onTogglePin: (id: string) => void
}

export function ActTile({
  act,
  variant,
  running,
  ms,
  editing,
  dragged,
  onPress,
  onEdit,
  onLongPress,
  onTogglePin,
}: Props) {
  const spec = SPEC[variant]
  const lp = useLongPress((x, y) => onLongPress(act, x, y), !editing)

  const click = () => {
    if (lp.swallowClick()) return
    if (editing) onEdit(act)
    else onPress(act.id)
  }

  const dot = (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: act.color,
        boxShadow: `0 0 8px ${act.color}`,
        flex: 'none',
      }}
    />
  )

  const trailing = editing ? (
    <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.cyanBright, flex: 'none' }}>править ▸</span>
  ) : running ? (
    <span
      style={{
        marginLeft: 'auto',
        fontSize: 10.5,
        letterSpacing: '1.5px',
        color: C.cyanBright,
        animation: 'blink 1.4s ease-in-out infinite',
        flex: 'none',
      }}
    >
      ИДЁТ
    </span>
  ) : spec.ms && ms ? (
    <span
      style={{
        marginLeft: spec.msRight ? 'auto' : 0,
        fontFamily: MONO,
        fontSize: 10.5,
        color: C.faint,
        flex: 'none',
      }}
    >
      {ms}
    </span>
  ) : null

  const nameStyle: CSSProperties = spec.stack
    ? { fontSize: spec.font, fontWeight: 600, color: '#e9f1ff', letterSpacing: '.3px', lineHeight: 1.2, overflowWrap: 'anywhere' }
    : {
        fontSize: spec.font,
        fontWeight: 600,
        color: '#e9f1ff',
        letterSpacing: '.2px',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...(spec.msRight ? { flex: 1 } : null),
      }

  return (
    <div
      data-act-id={act.id}
      style={{
        position: 'relative',
        display: 'flex',
        minWidth: 0,
        ...(dragged ? { opacity: 0, pointerEvents: 'none' } : null),
      }}
    >
      <button
        className="h-tile"
        onClick={click}
        {...lp.handlers}
        style={{
          ...actTileShell(act.color, running),
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: editing ? 'grab' : 'pointer',
          padding: spec.pad,
          minHeight: spec.minH,
          borderRadius: spec.radius,
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: spec.stack ? 'column' : 'row',
          alignItems: spec.stack ? 'stretch' : 'center',
          justifyContent: spec.stack ? 'space-between' : 'flex-start',
          gap: spec.stack ? 6 : 8,
          ...(editing ? { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } : null),
        }}
      >
        <span style={nameStyle}>{act.name}</span>
        {spec.stack ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            {dot}
            {spec.cat && (
              <span style={{ fontSize: 10.5, letterSpacing: '.8px', color: C.muted, textTransform: 'uppercase' }}>
                {(CATS[act.cat] ?? OTHER).label}
              </span>
            )}
            {trailing}
          </span>
        ) : (
          <>
            {dot}
            {trailing}
          </>
        )}
      </button>

      {editing && (
        <button
          type="button"
          data-pin
          aria-pressed={!!act.pinned}
          aria-label={act.pinned ? `Открепить «${act.name}»` : `Закрепить «${act.name}»`}
          onClick={() => onTogglePin(act.id)}
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            zIndex: 1,
            width: 28,
            height: 28,
            borderRadius: 8,
            cursor: 'pointer',
            lineHeight: 1,
            fontFamily: 'inherit',
            fontSize: 13,
            background: act.pinned ? 'rgba(34,211,238,.16)' : 'rgba(11,17,33,.94)',
            border: `1px solid ${act.pinned ? 'rgba(94,234,255,.6)' : 'rgba(148,163,184,.32)'}`,
            color: act.pinned ? C.cyanBright : C.dim,
            ...(act.pinned ? { boxShadow: '0 0 10px rgba(34,211,238,.35)' } : null),
          }}
        >
          ★
        </button>
      )}
    </div>
  )
}
