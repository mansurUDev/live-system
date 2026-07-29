import type { CSSProperties } from 'react'
import { tabBtn } from '../theme'
import type { Tab } from '../types'

const navStyle: CSSProperties = {
  maxWidth: 1220,
  margin: '8px auto 18px',
  padding: '0 18px',
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  borderBottom: '1px solid rgba(110,160,255,.12)',
}

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
  archiveCount: number
}

export function Tabs({ tab, onChange, archiveCount }: Props) {
  const items: { key: Tab; label: string }[] = [
    { key: 'wheel', label: 'Колесо' },
    { key: 'track', label: 'Трекер времени' },
    { key: 'an', label: 'Аналитика' },
    { key: 'arch', label: 'Архив' + (archiveCount ? ' · ' + archiveCount : '') },
  ]

  return (
    <nav style={navStyle}>
      {items.map((it) => (
        <button key={it.key} style={tabBtn(tab === it.key)} onClick={() => onChange(it.key)}>
          {it.label}
        </button>
      ))}
    </nav>
  )
}
