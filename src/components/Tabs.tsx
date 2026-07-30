import type { CSSProperties } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { tabBtn } from '../theme'
import type { Tab } from '../types'

// На узком экране вкладки не переносятся во вторую строку, а уезжают в
// горизонтальную прокрутку — так шапка остаётся одной высоты.
function navStyle(mobile: boolean): CSSProperties {
  return {
    maxWidth: 1220,
    margin: mobile ? '4px auto 12px' : '8px auto 18px',
    padding: mobile ? '0 8px' : '0 18px',
    display: 'flex',
    gap: 4,
    flexWrap: mobile ? 'nowrap' : 'wrap',
    overflowX: mobile ? 'auto' : 'visible',
    scrollbarWidth: 'none',
    borderBottom: '1px solid rgba(110,160,255,.12)',
  }
}

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
  archiveCount: number
}

/** Полоса вкладок для большого экрана; на телефоне её заменяет нижняя панель */
export function Tabs({ tab, onChange, archiveCount }: Props) {
  const isMobile = useIsMobile()
  if (isMobile) return null

  const items: { key: Tab; label: string }[] = [
    { key: 'brief', label: 'Брифинг' },
    { key: 'wheel', label: 'Колесо' },
    { key: 'track', label: 'Трекер времени' },
    { key: 'habits', label: 'Привычки' },
    { key: 'fin', label: 'Финансы' },
    { key: 'lib', label: 'Библиотека' },
    { key: 'an', label: 'Аналитика' },
    { key: 'arch', label: 'Архив' + (archiveCount ? ' · ' + archiveCount : '') },
  ]

  return (
    <nav className="no-scrollbar" style={navStyle(false)}>
      {items.map((it) => (
        <button
          key={it.key}
          style={{ ...tabBtn(tab === it.key), padding: '10px 15px' }}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  )
}
