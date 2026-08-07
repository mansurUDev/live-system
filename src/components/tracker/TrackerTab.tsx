import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { HOT_MAX, MAX_ACTS } from '../../constants'
import { actBy, actTotals } from '../../logic/analytics'
import { canPin, hotDockHeight, splitActs } from '../../logic/actLayout'
import { segs, runningEntry } from '../../logic/segs'
import { addDays, hhmm, minuteOf, startOfDay } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTrackerZone, type Zone } from '../../hooks/useTrackerZone'
import { pageStyle } from '../../theme'
import { ActModal } from '../modals/ActModal'
import { EntryModal } from '../modals/EntryModal'
import { ActBoard } from './ActBoard'
import { BackdateMenu, type BackdateTarget } from './BackdateMenu'
import { DayView } from './DayView'
import { HotDock } from './HotDock'
import { RunningBar, ChainSlot } from './RunningBar'
import type { Activity, TimeEntry } from '../../types'

type ActForm = { act: Activity | null } | null
type EntryForm = { entry: TimeEntry | null } | null

/**
 * Горячий ряд (8 колонок) и полосы (до 5 колонок) требуют куда больше места,
 * чем стандартный контейнер страницы (maxWidth 1220 — рассчитан на карточки
 * остальных вкладок). На ноутбуке и внешних мониторах доска использует почти
 * всю ширину — как в утверждённых макетах tracker-1512.png / tracker-2560.png.
 */
function boardPageStyle(zone: Zone, isMobile: boolean): CSSProperties {
  if (zone === 'phone') return pageStyle(isMobile)
  return { maxWidth: 2400, margin: '0 auto', padding: '0 18px 70px', boxSizing: 'border-box' }
}

export function TrackerTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const zone = useTrackerZone()

  const [dayOffset, setDayOffset] = useState(0)
  const [editing, setEditing] = useState(false)
  const [actForm, setActForm] = useState<ActForm>(null)
  const [entryForm, setEntryForm] = useState<EntryForm>(null)
  const [backdate, setBackdate] = useState<BackdateTarget | null>(null)

  const { acts, entries } = state.doc
  const running = runningEntry(entries)
  const runningId = running?.actId ?? null

  // минуты за сегодня на плитках — та же логика окна, что в DayView, но
  // мемоизация по минуте, а не по секундному тику useNow()
  const minute = minuteOf(now)
  const todayMs = useMemo(() => {
    const stamp = minute * 60000
    return actTotals(segs(entries, startOfDay(stamp), stamp, stamp))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, minute])

  const hot = useMemo(() => splitActs(acts).hot, [acts])

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

  const togglePin = (id: string) => {
    const act = actBy(acts, id)
    if (!act) return
    if (!canPin(acts, id)) {
      toast(`В горячем ряду максимум ${HOT_MAX} — открепи что-нибудь`)
      return
    }
    dispatch(A.toggleActPin(id))
    toast(act.pinned ? `«${act.name}» вернулась в полосу` : `«${act.name}» — в горячем ряду`)
  }

  return (
    <main style={{ ...boardPageStyle(zone, isMobile), display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
      <RunningBar
        running={running}
        acts={acts}
        now={now}
        compact={zone === 'phone'}
        onStop={() => {
          dispatch(A.stopTrack())
          toast('Отсчёт остановлен')
        }}
      />

      {zone === 'phone' && <ChainSlot variant="row" />}

      <ActBoard
        acts={acts}
        runningId={runningId}
        zone={zone}
        todayMs={todayMs}
        editing={editing}
        onPress={press}
        onEdit={(act) => setActForm({ act })}
        onToggleEditing={() => setEditing((v) => !v)}
        onAdd={openNewAct}
        onLongPress={(act, x, y) => setBackdate({ id: act.id, name: act.name, color: act.color, x, y })}
        onTogglePin={togglePin}
      />

      {zone === 'phone' && (
        <HotDock
          hot={hot}
          runningId={runningId}
          todayMs={todayMs}
          editing={editing}
          onPress={press}
          onEdit={(act) => setActForm({ act })}
          onLongPress={(act, x, y) => setBackdate({ id: act.id, name: act.name, color: act.color, x, y })}
          onTogglePin={togglePin}
        />
      )}

      {backdate && (
        <BackdateMenu
          target={backdate}
          onClose={() => setBackdate(null)}
          onPick={(min) => {
            dispatch(A.pressAct(backdate.id, min))
            setBackdate(null)
            toast(`«${backdate.name}» — идёт с ${hhmm(Date.now() - min * 60_000)}`)
          }}
        />
      )}

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

      {zone === 'phone' && hot.length > 0 && <div aria-hidden style={{ height: hotDockHeight(hot.length) }} />}

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
