import { HOT_MAX } from '../../constants'
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
  /** id перетаскиваемой сейчас кнопки — она рендерится плейсхолдером */
  dragId?: string | null
  /** указатель сейчас над доком, а горячий ряд уже полон — красная рамка-отказ */
  hotRejected?: boolean
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onLongPress: (act: Activity, x: number, y: number) => void
  onTogglePin: (id: string) => void
}

/**
 * Закреплённый док горячего ряда на телефоне — под большим пальцем, над BottomNav.
 * Высота строго совпадает с hotDockHeight() в logic/actLayout — та же распорка
 * рендерит просвет под доком в ленте суток. В режиме настройки кнопок остаётся
 * на экране даже пустым — это цель для перетаскивания.
 */
export function HotDock({
  hot,
  runningId,
  todayMs,
  editing,
  dragId = null,
  hotRejected = false,
  onPress,
  onEdit,
  onLongPress,
  onTogglePin,
}: Props) {
  if (!hot.length && !editing) return null

  return (
    <div
      data-drop-zone="hot"
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
      {hot.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridAutoRows: DOCK.chip,
            gap: DOCK.gap,
            ...(hotRejected
              ? { outline: '1px dashed rgba(248,113,113,.55)', outlineOffset: 5, borderRadius: 11 }
              : null),
          }}
        >
          {hot.map((act) => (
            <ActTile
              key={act.id}
              act={act}
              variant="dock"
              running={act.id === runningId}
              ms={fmtHm(todayMs.get(act.id) ?? 0)}
              editing={editing}
              dragged={act.id === dragId}
              onPress={onPress}
              onEdit={onEdit}
              onLongPress={onLongPress}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            height: DOCK.chip,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px dashed ${hotRejected ? 'rgba(248,113,113,.55)' : 'rgba(148,163,184,.32)'}`,
            borderRadius: 11,
            fontSize: 12.5,
            color: C.faint,
          }}
        >
          Перетащи сюда — до {HOT_MAX} кнопок
        </div>
      )}
    </div>
  )
}
