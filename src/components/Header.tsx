import type { CSSProperties } from 'react'
import { C } from '../theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { SyncBadge } from './SyncBadge'
import type { SyncState } from '../state/useCloudSync'

// На телефоне шапка ужимается: заголовок мельче и плотнее, подзаголовок уходит,
// а выгрузка и загрузка переезжают в меню «Ещё» — иначе она съедала треть экрана.
function headerStyle(mobile: boolean): CSSProperties {
  return {
    maxWidth: 1220,
    margin: '0 auto',
    padding: mobile ? '12px 14px 6px' : '20px 18px 8px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: mobile ? '8px 10px' : '10px 18px',
  }
}

const dotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: C.cyan,
  boxShadow: '0 0 12px #22d3ee',
  animation: 'blink 2.4s ease-in-out infinite',
}

function titleStyle(mobile: boolean): CSSProperties {
  return {
    fontSize: mobile ? 17 : 23,
    fontWeight: 700,
    letterSpacing: mobile ? '2px' : '5px',
    textTransform: 'uppercase',
    color: C.textHead,
    textShadow: '0 0 20px rgba(34,211,238,.5)',
    margin: 0,
    whiteSpace: 'nowrap',
  }
}

const subtitleStyle: CSSProperties = {
  fontSize: 12.5,
  letterSpacing: '1.5px',
  color: C.dim,
  margin: '3px 0 0 19px',
  textTransform: 'uppercase',
}

const ioBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.28)',
  borderRadius: 10,
  padding: '8px 14px',
  cursor: 'pointer',
  letterSpacing: '.4px',
  whiteSpace: 'nowrap',
}

interface Props {
  sync: SyncState
  onExport: () => void
  onImport: () => void
  onChangeCode: () => void
  onSettings: () => void
  onLogout: () => void
}

export function Header({ sync, onExport, onImport, onChangeCode, onSettings, onLogout }: Props) {
  const isMobile = useIsMobile()

  return (
    <header style={headerStyle(isMobile)}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
          <span style={dotStyle} />
          <h1 style={titleStyle(isMobile)}>Система жизни</h1>
        </div>
        {!isMobile && <div style={subtitleStyle}>командный центр баланса и целей</div>}
      </div>
      <div style={{ flex: 1 }} />

      {isMobile ? (
        <SyncBadge state={sync} compact />
      ) : (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <SyncBadge state={sync} />
          <button className="h-ghost" style={ioBtn} onClick={onExport}>
            Экспорт в JSON
          </button>
          <button className="h-ghost" style={ioBtn} onClick={onImport}>
            Импорт из JSON
          </button>
          <button className="h-ghost" style={{ ...ioBtn, color: C.muted }} onClick={onChangeCode}>
            Сменить код
          </button>
          <button className="h-ghost" style={{ ...ioBtn, color: C.muted }} onClick={onSettings}>
            Настройки
          </button>
          <button className="h-ghost" style={{ ...ioBtn, color: C.muted }} onClick={onLogout}>
            Выйти
          </button>
        </div>
      )}
    </header>
  )
}
