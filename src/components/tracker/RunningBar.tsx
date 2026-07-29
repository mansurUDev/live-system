import { CATS, OTHER } from '../../constants'
import { fmtClock, hhmm } from '../../logic/time'
import { actBy } from '../../logic/analytics'
import { C, card, MONO } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  running: TimeEntry | null
  acts: Activity[]
  now: number
  onStop: () => void
}

export function RunningBar({ running, acts, now, onStop }: Props) {
  const act = running ? actBy(acts, running.actId) : null
  const color = act?.color ?? '#334155'
  const started = running ? new Date(running.start).getTime() : 0

  const style = card({
    padding: '16px 20px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px 28px',
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
          <div style={{ fontSize: 18, fontWeight: 500, color: C.muted, marginTop: 2 }}>Ничего не отслеживается</div>
          <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>
            Нажми кнопку активности — время пойдёт с этого момента
          </div>
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
          <div style={{ fontSize: 21, fontWeight: 600, color: C.textBright, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
            {act?.name ?? 'Удалённая активность'}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted }}>
            {(act && CATS[act.cat] ? CATS[act.cat].label : OTHER.label) + ' · с ' + hhmm(started)}
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: MONO,
          fontSize: 40,
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
        style={{
          fontFamily: 'inherit',
          fontSize: 13.5,
          color: C.dangerPale,
          background: 'rgba(248,113,113,.1)',
          border: '1px solid rgba(248,113,113,.45)',
          borderRadius: 10,
          padding: '9px 16px',
          cursor: 'pointer',
          letterSpacing: '.5px',
        }}
        onClick={onStop}
      >
        ■ Стоп
      </button>
    </div>
  )
}
