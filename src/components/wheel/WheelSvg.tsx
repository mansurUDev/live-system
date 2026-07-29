import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { avgPct, pct } from '../../logic/pct'
import { fillRadius, labelPosition, sectorAngles, wedgePath, wheelViewBox, WHEEL } from '../../logic/wheel'
import { C, MONO } from '../../theme'
import type { Sector } from '../../types'

interface Props {
  sectors: Sector[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** запас по бокам под подписи — нужен на узком экране */
  padX?: number
}

const wrapStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 700,
  // подписи масштабируются от ширины контейнера, а не окна
  containerType: 'inline-size',
}

const centerStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

/**
 * Подпись сектора. На узком экране доля от ширины даёт слишком мало места:
 * ширину подпираем снизу фиксированной, а разрядку убираем — иначе длинные
 * слова вроде «саморазвитие» рвутся посреди корня.
 */
function nameStyle(compact: boolean): CSSProperties {
  return {
    fontSize: 'clamp(10px,1.9cqw,14px)',
    fontWeight: 600,
    letterSpacing: compact ? '.4px' : '1.1px',
    textTransform: 'uppercase',
    lineHeight: 1.15,
    maxWidth: compact ? '96px' : 'max(88px, 20cqw)',
    overflowWrap: 'anywhere',
  }
}

/**
 * Колесо целиком на SVG.
 *
 * Заливка сектора — дуга, растущая от центра к краю: её радиус задаётся
 * процентом, а видимость ограничена клипом по клину сектора. Переход по radius
 * и даёт плавное «наполнение» при изменении прогресса.
 *
 * Компонент намеренно не подписан на текущее время: любой лишний ререндер
 * перезапускал бы эту анимацию.
 */
export function WheelSvg({ sectors, selectedId, onSelect, padX = 0 }: Props) {
  const items = useMemo(
    () =>
      sectors.map((s, i) => {
        const { a1, a2, mid } = sectorAngles(sectors.length, i)
        const p = pct(s)
        const selected = selectedId === s.id
        const dimmed = !!selectedId && !selected
        const arcR = fillRadius(p)
        return {
          sector: s,
          p,
          selected,
          dimmed,
          d: wedgePath(a1, a2),
          arcR,
          clipR: arcR ? arcR + 3 : 0,
          label: labelPosition(mid, padX),
        }
      }),
    [sectors, selectedId, padX],
  )

  const avg = avgPct(sectors)

  return (
    <div style={wrapStyle}>
      <svg viewBox={wheelViewBox(padX)} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          {items.map((it) => (
            <clipPath key={'p' + it.sector.id} id={'prog-' + it.sector.id}>
              <circle
                cx={WHEEL.cx}
                cy={WHEEL.cy}
                r={it.clipR}
                style={{ transition: 'r .7s cubic-bezier(.3,.85,.35,1)' }}
              />
            </clipPath>
          ))}
          {items.map((it) => (
            <clipPath key={'w' + it.sector.id} id={'wedge-' + it.sector.id}>
              <path d={it.d} />
            </clipPath>
          ))}
        </defs>

        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={211} fill="none" stroke="rgba(148,163,184,.2)" strokeWidth={1.2} />
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={215} fill="none" stroke="rgba(148,163,184,.08)" strokeWidth={1} />
        {[92, 131, 170].map((r) => (
          <circle
            key={r}
            cx={WHEEL.cx}
            cy={WHEEL.cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,.05)"
            strokeWidth={1}
            strokeDasharray="2 7"
          />
        ))}
        <circle cx={WHEEL.cx} cy={WHEEL.cy} r={50} fill="rgba(10,16,32,.55)" stroke="rgba(110,160,255,.25)" strokeWidth={1.2} />

        {items.map((it) => (
          <g key={it.sector.id} onClick={() => onSelect(it.sector.id)} style={{ cursor: 'pointer' }}>
            <path
              d={it.d}
              fill="rgba(148,163,184,.05)"
              stroke={it.selected ? it.sector.color : 'rgba(148,163,184,.16)'}
              strokeWidth={it.selected ? 1.6 : 1}
            />
            <g clipPath={`url(#prog-${it.sector.id})`}>
              <path d={it.d} fill={it.sector.color} fillOpacity={it.selected ? 0.4 : it.dimmed ? 0.12 : 0.25} />
            </g>
            <circle
              cx={WHEEL.cx}
              cy={WHEEL.cy}
              r={it.arcR}
              fill="none"
              stroke={it.sector.color}
              strokeWidth={2.5}
              clipPath={`url(#wedge-${it.sector.id})`}
              style={{
                transition: 'r .7s cubic-bezier(.3,.85,.35,1)',
                filter: `drop-shadow(0 0 6px ${it.sector.color})`,
                opacity: it.dimmed ? 0.35 : 0.95,
              }}
            />
          </g>
        ))}
      </svg>

      {items.map((it) => (
        <div
          key={it.sector.id}
          onClick={() => onSelect(it.sector.id)}
          style={{
            position: 'absolute',
            left: it.label.leftPct,
            top: it.label.topPct,
            transform: `translate(${it.label.translateX},${it.label.translateY})`,
            textAlign: it.label.textAlign,
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            color: it.selected ? '#eaf6ff' : it.dimmed ? 'rgba(203,213,225,.4)' : '#cbd5e1',
          }}
        >
          <div style={nameStyle(padX > 0)}>{it.sector.name}</div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 'clamp(10px,2.1cqw,16px)',
              fontWeight: 600,
              marginTop: 2,
              color: it.sector.color,
              textShadow: `0 0 10px ${it.sector.color}aa`,
              opacity: it.dimmed ? 0.5 : 1,
            }}
          >
            {it.p}%
          </div>
        </div>
      ))}

      <div style={centerStyle}>
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 'clamp(15px,4.6cqw,33px)',
            lineHeight: 1,
            color: C.cyanBright,
            textShadow: '0 0 18px rgba(34,211,238,.6)',
          }}
        >
          {avg === null ? '—' : avg + '%'}
        </div>
        <div style={{ fontSize: 'clamp(7px,1.35cqw,10px)', letterSpacing: '3px', color: C.dim, marginTop: 3 }}>
          БАЛАНС
        </div>
      </div>
    </div>
  )
}
