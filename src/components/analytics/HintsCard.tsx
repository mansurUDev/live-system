import { fmtDur } from '../../logic/time'
import type { Hint } from '../../logic/hints'

export function HintsCard({ hints }: { hints: Hint[] }) {
  if (!hints.length) return null

  return (
    <div
      style={{
        background: 'linear-gradient(165deg, rgba(46,36,18,.6), rgba(20,16,8,.8))',
        border: '1px solid rgba(251,191,36,.35)',
        boxShadow: '0 0 18px rgba(251,191,36,.1)',
        borderRadius: 16,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '2.5px', color: '#d4a72c', textTransform: 'uppercase' }}>
        Подсказки
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {hints.map((h) => (
          <div key={h.sectorId} style={{ fontSize: 14, color: '#f3e3bb', lineHeight: 1.45 }}>
            ⚠ «{h.sectorName}» оценено на {h.value}/10, но на категорию «{h.catLabel}» за неделю —{' '}
            {h.ms > 0 ? fmtDur(h.ms) : '0 минут'}.
          </div>
        ))}
      </div>
    </div>
  )
}
