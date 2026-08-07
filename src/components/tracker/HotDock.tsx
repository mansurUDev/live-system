import { DOCK } from '../../logic/actLayout'
import { fmtHm } from '../../logic/time'
import { C, NAV_H } from '../../theme'
import type { Activity } from '../../types'
import { ActTile } from './ActTile'

interface Props {
  hot: Activity[]
  runningId: string | null
  todayMs: Map<string, number>
  editing: boolean
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onLongPress: (act: Activity, x: number, y: number) => void
  onTogglePin: (id: string) => void
}

/**
 * Закреплённый док горячего ряда на телефоне — под большим пальцем, над BottomNav.
 * Высота строго совпадает с hotDockHeight() в logic/actLayout — та же распорка
 * рендерит просвет под доком в ленте суток.
 */
export function HotDock({ hot, runningId, todayMs, editing, onPress, onEdit, onLongPress, onTogglePin }: Props) {
  if (!hot.length) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
        zIndex: 60,
        paddingTop: DOCK.padTop,
        paddingBottom: DOCK.padBottom,
        paddingLeft: 10,
        paddingRight: 10,
        background: 'linear-gradient(180deg, rgba(7,11,20,0), rgba(7,11,20,.9) 30%, rgba(7,11,20,.97))',
        borderTop: '1px solid rgba(110,160,255,.10)',
      }}
    >
      <div
        style={{
          height: DOCK.caption,
          lineHeight: DOCK.caption + 'px',
          marginBottom: DOCK.captionGap,
          fontSize: 11,
          letterSpacing: '1.5px',
          color: C.dim,
          textTransform: 'uppercase',
          overflow: 'hidden',
        }}
      >
        ★ Горячий ряд — под большим пальцем
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: DOCK.chip, gap: DOCK.gap }}>
        {hot.map((act) => (
          <ActTile
            key={act.id}
            act={act}
            variant="dock"
            running={act.id === runningId}
            ms={fmtHm(todayMs.get(act.id) ?? 0)}
            editing={editing}
            onPress={onPress}
            onEdit={onEdit}
            onLongPress={onLongPress}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </div>
  )
}
