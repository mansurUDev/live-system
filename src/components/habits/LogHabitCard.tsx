import { useState } from 'react'
import { avgLog, fmtClockMin, parseClock, recentLogs } from '../../logic/habits'
import { localDateKey } from '../../logic/time'
import { useNow } from '../../state/NowProvider'
import { btnGhostSm, C, input, MONO, plainCard } from '../../theme'
import type { Habit } from '../../types'

interface Props {
  habit: Habit
  onLog: (minutes: number) => void
  onEdit: () => void
}

/**
 * Замер: число без оценки. Для того, что не полностью в твоей власти, — время
 * отбоя в чужом доме нельзя «выполнить», но можно честно записать и через
 * месяц увидеть картину, с которой уже можно что-то решать.
 */
export function LogHabitCard({ habit, onLog, onEdit }: Props) {
  const now = useNow()
  const c = habit.color
  const today = habit.logs[localDateKey(now)]
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(false)

  const avg = avgLog(habit, 7, now)
  const week = recentLogs(habit, 7, now)

  const save = () => {
    const m = parseClock(draft)
    if (m === null) {
      setError(true)
      return
    }
    onLog(m)
    setDraft('')
    setError(false)
  }

  return (
    <div style={plainCard({ padding: '14px 16px 12px', position: 'relative' })}>
      <button
        className="h-edit"
        onClick={onEdit}
        aria-label="Изменить привычку"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          fontFamily: 'inherit',
          fontSize: 12,
          color: C.muted,
          background: 'none',
          border: '1px solid rgba(148,163,184,.3)',
          borderRadius: 7,
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        ✎
      </button>

      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#e9f1ff', overflowWrap: 'anywhere', paddingRight: 30 }}>
        {habit.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 600, color: c, textShadow: `0 0 16px ${c}55` }}>
            {today !== undefined ? fmtClockMin(today) : '—:—'}
          </span>
          <span style={{ fontSize: 11.5, letterSpacing: '1.5px', color: C.dim, textTransform: 'uppercase', marginLeft: 8 }}>
            сегодня
          </span>
        </div>
        {avg !== null && (
          <div style={{ fontSize: 12.5, color: C.muted }}>
            в среднем за неделю — <span style={{ fontFamily: MONO, color: C.textSoft }}>{fmtClockMin(avg)}</span>
          </div>
        )}
      </div>

      {/* последние 7 дней: просто значения, без красного и зелёного */}
      <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
        {week.map((v, i) => (
          <span
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: v === null ? C.faint : C.textSoft,
              background: v === null ? 'rgba(148,163,184,.06)' : `${c}14`,
              border: `1px solid ${v === null ? 'rgba(148,163,184,.14)' : c + '33'}`,
              borderRadius: 6,
              padding: '3px 7px',
            }}
          >
            {v === null ? '·' : fmtClockMin(v)}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          inputMode="numeric"
          placeholder="0:40"
          style={{ ...input, marginTop: 0, width: 90, flex: 'none', fontFamily: MONO, ...(error ? { borderColor: 'rgba(248,113,113,.6)' } : null) }}
        />
        <button className="h-ghost-bright" style={btnGhostSm} onClick={save}>
          {today !== undefined ? 'Исправить' : 'Записать'}
        </button>
        {error && <span style={{ fontSize: 12, color: C.dangerText }}>время в формате чч:мм</span>}
      </div>
    </div>
  )
}
