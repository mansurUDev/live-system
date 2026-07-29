import { useMemo, useState } from 'react'
import { DAY_MS } from '../../constants'
import { catTotals, topActs, untrackedMs, weekdayTotals } from '../../logic/analytics'
import { buildHints } from '../../logic/hints'
import { segs, totalMs } from '../../logic/segs'
import { minuteOf, periodRange } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { page, periodBtn, plainCard } from '../../theme'
import { DonutCats } from './DonutCats'
import { GoalsCard } from './GoalsCard'
import { HintsCard } from './HintsCard'
import { SphereLines } from './SphereLines'
import { TopActs } from './TopActs'
import { WeekBars } from './WeekBars'
import type { Period } from '../../types'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

export function AnalyticsTab() {
  const { state } = useData()
  const now = useNow()
  const [period, setPeriod] = useState<Period>('week')

  const { sectors, acts, entries, snapshots } = state.doc

  // Пересчитываем раз в минуту, а не на каждый тик секундного таймера.
  const minute = minuteOf(now)

  const data = useMemo(() => {
    const stamp = minute * 60000
    const { from, to } = periodRange(period, stamp)
    const list = segs(entries, from, to, stamp)
    const weekSegs = segs(entries, stamp - 7 * DAY_MS, stamp, stamp)

    return {
      stamp,
      totals: catTotals(list, acts),
      total: totalMs(list),
      untracked: untrackedMs(list, from, to),
      weekdays: weekdayTotals(list),
      top: topActs(list, 5),
      hints: buildHints(sectors, weekSegs, acts),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, acts, sectors, period, minute])

  return (
    <main style={{ ...page, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => (
          <button key={p.key} style={periodBtn(period === p.key)} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {data.total > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
          <DonutCats totals={data.totals} total={data.total} untracked={data.untracked} />
          <WeekBars totals={data.weekdays} />
          <TopActs top={data.top} acts={acts} />
        </div>
      ) : (
        <div
          style={plainCard({
            padding: '26px 20px',
            textAlign: 'center',
            color: '#8fa0bd',
            fontSize: 15,
          })}
        >
          За этот период записей времени нет. Открой «Трекер времени» и нажми кнопку активности.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <SphereLines sectors={sectors} snapshots={snapshots} now={data.stamp} />
        <GoalsCard sectors={sectors} now={data.stamp} />
      </div>

      <HintsCard hints={data.hints} />
    </main>
  )
}
