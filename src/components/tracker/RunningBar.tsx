import { CATS, OTHER } from '../../constants'
import { fmtClock, hhmm } from '../../logic/time'
import { actBy } from '../../logic/analytics'
import { C, card, MONO } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  running: TimeEntry | null
  acts: Activity[]
  now: number
  /** телефон: сжатая раскладка, слот цепочки уезжает отдельной строкой (ChainSlot снаружи) */
  compact: boolean
  onStop: () => void
}

export function RunningBar({ running, acts, now, compact, onStop }: Props) {
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

      {!compact && <ChainSlot />}
    </div>
  )
}

/**
 * Заглушка слота цепочек «дальше обычно → …» — источник данных и заполнение
 * появятся отдельным этапом; здесь только зарезервированное место в UI.
 */
export function ChainSlot({ variant = 'inline' }: { variant?: 'inline' | 'row' }) {
  if (variant === 'row') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          border: '1px dashed rgba(148,163,184,.32)',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ color: C.dim }}>дальше → …</span>
        <span style={{ fontSize: 10, letterSpacing: '1.5px', color: C.faint, textTransform: 'uppercase' }}>
          Цепочка · скоро
        </span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: '1.5px', color: C.faint, textTransform: 'uppercase' }}>
        Цепочка · скоро
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: C.dim,
          border: '1px dashed rgba(148,163,184,.35)',
          borderRadius: 999,
          padding: '5px 12px',
        }}
      >
        дальше → …
      </span>
    </div>
  )
}
