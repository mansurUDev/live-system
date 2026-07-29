import { actColor, actName, type TopAct } from '../../logic/analytics'
import { fmtDur } from '../../logic/time'
import { C, chipDot, MONO, plainCard, sectionLabel } from '../../theme'
import type { Activity } from '../../types'

interface Props {
  top: TopAct[]
  acts: Activity[]
}

export function TopActs({ top, acts }: Props) {
  const max = top[0]?.ms ?? 1

  return (
    <div style={plainCard({ padding: '16px 18px' })}>
      <div style={sectionLabel}>Топ активностей</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 13 }}>
        {top.map((t) => {
          const color = actColor(acts, t.actId)
          return (
            <div key={t.actId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={chipDot(color)} />
                <span style={{ fontSize: 14, color: C.text, flex: 1, overflowWrap: 'anywhere' }}>
                  {actName(acts, t.actId)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{fmtDur(t.ms)}</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(148,163,184,.1)',
                  marginTop: 5,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: Math.max(2, Math.round((t.ms / max) * 100)) + '%',
                    background: color,
                    boxShadow: `0 0 8px ${color}66`,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
