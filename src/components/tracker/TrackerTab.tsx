import { useState } from 'react'
import { MAX_ACTS } from '../../constants'
import { actBy } from '../../logic/analytics'
import { runningEntry } from '../../logic/segs'
import { addDays, startOfDay } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { page } from '../../theme'
import { ActModal } from '../modals/ActModal'
import { EntryModal } from '../modals/EntryModal'
import { ActGrid } from './ActGrid'
import { DayView } from './DayView'
import { RunningBar } from './RunningBar'
import type { Activity, TimeEntry } from '../../types'

type ActForm = { act: Activity | null } | null
type EntryForm = { entry: TimeEntry | null } | null

export function TrackerTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()

  const [dayOffset, setDayOffset] = useState(0)
  const [editing, setEditing] = useState(false)
  const [actForm, setActForm] = useState<ActForm>(null)
  const [entryForm, setEntryForm] = useState<EntryForm>(null)

  const { acts, entries } = state.doc
  const running = runningEntry(entries)

  const press = (id: string) => {
    if (running?.actId === id) {
      toast(`«${actBy(acts, id)?.name ?? 'Активность'}» уже идёт`)
      return
    }
    dispatch(A.pressAct(id))
  }

  const openNewAct = () => {
    if (acts.length >= MAX_ACTS) {
      toast(`Максимум ${MAX_ACTS} кнопок — удали ненужные`)
      return
    }
    setActForm({ act: null })
  }

  return (
    <main style={{ ...page, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <RunningBar
        running={running}
        acts={acts}
        now={now}
        onStop={() => {
          dispatch(A.stopTrack())
          toast('Отсчёт остановлен')
        }}
      />

      <ActGrid
        acts={acts}
        running={running}
        editing={editing}
        onPress={press}
        onEdit={(act) => setActForm({ act })}
        onToggleEditing={() => setEditing((v) => !v)}
        onAdd={openNewAct}
      />

      <DayView
        entries={entries}
        acts={acts}
        now={now}
        dayOffset={dayOffset}
        onPrevDay={() => setDayOffset((d) => d - 1)}
        onNextDay={() => setDayOffset((d) => Math.min(0, d + 1))}
        onEditEntry={(entry) => setEntryForm({ entry })}
        onAddBackdated={() => {
          if (!acts.length) {
            toast('Сначала добавь хотя бы одну кнопку активности')
            return
          }
          setEntryForm({ entry: null })
        }}
      />

      {actForm && (
        <ActModal
          act={actForm.act}
          entries={entries}
          onCancel={() => setActForm(null)}
          onSave={(act) => {
            dispatch(A.saveAct(act))
            setActForm(null)
          }}
          onDelete={(id) => {
            dispatch(A.deleteAct(id))
            setActForm(null)
            toast('Кнопка удалена — старые записи остались')
          }}
        />
      )}

      {entryForm && (
        <EntryModal
          entry={entryForm.entry}
          acts={acts}
          entries={entries}
          defaultDayStart={addDays(startOfDay(now), dayOffset)}
          onCancel={() => setEntryForm(null)}
          onSave={(entry) => {
            dispatch(A.saveEntry(entry))
            setEntryForm(null)
          }}
          onDelete={(id) => {
            dispatch(A.deleteEntry(id))
            setEntryForm(null)
            toast('Запись удалена')
          }}
        />
      )}
    </main>
  )
}
