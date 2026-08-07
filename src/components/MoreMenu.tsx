import type { CSSProperties } from 'react'
import { C } from '../theme'
import { askInstallHelp } from './InstallPrompt'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  archiveCount: number
  onGo: (tab: Tab) => void
  onClose: () => void
  onExport: () => void
  onImport: () => void
  onChangeCode: () => void
  onSettings: () => void
  onLogout: () => void
}

/** Разделы, которым не хватило места в нижней панели, плюс служебные действия */
export function MoreMenu({
  tab,
  archiveCount,
  onGo,
  onClose,
  onExport,
  onImport,
  onChangeCode,
  onSettings,
  onLogout,
}: Props) {
  const rows: { key: Tab; label: string }[] = [
    { key: 'habits', label: 'Привычки' },
    { key: 'fin', label: 'Финансы' },
    { key: 'an', label: 'Аналитика' },
    { key: 'arch', label: 'Архив' + (archiveCount ? ' · ' + archiveCount : '') },
  ]

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <div style={sheetStyle}>
        {rows.map((r) => (
          <button key={r.key} onClick={() => onGo(r.key)} style={rowStyle(tab === r.key)}>
            {r.label}
          </button>
        ))}

        <div style={{ height: 1, background: 'rgba(148,163,184,.16)', margin: '6px 4px' }} />

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
        <button onClick={onLogout} style={{ ...dimRowStyle, color: C.danger }}>
          Выйти
        </button>
      </div>
    </>
  )
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 74,
  background: 'rgba(3,6,14,.5)',
}

const sheetStyle: CSSProperties = {
  position: 'fixed',
  left: 10,
  right: 10,
  bottom: 'calc(70px + env(safe-area-inset-bottom))',
  zIndex: 75,
  background: 'linear-gradient(165deg, rgba(24,34,60,.97), rgba(11,17,33,.98))',
  border: '1px solid rgba(110,160,255,.25)',
  borderRadius: 16,
  boxShadow: '0 -14px 50px rgba(0,0,0,.6), 0 0 26px rgba(34,211,238,.07)',
  padding: '10px 10px 8px',
  animation: 'sheetUp .22s ease',
}

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
