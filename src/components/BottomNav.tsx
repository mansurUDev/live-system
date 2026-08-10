import type { CSSProperties, ReactNode } from 'react'
import { C } from '../theme'
import type { Tab } from '../types'

/**
 * Вкладки, до которых дотягивается большой палец. Всё остальное — под бургером:
 * четыре кнопки остаются широкими, а редкие разделы всё равно открываются
 * в один лишний тап.
 */
const BAR_ITEMS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'brief', label: 'Брифинг', icon: <IconBrief /> },
  { key: 'track', label: 'Трекер', icon: <IconClock /> },
  { key: 'habits', label: 'Привычки', icon: <IconHabit /> },
  { key: 'fin', label: 'Финансы', icon: <IconMoney /> },
]

const BAR_TABS: Tab[] = BAR_ITEMS.map((i) => i.key)

/** Вкладки, спрятанные под бургером, — ровно те, что не влезли в панель */
export const MORE_TABS: Tab[] = ['wheel', 'lib', 'watch', 'ideas', 'an', 'arch']

/** Подписи для бургер-меню; в панели у кнопок свои, покороче */
export const TAB_LABELS: Record<Tab, string> = {
  brief: 'Брифинг',
  wheel: 'Колесо',
  track: 'Трекер времени',
  habits: 'Привычки',
  fin: 'Финансы',
  lib: 'Библиотека',
  watch: 'Смотреть',
  ideas: 'Идеи',
  an: 'Аналитика',
  arch: 'Архив',
}

interface Props {
  tab: Tab
  onGo: (tab: Tab) => void
  moreOpen: boolean
  onToggleMore: () => void
}

/**
 * Нижняя панель телефона: главные разделы под большим пальцем, остальные — под
 * бургером. Учитывает домашнюю полосу, иначе последняя кнопка ложится под неё.
 */
export function BottomNav({ tab, onGo, moreOpen, onToggleMore }: Props) {
  return (
    <nav style={barStyle}>
      {BAR_ITEMS.map((it) => (
        <button key={it.key} onClick={() => onGo(it.key)} style={btnStyle(tab === it.key)}>
          {it.icon}
          <span style={labelStyle}>{it.label}</span>
        </button>
      ))}
      <button
        onClick={onToggleMore}
        aria-label="Ещё разделы"
        aria-expanded={moreOpen}
        style={btnStyle(!BAR_TABS.includes(tab) || moreOpen)}
      >
        <IconBurger />
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
function IconClock() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconHabit() {
  return (
    <svg {...SVG}>
      <path d="M4.5 12.5l4 4 11-11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.5h8" strokeLinecap="round" />
    </svg>
  )
}
function IconMoney() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.3a2.8 2.8 0 0 0-2.5-1.3c-1.5 0-2.5.8-2.5 2s1 1.8 2.5 2 2.5.8 2.5 2-1 2-2.5 2a2.8 2.8 0 0 1-2.5-1.3M12 6.3v11.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconBurger() {
  return (
    <svg {...SVG}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}
