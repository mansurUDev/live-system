import { useEffect, useRef } from 'react'
import type { CSSProperties, TouchEvent as ReactTouchEvent } from 'react'
import { C } from '../theme'
import { MORE_TABS, TAB_LABELS } from './BottomNav'
import { askInstallHelp } from './InstallPrompt'
import { SyncBadge } from './SyncBadge'
import type { SyncState } from '../state/useCloudSync'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  archiveCount: number
  hideWatch: boolean
  sync: SyncState
  onGo: (tab: Tab) => void
  onClose: () => void
  /** потайной вход в «Смотреть», когда раздел спрятан из навигации */
  onSecret: () => void
  onExport: () => void
  onImport: () => void
  onChangeCode: () => void
  onSettings: () => void
  onLogout: () => void
}

/** Дальше этого сдвига влево панель считается закрытой жестом */
const CLOSE_DX = 50

/**
 * Боковая панель телефона: разделы, которым не хватило места в нижней панели,
 * и служебные действия. Выезжает слева — как в большинстве приложений, где
 * бургер открывает именно панель, а не лист снизу.
 */
export function Drawer({
  tab,
  archiveCount,
  hideWatch,
  sync,
  onGo,
  onClose,
  onSecret,
  onExport,
  onImport,
  onChangeCode,
  onSettings,
  onLogout,
}: Props) {
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // список берётся из панели — иначе вкладка однажды выпадет из обоих мест разом
  const rows: { key: Tab; label: string }[] = MORE_TABS.filter(
    (key) => key !== 'watch' || !hideWatch || tab === 'watch',
  ).map((key) => ({
    key,
    label: TAB_LABELS[key] + (key === 'arch' && archiveCount ? ' · ' + archiveCount : ''),
  }))

  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0]
    start.current = t ? { x: t.clientX, y: t.clientY } : null
  }

  const onTouchMove = (e: ReactTouchEvent) => {
    const s = start.current
    const t = e.touches[0]
    if (!s || !t) return
    const dx = t.clientX - s.x
    // закрываем только на честном горизонтальном движении: вертикальное — прокрутка списка
    if (dx < -CLOSE_DX && Math.abs(t.clientY - s.y) < Math.abs(dx)) {
      start.current = null
      onClose()
    }
  }

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <div
        style={panelStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => (start.current = null)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 8px 12px' }}>
          {/* точка — та же потайная дверь, что в шапке: раздел «Смотреть» спрятан */}
          <button
            onClick={onSecret}
            aria-label="Смотреть"
            style={{ background: 'none', border: 'none', padding: 6, margin: -6, cursor: 'default', lineHeight: 0 }}
          >
            <span style={dotStyle} />
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '1.4px', color: C.textHead, flex: 1 }}>
            СИСТЕМА ЖИЗНИ
          </div>
        </div>

        {rows.map((r) => (
          <button key={r.key} onClick={() => onGo(r.key)} style={rowStyle(tab === r.key)}>
            {r.label}
          </button>
        ))}

        <div style={sepStyle} />

        <button onClick={onExport} style={dimRowStyle}>
          Экспорт в JSON
        </button>
        <button onClick={onImport} style={dimRowStyle}>
          Импорт из JSON
        </button>
        <button onClick={onChangeCode} style={dimRowStyle}>
          Сменить код
        </button>
        <button onClick={onSettings} style={dimRowStyle}>
          Настройки
        </button>
        <button
          onClick={() => {
            onClose()
            askInstallHelp()
          }}
          style={dimRowStyle}
        >
          Установить приложение
        </button>

        {/* низ панели: состояние облака рядом с выходом — обе строки про доступ к данным */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <div style={sepStyle} />
          <div style={{ padding: '8px 10px 2px' }}>
            <SyncBadge state={sync} compact />
          </div>
          <button onClick={onLogout} style={{ ...dimRowStyle, color: C.danger }}>
            Выйти
          </button>
        </div>
      </div>
    </>
  )
}

const dotStyle: CSSProperties = {
  display: 'block',
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: C.cyan,
  boxShadow: '0 0 12px #22d3ee',
  animation: 'blink 2.4s ease-in-out infinite',
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 74,
  background: 'rgba(3,6,14,.55)',
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  bottom: 0,
  left: 0,
  width: 'min(82vw, 320px)',
  zIndex: 75,
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(165deg, rgba(24,34,60,.97), rgba(11,17,33,.98))',
  borderRight: '1px solid rgba(110,160,255,.25)',
  boxShadow: '14px 0 50px rgba(0,0,0,.6), 0 0 26px rgba(34,211,238,.07)',
  padding: '10px 10px 8px',
  paddingTop: 'calc(14px + env(safe-area-inset-top))',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
  overflowY: 'auto',
  animation: 'drawerIn .22s ease',
}

const sepStyle: CSSProperties = { height: 1, background: 'rgba(148,163,184,.16)', margin: '6px 4px' }

function rowStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: 15,
    color: active ? C.cyanBright : C.text,
    background: active ? 'rgba(34,211,238,.08)' : 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 10px',
    borderRadius: 10,
  }
}

const dimRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 14,
  color: C.muted,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '11px 10px',
  borderRadius: 10,
}
