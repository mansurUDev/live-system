import { useMemo } from 'react'
import { SPHERE_CHART_DAYS } from '../../constants'
import { addDays, fmtDayMonth, localDateKey, startOfDay } from '../../logic/time'
import { C, chipDot, MONO, plainCard, sectionLabel } from '../../theme'
import type { Sector, Snapshots } from '../../types'

interface Props {
  sectors: Sector[]
  snapshots: Snapshots
  now: number
}

const VB_W = 640
const VB_H = 210
const X0 = 12
const X1 = 628
const Y_TOP = 196
const Y_SCALE = 1.8

/**
 * Динамика оценок сфер по дневным снимкам.
 *
 * Линии строятся по текущим секторам: если сектора нет в старом снимке, серия
 * просто начинается позже, а пропущенный день рвёт линию — соединять точки через
 * дыру означало бы придумывать данные.
 */
export function SphereLines({ sectors, snapshots, now }: Props) {
  const { series, firstKey, lastKey, hasData } = useMemo(() => {
    const from = localDateKey(addDays(startOfDay(now), -(SPHERE_CHART_DAYS - 1)))
    const keys = Object.keys(snapshots)
      .filter((k) => k >= from)
      .sort()

    const x = (i: number) => (keys.length > 1 ? X0 + (i * (X1 - X0)) / (keys.length - 1) : (X0 + X1) / 2)

    const series = sectors
      .filter((s) => s.kind === 'sphere')
      .map((s) => {
        const runs: { x: number; y: number }[][] = []
        let current: { x: number; y: number }[] = []
        keys.forEach((k, i) => {
          const rec = snapshots[k]?.sectors.find((q) => q.id === s.id)
          if (!rec) {
            if (current.length) runs.push(current)
            current = []
            return
          }
          current.push({ x: Number(x(i).toFixed(1)), y: Number((Y_TOP - rec.p * Y_SCALE).toFixed(1)) })
        })
        if (current.length) runs.push(current)
        return { id: s.id, name: s.name, color: s.color, runs, points: runs.flat() }
      })
      .filter((l) => l.points.length > 0)

    return {
      series,
      firstKey: keys[0] ?? '',
      lastKey: keys.at(-1) ?? '',
      hasData: keys.length >= 2 && series.some((l) => l.points.length >= 2),
    }
  }, [sectors, snapshots, now])

  return (
    <div style={plainCard({ padding: '16px 18px' })}>
      <div style={sectionLabel}>Динамика сфер · {SPHERE_CHART_DAYS} дней</div>

      {hasData ? (
        <>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 10 }}>
            <line x1={10} y1={16} x2={630} y2={16} stroke="rgba(148,163,184,.12)" strokeWidth={1} strokeDasharray="3 5" />
            <line x1={10} y1={106} x2={630} y2={106} stroke="rgba(148,163,184,.12)" strokeWidth={1} strokeDasharray="3 5" />
            <line x1={10} y1={196} x2={630} y2={196} stroke="rgba(148,163,184,.25)" strokeWidth={1} />
            {series.map((l) => (
              <g key={l.id}>
                {l.runs.map((run, i) => (
                  <polyline
                    key={i}
                    points={run.map((p) => p.x + ',' + p.y).join(' ')}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    style={{ filter: `drop-shadow(0 0 4px ${l.color}aa)` }}
                  />
                ))}
                {l.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill={l.color} />
                ))}
              </g>
            ))}
          </svg>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: MONO,
              fontSize: 11,
              color: C.faint,
              marginTop: 2,
            }}
          >
            <span>{fmtDayMonth(firstKey)}</span>
            <span>{fmtDayMonth(lastKey)}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 9 }}>
            {series.map((l) => (
              <span
                key={l.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textSoft }}
              >
                <span style={chipDot(l.color)} />
                {l.name}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13.5, color: C.faint, marginTop: 10 }}>
          График появится после нескольких дней использования — снимок колеса сохраняется раз в день.
        </div>
      )}
    </div>
  )
}
