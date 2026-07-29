import { fmtD } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { C, chipSquare, MONO, plainCard } from '../../theme'

export function ArchiveTab() {
  const { state } = useData()
  const rows = state.doc.archive

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '0 18px 70px' }}>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((a) => (
            <div
              key={a.id}
              style={plainCard({ padding: '14px 17px', display: 'flex', gap: 12, alignItems: 'flex-start' })}
            >
              <span style={chipSquare(a.color)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                  {a.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                  {fmtD(a.startedAt)} → {fmtD(a.completedAt)}
                </div>
                <div style={{ fontSize: 14, color: C.textSoft, marginTop: 3 }}>
                  Итог: {a.summary}
                  {a.kindLabel ? ' · ' + a.kindLabel : ''}
                </div>
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 16,
                  fontWeight: 600,
                  color: C.ok,
                  textShadow: '0 0 12px rgba(52,211,153,.6)',
                  flex: 'none',
                }}
              >
                100%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', margin: '70px 0' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#e6efff' }}>Пока пусто</div>
          <div style={{ color: C.dim, marginTop: 5 }}>Доведи первую цель до 100% — и она появится здесь</div>
        </div>
      )}
    </main>
  )
}
