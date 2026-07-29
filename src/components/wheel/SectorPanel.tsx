import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { CAT_KEYS, CATS } from '../../constants'
import { pct, typeLabel } from '../../logic/pct'
import { fmtD, num } from '../../logic/time'
import {
  btnCancelSm,
  btnDeleteConfirm,
  btnDeleteLink,
  C,
  card,
  chipBtn,
  chipSquare,
  iconBtn,
  MONO,
} from '../../theme'
import { useData } from '../../state/DataProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { StepsList } from './StepsList'
import type { Category, Sector } from '../../types'

const SLIDER_PAD = 14

interface Props {
  sector: Sector
  isMobile: boolean
  onClose: () => void
}

export function SectorPanel({ sector, isMobile, onClose }: Props) {
  const { dispatch } = useData()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dragging = useRef(false)
  const valueAtDragStart = useRef<number | null>(null)

  const p = pct(sector)
  const done = sector.kind === 'steps' ? sector.steps.filter((t) => t.done).length : 0

  const applySliderValue = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const width = Math.max(1, rect.width - 2 * SLIDER_PAD)
    const x = Math.max(0, Math.min(e.clientX - rect.left - SLIDER_PAD, width))
    const value = Math.round(1 + (9 * x) / width)
    if (value !== sector.value) dispatch(A.setSphere(sector.id, value))
  }

  const onSliderDown = (e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* захват указателя не поддержан — перетаскивание всё равно работает */
    }
    dragging.current = true
    valueAtDragStart.current = sector.value
    applySliderValue(e)
  }

  const onSliderMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) applySliderValue(e)
  }

  // В историю пишем один раз — по отпусканию, иначе каждое движение мыши
  // оставляло бы там запись.
  const onSliderUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (valueAtDragStart.current !== sector.value) dispatch(A.commitSphere(sector.id))
  }

  const addCustomAmount = () => {
    const parsed = parseFloat(amount.replace(',', '.').replace('−', '-'))
    if (!Number.isFinite(parsed) || parsed === 0) {
      toast('Введи число, например 30 или −10')
      return
    }
    dispatch(A.addAmount(sector.id, parsed))
    setAmount('')
  }

  const archive = () => {
    dispatch(A.archiveSector(sector.id))
    toast('Записано в архив — место на колесе свободно')
    onClose()
  }

  const remove = () => {
    dispatch(A.removeSector(sector.id))
    toast('Убрано с колеса')
    onClose()
  }

  const sliderFraction = sector.kind === 'sphere' ? (Math.max(1, Math.min(10, sector.value)) - 1) / 9 : 0

  const panelStyle: CSSProperties = isMobile
    ? card({
        position: 'fixed',
        left: 10,
        right: 10,
        // над домашней полосой телефона, если она есть
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        zIndex: 60,
        maxHeight: '64vh',
        overflow: 'auto',
        padding: '15px 17px',
        boxShadow: '0 -10px 40px rgba(0,0,0,.55)',
        animation: 'sheetUp .28s ease',
      })
    : card({
        flex: '0 0 375px',
        width: 375,
        position: 'sticky',
        top: 16,
        maxHeight: 'calc(100vh - 32px)',
        overflow: 'auto',
        padding: '15px 17px',
        boxShadow: '0 14px 40px rgba(0,0,0,.4)',
      })

  return (
    <aside style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={chipSquare(sector.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.textBright, overflowWrap: 'anywhere' }}>
            {sector.name}
          </div>
          <div style={{ fontSize: 12, letterSpacing: '1px', color: C.dim, textTransform: 'uppercase', marginTop: 2 }}>
            {typeLabel(sector.kind)}
          </div>
        </div>
        <button className="h-ghost-bright" style={iconBtn()} onClick={onClose} aria-label="Закрыть панель">
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '12px 0 6px' }}>
        <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 600, lineHeight: 1, color: C.textBright }}>
          {p}%
        </div>
        <div style={{ fontSize: 13.5, color: C.muted }}>
          {sector.kind === 'sphere'
            ? `оценка ${sector.value} из 10`
            : sector.kind === 'number'
              ? `${num(sector.current)} из ${num(sector.target)}${sector.unit ? ' ' + sector.unit : ''}`
              : `${done} из ${sector.steps.length} этапов`}
        </div>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: 'rgba(148,163,184,.12)',
          border: '1px solid rgba(148,163,184,.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: p + '%',
            transition: 'width .55s cubic-bezier(.3,.8,.35,1)',
            background: `linear-gradient(90deg,${sector.color}66,${sector.color})`,
            boxShadow: `0 0 12px ${sector.color}66`,
            borderRadius: 4,
          }}
        />
      </div>

      {sector.kind === 'sphere' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, color: C.textSoft }}>Насколько тебя устраивает эта сфера?</div>
          <div
            onPointerDown={onSliderDown}
            onPointerMove={onSliderMove}
            onPointerUp={onSliderUp}
            onPointerCancel={onSliderUp}
            style={{ position: 'relative', height: 32, touchAction: 'none', cursor: 'pointer', margin: '8px 2px 0' }}
          >
            <div
              style={{
                position: 'absolute',
                left: 14,
                right: 14,
                top: 14,
                height: 4,
                borderRadius: 2,
                background: 'rgba(148,163,184,.2)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 14.5,
                height: 3,
                width: `calc(${sliderFraction.toFixed(3)} * (100% - 28px))`,
                background: `linear-gradient(90deg,${sector.color}88,${sector.color})`,
                boxShadow: `0 0 8px ${sector.color}88`,
                borderRadius: 2,
                pointerEvents: 'none',
                transition: 'width .12s',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 6,
                left: `calc(14px + ${sliderFraction.toFixed(3)} * (100% - 28px))`,
                width: 20,
                height: 20,
                marginLeft: -10,
                borderRadius: '50%',
                background: '#0b1222',
                border: `2px solid ${sector.color}`,
                boxShadow: `0 0 12px ${sector.color}99`,
                pointerEvents: 'none',
                transition: 'left .12s',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 10px',
              fontFamily: MONO,
              fontSize: 11,
              color: C.faint,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 }}>
            <button className="h-ghost-bright" style={stepBtn} onClick={() => dispatch(A.stepSphere(sector.id, -1))}>
              −
            </button>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, minWidth: 86, textAlign: 'center', color: C.textBright }}>
              {sector.value} / 10
            </div>
            <button className="h-ghost-bright" style={stepBtn} onClick={() => dispatch(A.stepSphere(sector.id, 1))}>
              +
            </button>
          </div>
        </div>
      )}

      {sector.kind === 'number' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, color: C.textSoft }}>
            Сейчас: {num(sector.current)}
            {sector.unit ? ' ' + sector.unit : ''} · осталось {num(Math.max(0, sector.target - sector.current))}
            {sector.unit ? ' ' + sector.unit : ''}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="h-amount" style={amountBtn} onClick={() => dispatch(A.addAmount(sector.id, 10))}>
              +10
            </button>
            <button className="h-amount" style={amountBtn} onClick={() => dispatch(A.addAmount(sector.id, 50))}>
              +50
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomAmount()
              }}
              type="text"
              inputMode="decimal"
              placeholder="своё число, напр. 30 или −10"
              style={{
                fontFamily: 'inherit',
                fontSize: 14.5,
                color: '#e2e8f0',
                background: C.inputBg,
                border: '1px solid rgba(120,170,255,.25)',
                borderRadius: 9,
                padding: '8px 11px',
                outline: 'none',
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            />
            <button
              className="h-ghost-bright"
              style={{ ...btnCancelSm, fontSize: 14, borderRadius: 9, padding: '8px 13px' }}
              onClick={addCustomAmount}
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      {sector.kind === 'steps' && (
        <StepsList sector={sector} onToggle={(stepId) => dispatch(A.toggleStep(sector.id, stepId))} />
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '2px', color: C.dim, textTransform: 'uppercase' }}>
          Категория времени
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
          {catOptions.map((o) => (
            <button
              key={o.key ?? 'none'}
              style={chipBtn(sector.cat === o.key, o.key ? CATS[o.key].color : '#94a3b8')}
              onClick={() => dispatch(A.setSectorCat(sector.id, o.key))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {sector.kind !== 'sphere' && p >= 100 && (
        <button
          className="h-bright"
          style={{
            marginTop: 14,
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 14.5,
            fontWeight: 600,
            color: '#04121a',
            cursor: 'pointer',
            padding: '10px 14px',
            borderRadius: 10,
            border: `1px solid ${sector.color}aa`,
            background: `linear-gradient(180deg,${sector.color},${sector.color}bb)`,
            boxShadow: `0 0 16px ${sector.color}55`,
          }}
          onClick={archive}
        >
          Отправить в архив достижений
        </button>
      )}

      <div style={{ marginTop: 16, borderTop: '1px dashed rgba(148,163,184,.25)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: '2px', color: C.dim, textTransform: 'uppercase' }}>
          История изменений
        </div>
        {sector.history.length ? (
          <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sector.history.slice(0, 14).map((h, i) => (
              <div key={h.d + i} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'baseline' }}>
                <span style={{ fontFamily: MONO, color: C.faint, flex: 'none', minWidth: 86 }}>{fmtD(h.d)}</span>
                <span style={{ color: C.textSoft, overflowWrap: 'anywhere' }}>{h.label || h.p + '%'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.faint, marginTop: 5 }}>Записей пока нет</div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {confirmDelete ? (
          <>
            <span style={{ fontSize: 13, color: C.danger }}>Точно удалить?</span>
            <button style={btnDeleteConfirm} onClick={remove}>
              Да, удалить
            </button>
            <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
          </>
        ) : (
          <button style={{ ...btnDeleteLink, opacity: 0.85 }} onClick={() => setConfirmDelete(true)}>
            Убрать с колеса
          </button>
        )}
      </div>
    </aside>
  )
}

const catOptions: { key: Category | null; label: string }[] = [
  { key: null, label: 'нет' },
  ...CAT_KEYS.map((k) => ({ key: k, label: CATS[k].label.toLowerCase() })),
]

const stepBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 18,
  lineHeight: 1,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.3)',
  borderRadius: 9,
  width: 34,
  height: 34,
  cursor: 'pointer',
}

const amountBtn: CSSProperties = {
  fontFamily: MONO,
  fontSize: 14,
  fontWeight: 600,
  color: C.cyanPale,
  background: 'rgba(34,211,238,.1)',
  border: '1px solid rgba(94,234,255,.4)',
  borderRadius: 9,
  padding: '7px 16px',
  cursor: 'pointer',
}
