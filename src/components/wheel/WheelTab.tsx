import { useEffect, useState } from 'react'
import { MAX_SECTORS } from '../../constants'
import { useData } from '../../state/DataProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { C, pageStyle } from '../../theme'
import { SectorModal } from '../modals/SectorModal'
import { CelebrationOverlay } from './CelebrationOverlay'
import { SectorPanel } from './SectorPanel'
import { WheelSvg } from './WheelSvg'

export function WheelTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const isMobile = useIsMobile()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const sectors = state.doc.sectors
  const selected = sectors.find((s) => s.id === selectedId) ?? null
  const celebrating = sectors.find((s) => s.id === state.celebratingId) ?? null

  // Сектор мог уехать в архив или быть удалён из другой вкладки.
  useEffect(() => {
    if (selectedId && !sectors.some((s) => s.id === selectedId)) setSelectedId(null)
  }, [sectors, selectedId])

  const openAdd = () => {
    if (sectors.length >= MAX_SECTORS) {
      toast(`На колесе уже ${MAX_SECTORS} — больше не поместится, сначала убери лишнее`)
      return
    }
    setAdding(true)
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', gap: 22, alignItems: 'flex-start' }}>
      <section style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button
            className="h-accent"
            style={{
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 600,
              color: C.onAccent,
              background: 'linear-gradient(180deg,#38e0f8,#0ea5c4)',
              border: '1px solid rgba(94,234,255,.7)',
              borderRadius: 10,
              padding: '8px 16px',
              cursor: 'pointer',
              letterSpacing: '.4px',
              boxShadow: '0 0 16px rgba(34,211,238,.35)',
            }}
            onClick={openAdd}
          >
            + Добавить на колесо
          </button>
        </div>

        {sectors.length > 0 ? (
          <>
            <WheelSvg
              sectors={sectors}
              selectedId={selectedId}
              onSelect={setSelectedId}
              padX={isMobile ? 140 : 0}
            />
            <div style={{ fontSize: 13, color: C.dim, letterSpacing: '.5px', marginTop: 4 }}>
              нажми на любую часть колеса, чтобы отметить прогресс
            </div>
          </>
        ) : (
          <div style={{ margin: '70px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '1px', color: '#e6efff' }}>Колесо пустое</div>
            <div style={{ color: C.dim, margin: '6px 0 0' }}>Добавь первую цель — или сферу жизни для оценки</div>
          </div>
        )}
      </section>

      {selected && (
        <SectorPanel sector={selected} isMobile={isMobile} onClose={() => setSelectedId(null)} />
      )}

      {adding && (
        <SectorModal
          usedColors={sectors.map((s) => s.color)}
          onCancel={() => setAdding(false)}
          onCreate={(sector) => {
            dispatch(A.addSector(sector))
            setAdding(false)
            setSelectedId(sector.id)
          }}
        />
      )}

      {celebrating && (
        <CelebrationOverlay
          sector={celebrating}
          onArchive={() => {
            dispatch(A.archiveSector(celebrating.id))
            toast('Записано в архив — место на колесе свободно')
          }}
          onKeep={() => dispatch(A.dismissCelebration())}
        />
      )}
    </main>
  )
}
