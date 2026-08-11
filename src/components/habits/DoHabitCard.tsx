import { plural } from '../../logic/time'
import { C, MONO, plainCard } from '../../theme'
import { RichText } from '../RichText'
import type { Habit } from '../../types'

interface Props {
  habit: Habit
  done: boolean
  streak: number
  best: number
  /** лента последних дней, от старых к сегодняшнему */
  days: boolean[]
  flash: boolean
  onToggle: () => void
  onEdit: () => void
}

export function DoHabitCard({ habit, done, streak, best, days, flash, onToggle, onEdit }: Props) {
  const c = habit.color

  return (
    <div style={plainCard({ padding: '12px 14px' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onToggle}
          aria-label={done ? 'Снять отметку' : 'Отметить сегодня'}
          style={{
            width: 48,
            height: 48,
            flex: 'none',
            borderRadius: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: '#051018',
            border: `1.5px solid ${done ? c : c + '55'}`,
            background: done ? `linear-gradient(180deg,${c},${c}cc)` : c + '12',
            boxShadow: done ? `0 0 16px ${c}66` : 'none',
            transition: 'background .2s, box-shadow .2s',
            padding: 0,
            ...(flash ? { animation: 'checkFlash .7s ease' } : null),
          }}
        >
          {done ? '✓' : ''}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15.5,
              fontWeight: 600,
              overflowWrap: 'anywhere',
              color: done ? C.muted : '#e9f1ff',
              ...(done ? { textDecoration: 'line-through' } : null),
            }}
          >
            {habit.name}
          </div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
            рекорд {best} {plural(best, 'день', 'дня', 'дней')}
          </div>
          {habit.note && (
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <RichText text={habit.note} color={c} />
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', flex: 'none' }}>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: c, textShadow: `0 0 12px ${c}55` }}>
            {streak > 0 ? '🔥 ' + streak : '—'}
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: '1.5px', color: C.dim, textTransform: 'uppercase' }}>
            подряд
          </div>
        </div>

        <button
          className="h-edit"
          onClick={onEdit}
          aria-label="Изменить привычку"
          style={{
            fontFamily: 'inherit',
            fontSize: 12,
            color: C.muted,
            background: 'none',
            border: '1px solid rgba(148,163,184,.3)',
            borderRadius: 7,
            padding: '4px 9px',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          ✎
        </button>
      </div>

      {/* лента последних двух недель: видно, где рвалось */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        {days.map((on, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: on ? c : 'rgba(148,163,184,.14)',
              boxShadow: on ? `0 0 7px ${c}66` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}
