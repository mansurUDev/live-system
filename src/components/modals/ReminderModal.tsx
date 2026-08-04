import { useState } from 'react'
import { Modal } from './Modal'
import { DEFAULT_REMINDER_INTERVAL_DAYS, MAX_REMINDER_INTERVAL_DAYS, MAX_REMINDER_NAME, MIN_REMINDER_INTERVAL_DAYS } from '../../constants'
import { A } from '../../state/actions'
import { btnAccent, btnCancelSm, btnDeleteConfirm, btnDeleteLink, btnGhost, C, chipBtn, errText, fieldLabel, input } from '../../theme'
import type { Reminder } from '../../types'

const PRESETS = [
  { days: 7, label: 'неделя' },
  { days: 30, label: 'месяц' },
  { days: 90, label: 'квартал' },
  { days: 180, label: 'полгода' },
]

interface Props {
  /** null — создаём новое */
  reminder: Reminder | null
  onCancel: () => void
  onSave: (reminder: Reminder) => void
  onDelete: (id: string) => void
}

export function ReminderModal({ reminder, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(reminder?.name ?? '')
  const [intervalText, setIntervalText] = useState(String(reminder?.intervalDays ?? DEFAULT_REMINDER_INTERVAL_DAYS))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')

    const parsed = parseInt(intervalText, 10)
    if (!Number.isFinite(parsed) || parsed < MIN_REMINDER_INTERVAL_DAYS || parsed > MAX_REMINDER_INTERVAL_DAYS) {
      return setError(`Период — от ${MIN_REMINDER_INTERVAL_DAYS} до ${MAX_REMINDER_INTERVAL_DAYS} дней`)
    }

    onSave(
      reminder
        ? { ...reminder, name: trimmed.slice(0, MAX_REMINDER_NAME), intervalDays: parsed }
        : A.newReminder(trimmed.slice(0, MAX_REMINDER_NAME), parsed),
    )
  }

  return (
    <Modal
      title={reminder ? 'Напоминание' : 'Новое напоминание'}
      width={420}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {reminder &&
            (confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={() => onDelete(reminder.id)}>
                  Точно удалить
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Удалить
              </button>
            ))}
          <div style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            Сохранить
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Название</div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          type="text"
          maxLength={MAX_REMINDER_NAME}
          placeholder="например, Обновить LinkedIn"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Как часто напоминать</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {PRESETS.map((p) => (
            <button
              key={p.days}
              style={chipBtn(intervalText === String(p.days), '#22d3ee')}
              onClick={() => {
                setIntervalText(String(p.days))
                setError('')
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={intervalText}
          onChange={(e) => {
            setIntervalText(e.target.value)
            setError('')
          }}
          type="text"
          inputMode="numeric"
          placeholder="30"
          style={{ ...input, marginTop: 8, width: 100 }}
        />
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>дней между отметками</div>
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
