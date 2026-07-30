import type { CSSProperties, ReactNode } from 'react'
import { C } from '../theme'
import type { Tab } from '../types'

/** Вкладки, спрятанные под «Ещё» */
export const MORE_TABS: Tab[] = ['habits', 'fin', 'an', 'arch']

interface Props {
  tab: Tab
  onGo: (tab: Tab) => void
  moreOpen: boolean
  onToggleMore: () => void
}

/**
 * Нижняя панель телефона: главные разделы под большим пальцем, остальные — под
 * «Ещё». Учитывает домашнюю полосу, иначе последняя кнопка ложится под неё.
 */
export function BottomNav({ tab, onGo, moreOpen, onToggleMore }: Props) {
  const items: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'brief', label: 'Брифинг', icon: <IconBrief /> },
    { key: 'wheel', label: 'Колесо', icon: <IconWheel /> },
    { key: 'track', label: 'Трекер', icon: <IconClock /> },
    { key: 'lib', label: 'Книги', icon: <IconBook /> },
  ]

  return (
    <nav style={barStyle}>
      {items.map((it) => (
        <button key={it.key} onClick={() => onGo(it.key)} style={btnStyle(tab === it.key)}>
          {it.icon}
          <span style={labelStyle}>{it.label}</span>
        </button>
      ))}
      <button onClick={onToggleMore} style={btnStyle(MORE_TABS.includes(tab) || moreOpen)}>
        <IconMore />
        <span style={labelStyle}>Ещё</span>
      </button>
    </nav>
  )
}

const barStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 70,
  display: 'flex',
  alignItems: 'stretch',
  background: 'rgba(8,13,26,.94)',
  borderTop: '1px solid rgba(110,160,255,.16)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  paddingBottom: 'env(safe-area-inset-bottom)',
}

function btnStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 0 6px',
    minWidth: 0,
    color: active ? C.cyanBright : C.dim,
    ...(active ? { filter: 'drop-shadow(0 0 7px rgba(34,211,238,.55))' } : null),
  }
}

const labelStyle: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '.3px',
  whiteSpace: 'nowrap',
}

const SVG = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 }

function IconBrief() {
  return (
    <svg {...SVG}>
      <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
    </svg>
  )
}
function IconWheel() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.5v5M12 15.4v5M3.5 12h5M15.4 12h5" strokeLinecap="round" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconBook() {
  return (
    <svg {...SVG}>
      <path d="M5 4.5h9a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H5z" strokeLinejoin="round" />
      <path d="M19 6.5v13" strokeLinecap="round" />
    </svg>
  )
}
function IconMore() {
  return (
    <svg {...SVG}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
