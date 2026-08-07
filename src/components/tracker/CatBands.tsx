import type { CSSProperties } from 'react'
import { CATS } from '../../constants'
import { fmtHm } from '../../logic/time'
import { C } from '../../theme'
import type { Zone } from '../../hooks/useTrackerZone'
import type { Band } from '../../logic/actLayout'
import type { Activity } from '../../types'
import { ActTile } from './ActTile'

interface Props {
  bands: Band[]
  zone: Zone
  runningId: string | null
  todayMs: Map<string, number>
  editing: boolean
  /** id перетаскиваемой сейчас кнопки — она рендерится плейсхолдером */
  dragId?: string | null
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onLongPress: (act: Activity, x: number, y: number) => void
  onTogglePin: (id: string) => void
}

function Header({ band, sticky }: { band: Band; sticky: boolean }) {
  const meta = CATS[band.cat]
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    ...(sticky
      ? {
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'rgba(7,11,20,.94)',
          padding: '8px 2px',
          margin: '0 -2px 4px',
        }
      : null),
  }
  return (
    <div style={style}>
      <span
        style={{ width: 10, height: 10, borderRadius: 3, background: meta.color, boxShadow: `0 0 8px ${meta.color}88`, flex: 'none' }}
      />
      <span style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 12, color: C.faint }}>{band.acts.length}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,.14)' }} />
    </div>
  )
}

export function CatBands({
  bands,
  zone,
  runningId,
  todayMs,
  editing,
  dragId = null,
  onPress,
  onEdit,
  onLongPress,
  onTogglePin,
}: Props) {
  if (!bands.length) return null

  const tileProps = (act: Activity) => ({
    act,
    running: act.id === runningId,
    ms: fmtHm(todayMs.get(act.id) ?? 0),
    editing,
    dragged: act.id === dragId,
    onPress,
    onEdit,
    onLongPress,
    onTogglePin,
  })

  if (zone === 'wide') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18, alignItems: 'start' }}>
        {bands.map((band) => (
          <div key={band.cat} data-drop-zone={'band:' + band.cat}>
            <Header band={band} sticky={false} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {band.acts.map((act) => (
                <ActTile key={act.id} variant="chip" {...tileProps(act)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (zone === 'laptop') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bands.map((band) => (
          <div key={band.cat} data-drop-zone={'band:' + band.cat}>
            <Header band={band} sticky={false} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {band.acts.map((act) => (
                <ActTile key={act.id} variant="chip" {...tileProps(act)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // phone: sticky-заголовки, 2 колонки
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bands.map((band) => (
        <div key={band.cat} data-drop-zone={'band:' + band.cat}>
          <Header band={band} sticky />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9 }}>
            {band.acts.map((act) => (
              <ActTile key={act.id} variant="chipPhone" {...tileProps(act)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
