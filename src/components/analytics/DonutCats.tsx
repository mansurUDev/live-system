import { ANALYTICS_CAT_KEYS, catMeta, type CatKey } from '../../logic/analytics'
import { donutSlice } from '../../logic/wheel'
import { fmtDur } from '../../logic/time'
import { C, chipDot, MONO, plainCard, sectionLabel } from '../../theme'

interface Props {
  totals: Record<CatKey, number>
  total: number
  untracked: number
}

const RADIUS = 58
const STROKE = 17

export function DonutCats({ totals, total, untracked }: Props) {
  let acc = -Math.PI / 2
  const segments = ANALYTICS_CAT_KEYS.filter((k) => totals[k] > 0).map((k) => {
    const fraction = totals[k] / total
    const a1 = acc
    const a2 = acc + fraction * Math.PI * 2
    acc = a2
    return { key: k, fraction, d: donutSlice(a1, a2, RADIUS), color: catMeta(k).color }
  })

  const legend = ANALYTICS_CAT_KEYS.filter((k) => totals[k] > 0).sort((a, b) => totals[b] - totals[a])

  return (
    <div style={plainCard({ padding: '16px 18px' })}>
      <div style={sectionLabel}>Куда ушло время</div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <div style={{ position: 'relative', width: 168, height: 168, flex: 'none' }}>
          <svg viewBox="-84 -84 168 168" style={{ width: '100%', height: '100%', display: 'block' }}>
            <circle cx={0} cy={0} r={RADIUS} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={STROKE} />
            {segments.map((s) =>
              // Единственная категория занимает весь круг — рисуем кольцо целиком,
              // у дуги в этом случае начало совпало бы с концом.
              s.fraction > 0.999 ? (
                <circle
                  key={s.key}
                  cx={0}
                  cy={0}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  style={{ filter: `drop-shadow(0 0 5px ${s.color}88)` }}
                />
              ) : (
                <path
                  key={s.key}
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  style={{ filter: `drop-shadow(0 0 5px ${s.color}88)` }}
                />
              ),
            )}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, color: C.textBright }}>
              {fmtDur(total)}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '2px', color: C.dim, textTransform: 'uppercase', marginTop: 2 }}>
              отслежено
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {legend.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={chipDot(catMeta(k).color)} />
              <span style={{ fontSize: 14, color: C.text, flex: 1 }}>{catMeta(k).label}</span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{fmtDur(totals[k])}</span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint, minWidth: 38, textAlign: 'right' }}>
                {Math.round((totals[k] / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: C.muted,
          marginTop: 12,
          borderTop: '1px dashed rgba(148,163,184,.2)',
          paddingTop: 9,
        }}
      >
        Не отслежено за период («дыры»): {fmtDur(untracked)}
      </div>
    </div>
  )
}
