import { fmtDur } from '../../logic/time'
import { C, plainCard, sectionLabel } from '../../theme'

const LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function WeekBars({ totals }: { totals: number[] }) {
  const max = Math.max(1, ...totals)

  return (
    <div style={plainCard({ padding: '16px 18px' })}>
      <div style={sectionLabel}>По дням недели</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, marginTop: 14 }}>
        {LABELS.map((label, i) => {
          const ms = totals[i] ?? 0
          return (
            <div
              key={label}
              title={`${label}: ${fmtDur(ms)}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                style={
                  ms > 0
                    ? {
                        width: '100%',
                        borderRadius: '4px 4px 2px 2px',
                        height: Math.max(3, Math.round((ms / max) * 100)) + '%',
                        background: 'linear-gradient(180deg,#3ce0f8,#0e7c96)',
                        boxShadow: '0 0 10px rgba(34,211,238,.35)',
                      }
                    : { width: '100%', borderRadius: 4, height: 3, background: 'rgba(148,163,184,.15)' }
                }
              />
              <div style={{ fontSize: 11.5, color: C.dim }}>{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
