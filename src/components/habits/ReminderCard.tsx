import { daysOverdue, isOverdue } from '../../logic/reminders'
import { fmtD, plural } from '../../logic/time'
import { btnAccent, C, MONO, plainCard } from '../../theme'
import type { Reminder } from '../../types'

interface Props {
  reminder: Reminder
  now: number
  onMarkDone: () => void
  onEdit: () => void
}

export function ReminderCard({ reminder, now, onMarkDone, onEdit }: Props) {
  const overdue = isOverdue(reminder, now)
  const overdueBy = daysOverdue(reminder, now)
  const statusColor = overdue ? C.danger : overdueBy >= -7 ? '#fbbf24' : C.ok

  return (
    <div style={plainCard({ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 })}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#e9f1ff', overflowWrap: 'anywhere' }}>
          {reminder.name}
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3 }}>
          {reminder.lastDone ? 'отмечено ' + fmtD(reminder.lastDone, now) : 'ни разу не отмечалось'} · раз в{' '}
          {reminder.intervalDays} {plural(reminder.intervalDays, 'день', 'дня', 'дней')}
        </div>
      </div>

      <div style={{ textAlign: 'center', flex: 'none', minWidth: 62 }}>
        <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: statusColor }}>
          {overdue ? '+' + overdueBy : Math.abs(overdueBy)}
        </div>
        <div style={{ fontSize: 9.5, letterSpacing: '1px', color: C.dim, textTransform: 'uppercase' }}>
          {overdue ? 'просрочено' : 'дней ещё'}
        </div>
      </div>

      <button
        className="h-accent"
        style={{ ...btnAccent, fontSize: 13, padding: '8px 13px', flex: 'none' }}
        onClick={onMarkDone}
      >
        Готово
      </button>

      <button
        className="h-edit"
        onClick={onEdit}
        aria-label="Изменить напоминание"
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
  )
}
