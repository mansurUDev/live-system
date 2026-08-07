import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Activity } from '../../types'
import { ActTile, type TileVariant } from './ActTile'

interface Props {
  act: Activity
  variant: TileVariant
  running: boolean
  ms: string
  grabRect: { left: number; top: number; width: number; height: number }
  ghostRef: RefObject<HTMLDivElement | null>
}

const noop = () => {}

/**
 * Призрак перетаскиваемой плитки — точная копия, летит за пальцем/курсором.
 * Transform пишет useActDrag императивно через ghostRef на каждый pointermove
 * (не через React state — иначе 40 плиток тикали бы по кадрам).
 *
 * Портал в body — тот же приём, что в Lightbox: иначе стекуется внутри
 * z-index-контекста Shell и уходит под BottomNav/HotDock.
 */
export function DragGhost({ act, variant, running, ms, grabRect, ghostRef }: Props) {
  return createPortal(
    <div
      ref={ghostRef}
      style={{
        position: 'fixed',
        left: grabRect.left,
        top: grabRect.top,
        width: grabRect.width,
        height: grabRect.height,
        zIndex: 96, // над доком (60) и навигацией (70), под тостами (97) — тост о drop виден поверх
        pointerEvents: 'none', // критично: elementFromPoint должен видеть сквозь призрак
        willChange: 'transform',
        filter: 'drop-shadow(0 14px 34px rgba(0,0,0,.5))',
      }}
    >
      <ActTile
        act={act}
        variant={variant}
        running={running}
        ms={ms}
        editing={false}
        onPress={noop}
        onEdit={noop}
        onLongPress={noop}
        onTogglePin={noop}
      />
    </div>,
    document.body,
  )
}
