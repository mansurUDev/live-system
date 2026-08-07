import { CATS, OTHER } from '../../constants'
import { useLongPress } from '../../hooks/useLongPress'
import { fmtClock, hhmm } from '../../logic/time'
import { actBy } from '../../logic/analytics'
import { C, card, chipDot, MONO } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  running: TimeEntry | null
  acts: Activity[]
  now: number
  /** телефон: сжатая раскладка, слот цепочки уезжает отдельной строкой (ChainSlot снаружи) */
  compact: boolean
  /** цель цепочки идущей активности; null — nextId нет или кнопка-цель удалена */
  nextAct: Activity | null
  onStop: () => void
  onChain: (next: Activity) => void
  onChainLongPress: (next: Activity, x: number, y: number) => void
}

export function RunningBar({ running, acts, now, compact, nextAct, onStop, onChain, onChainLongPress }: Props) {
  const act = running ? actBy(acts, running.actId) : null
  const color = act?.color ?? '#334155'
  const started = running ? new Date(running.start).getTime() : 0

  const style = card({
    padding: compact ? '12px 14px' : '16px 20px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: compact ? '10px 14px' : '12px 28px',
    justifyContent: 'space-between',
    ...(running
      ? {
          borderColor: `${color}66`,
          boxShadow: `0 0 24px ${color}2e, inset 0 0 30px ${color}10`,
        }
      : null),
  })

  if (!running) {
    return (
      <div style={style}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>Сейчас</div>
          <div style={{ fontSize: compact ? 15 : 18, fontWeight: 500, color: C.muted, marginTop: 2 }}>
            Ничего не отслеживается
          </div>
          {!compact && (
            <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>
              Нажми кнопку активности — время пойдёт с этого момента
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 12px ${color}`,
            animation: 'blink 1.4s ease-in-out infinite',
            flex: 'none',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>Сейчас</div>
          <div
            style={{
              fontSize: compact ? 18 : 21,
              fontWeight: 600,
              color: C.textBright,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
            }}
          >
            {act?.name ?? 'Удалённая активность'}
          </div>
          {!compact && (
            <div style={{ fontSize: 12.5, color: C.muted }}>
              {(act && CATS[act.cat] ? CATS[act.cat].label : OTHER.label) + ' · с ' + hhmm(started)}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          fontFamily: MONO,
          fontSize: compact ? 26 : 40,
          fontWeight: 600,
          color: C.cyanBright,
          textShadow: '0 0 22px rgba(34,211,238,.55)',
          letterSpacing: '1px',
        }}
      >
        {fmtClock(now - started)}
      </div>

      <button
        className="h-danger"
        aria-label="Стоп"
        style={
          compact
            ? {
                fontFamily: 'inherit',
                fontSize: 16,
                color: C.dangerPale,
                background: 'rgba(248,113,113,.1)',
                border: '1px solid rgba(248,113,113,.45)',
                borderRadius: 10,
                width: 40,
                height: 40,
                cursor: 'pointer',
                flex: 'none',
              }
            : {
                fontFamily: 'inherit',
                fontSize: 13.5,
                color: C.dangerPale,
                background: 'rgba(248,113,113,.1)',
                border: '1px solid rgba(248,113,113,.45)',
                borderRadius: 10,
                padding: '9px 16px',
                cursor: 'pointer',
                letterSpacing: '.5px',
              }
        }
        onClick={onStop}
      >
        {compact ? '■' : '■ Стоп'}
      </button>

      {!compact && nextAct && <ChainSlot nextAct={nextAct} onChain={onChain} onLongPress={onChainLongPress} />}
    </div>
  )
}

interface ChainSlotProps {
  variant?: 'inline' | 'row'
  nextAct: Activity
  onChain: (next: Activity) => void
  onLongPress: (next: Activity, x: number, y: number) => void
}

/**
 * Чип «дальше → …» — один тап закрывает текущую запись и стартует следующую
 * встык (см. TrackerTab.chain — это dispatch(A.pressAct(next.id))). Долгое
 * нажатие 430мс — тот же BackdateMenu, что и на плитках: «перешёл раньше».
 */
export function ChainSlot({ variant = 'inline', nextAct, onChain, onLongPress }: ChainSlotProps) {
  const lp = useLongPress((x, y) => onLongPress(nextAct, x, y))
  const color = nextAct.color

  const click = () => {
    if (lp.swallowClick()) return
    onChain(nextAct)
  }

  if (variant === 'row') {
    return (
      <button
        className="h-bright"
        onClick={click}
        {...lp.handlers}
        style={{
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          border: `1px solid ${color}45`,
          background: `${color}0e`,
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 13.5,
          color: C.textSoft,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={chipDot(color)} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            дальше → {nextAct.name}
          </span>
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '1.5px',
            color: C.dim,
            textTransform: 'uppercase',
            flex: 'none',
          }}
        >
          в один тап
        </span>
      </button>
    )
  }

  return (
    <button
      className="h-bright"
      onClick={click}
      {...lp.handlers}
      style={{
        fontFamily: 'inherit',
        fontSize: 12.5,
        color: C.textSoft,
        border: `1px solid ${color}55`,
        background: `${color}12`,
        borderRadius: 999,
        padding: '6px 13px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        maxWidth: 260,
      }}
    >
      <span style={chipDot(color)} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        дальше → {nextAct.name}
      </span>
    </button>
  )
}
