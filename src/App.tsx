import { useState } from 'react'
import type { CSSProperties } from 'react'
import { DataProvider, useData } from './state/DataProvider'
import { NowProvider } from './state/NowProvider'
import { ToastProvider } from './state/ToastProvider'
import { Header } from './components/Header'
import { Tabs } from './components/Tabs'
import { Toasts } from './components/Toasts'
import { WheelTab } from './components/wheel/WheelTab'
import { TrackerTab } from './components/tracker/TrackerTab'
import { AnalyticsTab } from './components/analytics/AnalyticsTab'
import { ArchiveTab } from './components/archive/ArchiveTab'
import type { Tab } from './types'

const gridLayer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundImage:
    'linear-gradient(rgba(80,140,255,.05) 1px, transparent 1px),linear-gradient(90deg, rgba(80,140,255,.05) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
}

const glowLayer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(90% 55% at 50% -5%, rgba(34,211,238,.10), transparent 60%),radial-gradient(120% 90% at 50% 115%, rgba(96,70,190,.13), transparent 60%)',
}

function Shell({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { state } = useData()

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={gridLayer} />
      <div style={glowLayer} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Tabs tab={tab} onChange={setTab} archiveCount={state.doc.archive.length} />

        {tab === 'wheel' && <WheelTab />}
        {tab === 'track' && <TrackerTab />}
        {tab === 'an' && <AnalyticsTab />}
        {tab === 'arch' && <ArchiveTab />}
      </div>

      <Toasts />
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('wheel')

  return (
    <ToastProvider>
      <DataProvider>
        <NowProvider trackerOpen={tab === 'track'}>
          <Shell tab={tab} setTab={setTab} />
        </NowProvider>
      </DataProvider>
    </ToastProvider>
  )
}
