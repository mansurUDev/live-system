import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { popoverPos } from '../logic/popover'
import { C } from '../theme'

export interface CtxItem {
  label: string
  /** символ слева — выравнивается в общую колонку */
  icon?: string
  /** красный пункт (удаление и прочее необратимое) */
  danger?: boolean
  /**
   * Текст второго шага: первый клик заменяет подпись на этот вопрос, второй —
   * выполняет. Подтверждение живёт внутри меню, чтобы не городить модалку.
   */
  confirm?: string
  onClick: () => void
}

/** Разделитель между группами пунктов */
export type CtxEntry = CtxItem | 'sep'

interface Props {
  x: number
  y: number
  items: CtxEntry[]
  onClose: () => void
}

/**
 * Само меню: панель в точке вызова, прижатая к краям экрана, поверх прозрачной
 * подложки. Первые 300 мс закрытие не срабатывает — после долгого нажатия
 * браузер досылает click в ту же точку, и без этой паузы меню закрывалось бы
 * само в момент открытия.
 */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const bornAt = useRef(0)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)

  if (bornAt.current === 0) bornAt.current = performance.now()
  const guarded = () => performance.now() - bornAt.current < 300

  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pos = popoverPos(x, y, r.width, r.height, window.innerWidth, window.innerHeight)
    el.style.left = pos.left + 'px'
    el.style.top = pos.top + 'px'
    el.style.visibility = 'visible'
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => {
      if (!guarded()) onClose()
    }
    window.addEventListener('keydown', onKey)
    // capture — прокрутка любого внутреннего контейнера тоже уводит меню
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return createPortal(
    <div
      // 84 — этаж BackdateMenu: над модалками (80), под тостами и призраком drag
      style={{ position: 'fixed', inset: 0, zIndex: 84 }}
      onClick={(e) => {
        e.stopPropagation()
        if (!guarded()) onClose()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // системный contextmenu после нашего long-press приходит с задержкой,
        // которая на Android настраивается и доходит до полутора секунд —
        // раньше этого срока он не закрытие меню, а эхо его открытия
        if (performance.now() - bornAt.current > 1600) onClose()
      }}
    >
      <div
        ref={panel}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: x,
          top: y,
          visibility: 'hidden',
          minWidth: 200,
          maxWidth: 280,
          padding: 6,
          borderRadius: 13,
          background: 'linear-gradient(165deg, rgba(24,34,60,.97), rgba(11,17,33,.98))',
          border: '1px solid rgba(110,160,255,.25)',
          boxShadow: '0 18px 50px rgba(0,0,0,.55), 0 0 24px rgba(34,211,238,.07)',
          animation: 'lpIn .15s ease',
        }}
      >
        {items.map((item, i) =>
          item === 'sep' ? (
            <div key={'sep' + i} style={{ height: 1, background: 'rgba(148,163,184,.18)', margin: '5px 8px' }} />
          ) : (
            <button
              key={item.label}
              className={item.danger || confirmIdx === i ? 'ctx-item ctx-item-danger' : 'ctx-item'}
              onClick={() => {
                if (item.confirm && confirmIdx !== i) {
                  setConfirmIdx(i)
                  return
                }
                onClose()
                item.onClick()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 11px',
                border: 'none',
                borderRadius: 9,
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 14,
                textAlign: 'left',
                color: item.danger || confirmIdx === i ? C.dangerText : C.text,
                fontWeight: confirmIdx === i ? 600 : 400,
              }}
            >
              <span style={{ width: 20, textAlign: 'center', flex: 'none', opacity: 0.85 }}>{item.icon ?? ''}</span>
              <span style={{ flex: 1 }}>{confirmIdx === i ? item.confirm : item.label}</span>
            </button>
          ),
        )}
      </div>
    </div>,
    document.body,
  )
}
