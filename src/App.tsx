import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { AuthProvider, useAuth } from './state/AuthProvider'
import { DataProvider, useData } from './state/DataProvider'
import { NowProvider } from './state/NowProvider'
import { ToastProvider } from './state/ToastProvider'
import { useIsMobile } from './hooks/useIsMobile'
import { NAV_H } from './theme'
import { useBackup } from './hooks/useBackup'
import { readTab, writeTab } from './state/storage'
import { BottomNav } from './components/BottomNav'
import { Header } from './components/Header'
import { LandingScreen } from './components/LandingScreen'
import { LoginScreen } from './components/LoginScreen'
import { MoreMenu } from './components/MoreMenu'
import { PullToRefresh } from './components/PullToRefresh'
import { InstallPrompt } from './components/InstallPrompt'
import { Tabs } from './components/Tabs'
import { Toasts } from './components/Toasts'
import { ChangeCodeModal } from './components/modals/ChangeCodeModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { BriefTab } from './components/brief/BriefTab'
import { WheelTab } from './components/wheel/WheelTab'
import { TrackerTab } from './components/tracker/TrackerTab'
import { HabitsTab } from './components/habits/HabitsTab'
import { FinanceTab } from './components/finance/FinanceTab'
import { BooksTab } from './components/books/BooksTab'
import { LibraryTab } from './components/library/LibraryTab'
import { WatchTab } from './components/watch/WatchTab'
import { IdeasTab } from './components/ideas/IdeasTab'
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
  const { state, sync } = useData()
  const { logout } = useAuth()
  const isMobile = useIsMobile()
  const backup = useBackup()
  const [moreOpen, setMoreOpen] = useState(false)
  const [changingCode, setChangingCode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Куда именно нажали в сводке: вкладка открывается целиком, и без подсветки
  // человек оказывается перед общим списком, не понимая, зачем его сюда привели.
  const [focus, setFocus] = useState<{ tab: Tab; id: string } | null>(null)

  const go = (t: Tab, focusId?: string) => {
    setTab(t)
    setMoreOpen(false)
    setFocus(focusId ? { tab: t, id: focusId } : null)
  }

  // Снимаем отметку, когда вспышка отыграла: иначе повторный переход к той же
  // записи ничего бы не показал — класс уже висит, анимация не перезапустится.
  useEffect(() => {
    if (!focus) return
    const t = setTimeout(() => setFocus(null), 2400)
    return () => clearTimeout(t)
  }, [focus])

  const focusFor = (t: Tab) => (focus && focus.tab === t ? focus.id : null)

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'clip' }}>
      <div style={gridLayer} />
      <div style={glowLayer} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header
          sync={sync}
          onSecret={() => go('watch')}
          onExport={backup.onExport}
          onImport={backup.onImport}
          onChangeCode={() => setChangingCode(true)}
          onSettings={() => setSettingsOpen(true)}
          onLogout={logout}
        />
        <Tabs tab={tab} onChange={go} archiveCount={state.doc.archive.length} hideWatch={state.doc.hideWatch} />

        {tab === 'brief' && <BriefTab onGo={go} />}
        {tab === 'wheel' && <WheelTab focus={focusFor('wheel')} />}
        {tab === 'track' && <TrackerTab />}
        {tab === 'habits' && <HabitsTab focus={focusFor('habits')} />}
        {tab === 'fin' && <FinanceTab focus={focusFor('fin')} />}
        {tab === 'books' && <BooksTab focus={focusFor('books')} />}
        {tab === 'lib' && <LibraryTab />}
        {tab === 'watch' && <WatchTab />}
        {tab === 'ideas' && <IdeasTab />}
        {tab === 'an' && <AnalyticsTab />}
        {tab === 'arch' && <ArchiveTab />}

        {/* место под нижнюю панель, чтобы она не накрывала последний блок */}
        {isMobile && <div style={{ height: `calc(${NAV_H + 12}px + env(safe-area-inset-bottom))` }} />}
      </div>

      {isMobile && (
        <BottomNav tab={tab} onGo={go} moreOpen={moreOpen} onToggleMore={() => setMoreOpen((v) => !v)} />
      )}
      {isMobile && moreOpen && (
        <MoreMenu
          tab={tab}
          archiveCount={state.doc.archive.length}
          hideWatch={state.doc.hideWatch}
          onGo={go}
          onClose={() => setMoreOpen(false)}
          onExport={() => {
            setMoreOpen(false)
            backup.onExport()
          }}
          onImport={() => {
            setMoreOpen(false)
            backup.onImport()
          }}
          onChangeCode={() => {
            setMoreOpen(false)
            setChangingCode(true)
          }}
          onSettings={() => {
            setMoreOpen(false)
            setSettingsOpen(true)
          }}
          onLogout={logout}
        />
      )}

      {changingCode && <ChangeCodeModal onClose={() => setChangingCode(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {backup.elements}
      <Toasts />
    </div>
  )
}

function Authed() {
  const { code } = useAuth()
  const [tab, setTab] = useState<Tab>(() => readTab())
  const [showLanding, setShowLanding] = useState(true)

  const changeTab = (t: Tab) => {
    writeTab(t)
    setTab(t)
  }

  useEffect(() => {
    if (!code) setShowLanding(true)
  }, [code])

  if (!code) {
    return showLanding ? <LandingScreen onEnter={() => setShowLanding(false)} /> : <LoginScreen />
  }

  return (
    // ключ по коду: смена пользователя поднимает данные заново, а не мешает их
    <DataProvider key={code}>
      <NowProvider trackerOpen={tab === 'track' || tab === 'brief'}>
        <Shell tab={tab} setTab={changeTab} />
      </NowProvider>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Authed />
        <PullToRefresh />
        <InstallPrompt />
      </AuthProvider>
    </ToastProvider>
  )
}
