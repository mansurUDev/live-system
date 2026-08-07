import { useMemo } from 'react'
import { HOT_MAX } from '../../constants'
import { splitActs } from '../../logic/actLayout'
import { fmtHm } from '../../logic/time'
import { btnGhostSm, C } from '../../theme'
import type { Zone } from '../../hooks/useTrackerZone'
import type { Activity } from '../../types'
import { ActTile } from './ActTile'
import { CatBands } from './CatBands'

interface Props {
  acts: Activity[]
  runningId: string | null
  zone: Zone
  todayMs: Map<string, number>
  editing: boolean
  onPress: (id: string) => void
  onEdit: (act: Activity) => void
  onToggleEditing: () => void
  onAdd: () => void
  onLongPress: (act: Activity, x: number, y: number) => void
  onTogglePin: (id: string) => void
}

/**
 * Раскладка активностей по docs/tracker-design.md: горячий ряд закреплённых
 * (≤HOT_MAX) сверху + полосы категорий ниже. На телефоне горячий ряд не
 * рендерится здесь — это HotDock (фиксированный внизу), см. TrackerTab.
 */
export function ActBoard({
  acts,
  runningId,
  zone,
  todayMs,
  editing,
  onPress,
  onEdit,
  onToggleEditing,
  onAdd,
  onLongPress,
  onTogglePin,
}: Props) {
  const { hot, bands } = useMemo(() => splitActs(acts), [acts])

  const controls = (
    <>
      <button className="h-ghost-bright" style={btnGhostSm} onClick={onAdd}>
        + Кнопка
      </button>
      <button className="h-ghost-bright" style={btnGhostSm} onClick={onToggleEditing}>
        {editing ? 'Готово' : 'Настроить кнопки'}
      </button>
    </>
  )

  const tileProps = (act: Activity) => ({
    act,
    running: act.id === runningId,
    ms: fmtHm(todayMs.get(act.id) ?? 0),
    editing,
    onPress,
    onEdit,
    onLongPress,
    onTogglePin,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: zone === 'wide' ? 20 : 16 }}>
      {zone !== 'phone' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>
              ★ Горячий ряд{zone === 'wide' ? ' · Жизненный цикл дня' : ''}
            </span>
            <div style={{ flex: 1 }} />
            {controls}
          </div>

          {hot.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${HOT_MAX}, 1fr)`,
                gap: zone === 'wide' ? 10 : 8,
              }}
            >
              {hot.map((act) => (
                <ActTile key={act.id} variant={zone === 'wide' ? 'hotWide' : 'hot'} {...tileProps(act)} />
              ))}
            </div>
          ) : (
            <div
              style={{
                border: '1px dashed rgba(148,163,184,.28)',
                borderRadius: 13,
                padding: '14px 16px',
                fontSize: 13,
                color: C.muted,
              }}
            >
              Закрепи до {HOT_MAX} кнопок — «Настроить кнопки», затем ★ на плитке
            </div>
          )}
        </div>
      )}

      <CatBands
        bands={bands}
        zone={zone}
        runningId={runningId}
        todayMs={todayMs}
        editing={editing}
        onPress={onPress}
        onEdit={onEdit}
        onLongPress={onLongPress}
        onTogglePin={onTogglePin}
      />

      {zone === 'phone' && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{controls}</div>}
    </div>
  )
}
