import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const THRESHOLD_PX = 6
const AUTO_SCROLL_EDGE = 64
const AUTO_SCROLL_MAX_SPEED = 15

export interface ListDrag {
  id: string
  /** позиция среди остальных карточек — куда встанет при отпускании */
  index: number
  grabRect: { left: number; top: number; width: number; height: number }
}

interface Options {
  /** id видимых карточек в текущем порядке */
  ids: readonly string[]
  scopeRef: RefObject<HTMLElement | null>
  /** призрак под пальцем — двигаем императивно, без setState на каждый кадр */
  ghostRef: RefObject<HTMLElement | null>
  onDrop: (id: string, index: number) => void
}

/**
 * Перетаскивание карточек в вертикальном списке — Pointer Events, без библиотек.
 *
 * В отличие от кнопок трекера, тянуть можно только за ручку `[data-drag-handle]`:
 * карточка идеи набита своими кнопками — галочка, чек-лист, ссылки, — и жест с
 * любого места конфликтовал бы с ними. Ручка снимает конфликт по построению, а
 * заодно делает перетаскивание намеренным.
 *
 * Позиция считается по середине соседей: индекс — сколько карточек (кроме
 * перетаскиваемой) кончаются выше указателя.
 */
export function useListDrag({ ids, scopeRef, ghostRef, onDrop }: Options): ListDrag | null {
  const [drag, setDrag] = useState<ListDrag | null>(null)

  const dragRef = useRef<ListDrag | null>(null)
  dragRef.current = drag
  const idsRef = useRef(ids)
  idsRef.current = ids
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const pendingRef = useRef<{ id: string; x0: number; y0: number; pointerId: number } | null>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const endRef = useRef<(drop: boolean) => void>(() => {})

  useEffect(() => {
    function indexAt(y: number): number {
      const scope = scopeRef.current
      const d = dragRef.current
      if (!scope || !d) return 0
      let idx = 0
      for (const el of scope.querySelectorAll<HTMLElement>('[data-drag-id]')) {
        if (el.dataset.dragId === d.id) continue
        const r = el.getBoundingClientRect()
        if (y > r.top + r.height / 2) idx++
      }
      return idx
    }

    function stopAutoScroll() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    function startAutoScroll() {
      if (rafRef.current !== null) return
      const tick = () => {
        if (!dragRef.current) {
          rafRef.current = null
          return
        }
        const { y } = lastPointerRef.current
        let dy = 0
        if (y < AUTO_SCROLL_EDGE) dy = -AUTO_SCROLL_MAX_SPEED * (1 - y / AUTO_SCROLL_EDGE)
        else if (y > window.innerHeight - AUTO_SCROLL_EDGE) {
          dy = AUTO_SCROLL_MAX_SPEED * ((y - (window.innerHeight - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE)
        }
        if (dy) {
          window.scrollBy(0, dy)
          const d = dragRef.current
          const next = indexAt(y)
          if (d && next !== d.index) setDrag({ ...d, index: next })
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    function restoreBody() {
      document.body.style.userSelect = ''
      ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
    }

    function end(drop: boolean) {
      const d = dragRef.current
      stopAutoScroll()
      restoreBody()
      pendingRef.current = null
      if (d && drop) onDropRef.current(d.id, d.index)
      setDrag(null)
    }
    endRef.current = end

    function onPointerDown(e: PointerEvent) {
      if (pendingRef.current || dragRef.current) return
      if (!e.isPrimary || e.button !== 0) return
      const target = e.target as Element | null
      // тянем только за ручку — остальная карточка живёт своей жизнью
      if (!target?.closest('[data-drag-handle]')) return
      const wrap = target.closest<HTMLElement>('[data-drag-id]')
      if (!wrap) return
      pendingRef.current = { id: wrap.dataset.dragId!, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId }
      // палец на ручке не должен прокручивать страницу
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
      const pending = pendingRef.current
      if (!pending) return

      if (!dragRef.current) {
        if (Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0) < THRESHOLD_PX) return
        const scope = scopeRef.current
        const el = scope?.querySelector<HTMLElement>(`[data-drag-id="${CSS.escape(pending.id)}"]`)
        if (!el) {
          pendingRef.current = null
          return
        }
        try {
          el.setPointerCapture(pending.pointerId)
        } catch {
          /* мышь без capture тоже работает — события слушаем на window */
        }
        const r = el.getBoundingClientRect()
        document.body.style.userSelect = 'none'
        ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
        const started: ListDrag = {
          id: pending.id,
          index: idsRef.current.indexOf(pending.id),
          grabRect: { left: r.left, top: r.top, width: r.width, height: r.height },
        }
        dragRef.current = started
        setDrag(started)
        startAutoScroll()
      }

      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${e.clientX - pending.x0}px, ${e.clientY - pending.y0}px)`
      }
      const d = dragRef.current
      const next = indexAt(e.clientY)
      if (d && next !== d.index) setDrag({ ...d, index: next })
    }

    function onPointerUp() {
      if (!pendingRef.current) return
      if (dragRef.current) end(true)
      else pendingRef.current = null
    }

    function onPointerCancel() {
      if (!pendingRef.current) return
      if (dragRef.current) end(false)
      else pendingRef.current = null
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dragRef.current) end(false)
    }

    const scope = scopeRef.current
    scope?.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      scope?.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
      stopAutoScroll()
    }
  }, [scopeRef, ghostRef])

  // карточка исчезла среди перетаскивания (удалили, приехал документ из облака)
  useEffect(() => {
    const d = dragRef.current
    if (d && !ids.includes(d.id)) endRef.current(false)
  }, [ids])

  return drag
}
