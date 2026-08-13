import { useState } from 'react'
import { MAX_HABITS, MAX_REMINDERS } from '../../constants'
import { bestStreak, bestWithout, daysWithout, isDoneToday, recentDays, streak } from '../../logic/habits'
import { plural } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { btnAccent, C, pageStyle, plainCard } from '../../theme'
import { HabitModal } from '../modals/HabitModal'
import { ReminderModal } from '../modals/ReminderModal'
import { DoHabitCard } from './DoHabitCard'
import { LogHabitCard } from './LogHabitCard'
import { QuitHabitCard } from './QuitHabitCard'
import { ReminderCard } from './ReminderCard'
import type { Habit, Reminder } from '../../types'

type Form = { habit: Habit | null } | null
type ReminderForm = { reminder: Reminder | null } | null

export function HabitsTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const [form, setForm] = useState<Form>(null)
  const [reminderForm, setReminderForm] = useState<ReminderForm>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  const habits = state.doc.habits
  const dos = habits.filter((h) => h.type === 'do')
  const quits = habits.filter((h) => h.type === 'quit')
  const logs = habits.filter((h) => h.type === 'log')
  const reminders = state.doc.reminders

  const toggle = (h: Habit) => {
    const wasDone = isDoneToday(h, now)
    dispatch(A.toggleHabit(h.id))
    if (!wasDone) {
      setFlashId(h.id)
      setTimeout(() => setFlashId(null), 780)
    }
  }

  // правка позиции видео из карточки: заметка пересобирается с новой ссылкой
  const updateNote = (h: Habit, note: string) => dispatch(A.saveHabit({ ...h, note }))

  const breakQuit = (h: Habit, why: string) => {
    const record = bestWithout(h, now)
    dispatch(A.breakQuit(h.id, why))
    setConfirmId(null)
    toast(`Записал в журнал. Рекорд — ${record} ${plural(record, 'день', 'дня', 'дней')}, побьёшь.`)
  }

  const openNew = () => {
    if (habits.length >= MAX_HABITS) {
      toast(`Привычек уже ${MAX_HABITS} — больше не поместится`)
      return
    }
    setForm({ habit: null })
  }

  const openNewReminder = () => {
    if (reminders.length >= MAX_REMINDERS) {
      toast(`Напоминаний уже ${MAX_REMINDERS} — больше не поместится`)
      return
    }
    setReminderForm({ reminder: null })
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Делаю каждый день</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>отметь — серия растёт</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={openNew}>
          + Привычка
        </button>
      </div>

      {dos.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dos.map((h) => (
            <DoHabitCard
              key={h.id}
              habit={h}
              done={isDoneToday(h, now)}
              streak={streak(h, now)}
              best={bestStreak(h, now)}
              days={recentDays(h, 14, now)}
              flash={flashId === h.id}
              onToggle={() => toggle(h)}
              onEdit={() => setForm({ habit: h })}
              onUpdateNote={(note) => updateNote(h, note)}
            />
          ))}
        </div>
      ) : (
        <div style={plainCard({ padding: '20px 18px', color: C.faint, fontSize: 14 })}>
          Пока пусто — добавь первую полезную привычку
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Держусь без</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>счётчик растёт сам — просто держись</div>
      </div>

      {quits.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(240px,1fr))',
            gap: 12,
          }}
        >
          {quits.map((h) => (
            <QuitHabitCard
              key={h.id}
              habit={h}
              days={daysWithout(h, now)}
              best={bestWithout(h, now)}
              confirming={confirmId === h.id}
              onAsk={() => setConfirmId(h.id)}
              onCancel={() => setConfirmId(null)}
              onBreak={(why) => breakQuit(h, why)}
              onEdit={() => setForm({ habit: h })}
              onUpdateNote={(note) => updateNote(h, note)}
            />
          ))}
        </div>
      ) : (
        <div style={plainCard({ padding: '20px 18px', color: C.faint, fontSize: 14, lineHeight: 1.5 })}>
          Добавь привычку «держусь без» — счётчик начнёт расти с этой секунды
        </div>
      )}

      {logs.length > 0 && (
        <>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Замеры</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>
              число без оценки — для того, что не полностью в твоей власти
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {logs.map((h) => (
              <LogHabitCard
                key={h.id}
                habit={h}
                onLog={(minutes) => dispatch(A.logHabit(h.id, minutes))}
                onEdit={() => setForm({ habit: h })}
                onUpdateNote={(note) => updateNote(h, note)}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Напоминания</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>
            для того, что нужно делать не каждый день, а раз в период — обновить профиль, продлить
            подписку и т.п.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={openNewReminder}>
          + Напоминание
        </button>
      </div>

      {reminders.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              now={now}
              onMarkDone={() => {
                dispatch(A.markReminderDone(r.id))
                toast('Отмечено — отсчёт пошёл заново')
              }}
              onEdit={() => setReminderForm({ reminder: r })}
            />
          ))}
        </div>
      ) : (
        <div style={plainCard({ padding: '20px 18px', color: C.faint, fontSize: 14, lineHeight: 1.5 })}>
          Например: «Обновить LinkedIn» или «Обновить профиль Upwork» — раз в месяц достаточно
        </div>
      )}

      {form && (
        <HabitModal
          habit={form.habit}
          usedColors={habits.map((h) => h.color)}
          onCancel={() => setForm(null)}
          onSave={(h) => {
            dispatch(A.saveHabit(h))
            setForm(null)
          }}
          onDelete={(id) => {
            dispatch(A.deleteHabit(id))
            setForm(null)
            toast('Привычка удалена')
          }}
        />
      )}

      {reminderForm && (
        <ReminderModal
          reminder={reminderForm.reminder}
          onCancel={() => setReminderForm(null)}
          onSave={(r) => {
            dispatch(A.saveReminder(r))
            setReminderForm(null)
          }}
          onDelete={(id) => {
            dispatch(A.deleteReminder(id))
            setReminderForm(null)
            toast('Напоминание удалено')
          }}
        />
      )}
    </main>
  )
}
