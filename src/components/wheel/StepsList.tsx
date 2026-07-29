import type { Sector } from '../../types'

interface Props {
  sector: Sector
  onToggle: (stepId: string) => void
}

export function StepsList({ sector, onToggle }: Props) {
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {sector.steps.map((t) => (
        <div
          key={t.id}
          className="h-row"
          onClick={() => onToggle(t.id)}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
          }}
        >
          <span
            style={{
              width: 19,
              height: 19,
              borderRadius: 5,
              border: `1.5px solid ${t.done ? sector.color : 'rgba(148,163,184,.4)'}`,
              background: t.done ? sector.color : 'transparent',
              boxShadow: t.done ? `0 0 10px ${sector.color}77` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              marginTop: 1,
            }}
          >
            <span style={{ color: '#061018', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>
              {t.done ? '✓' : ''}
            </span>
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 14.5,
              lineHeight: 1.35,
              ...(t.done
                ? { textDecoration: 'line-through', color: 'rgba(148,163,184,.55)' }
                : { color: '#dbe4f5' }),
            }}
          >
            {t.text}
          </span>
        </div>
      ))}
    </div>
  )
}
