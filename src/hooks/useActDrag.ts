import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { moveActTo, type MoveTarget } from '../logic/actLayout'
import type { Activity, Category } from '../types'

const THRESHOLD_PX = 7
const HYSTERESIS_PX = 6
const AUTO_SCROLL_EDGE = 56
const AUTO_SCROLL_MAX_SPEED = 14
const FLIP_MS = 150

export interface ActDrag {
  id: string
  target: MoveTarget | null
  index: number
  /** указатель над горячим рядом, а тот уже полон восемью — визуальный отказ */
  rejected: boolean
  grabRect: { left: number; top: number; width: number; height: number }
}

interface Options {
  acts: Activity[]
  editing: boolean
  /** корень доски — на нём data-board, внутри все data-drop-zone/data-act-id (в т.ч. фикс-док) */
  scopeRef: RefObject<HTMLElement | null>
  /** корень призрака — transform во время драга пишем сюда императивно, не через setState */
  ghostRef: RefObject<HTMLElement | null>
  onDrop: (id: string, target: MoveTarget, index: number) => void
}

function parseZone(raw: string): MoveTarget {
  if (raw === 'hot') return { kind: 'hot' }
  return { kind: 'band', cat: raw.slice('band:'.length) as Category }
}

function sameTarget(a: MoveTarget | null, b: MoveTarget | null): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  return a.kind === 'band' && b.kind === 'band' ? a.cat === b.cat : true
}

/** Позиция среди СОСЕДЕЙ (без переносимой плитки) — reading order, без осцилляции при свапе */
function zoneIndex(zoneEl: Element, dragId: string, px: number, py: number): number {
  let idx = 0
  for (const el of zoneEl.querySelectorAll<HTMLElement>('[data-act-id]')) {
    if (el.dataset.actId === dragId) continue
    const r = el.getBoundingClientRect()
    if (py > r.bottom || (py >= r.top && px > r.left + r.width / 2)) idx++
  }
  return idx
}

/**
 * Перетаскивание кнопок трекера — Pointer Events, без библиотек. Работает
 * только при editing=true: вне режима настройки долгое нажатие 430мс
 * (useLongPress, enabled=!editing) остаётся единственным жестом на плитке,
 * пересечения с драгом нет по построению.
 *
 * Превью во время драга и итог на drop — один и тот же moveActTo, поэтому
 * они не могут разойтись. Ghost двигается императивно через ghostRef (не
 * setState на каждый pointermove — иначе 40 плиток тикали бы по кадрам),
 * соседей плавно раздвигает FLIP по обёрткам [data-act-id].
 */
export function useActDrag({ acts, editing, scopeRef, ghostRef, onDrop }: Options): {
  drag: ActDrag | null
  previewActs: Activity[]
} {
  const [drag, setDrag] = useState<ActDrag | null>(null)
  const dragRef = useRef<ActDrag | null>(null)
  dragRef.current = drag

  const actsRef = useRef(acts)
  actsRef.current = acts

  const editingRef = useRef(editing)
  editingRef.current = editing

  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const pendingRef = useRef<{ id: string; x0: number; y0: number; pointerId: number } | null>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const lastAcceptRef = useRef({ x: 0, y: 0 })
  const flipSnapshotRef = useRef<Map<string, DOMRect> | null>(null)
  const rafRef = useRef<number | null>(null)
  const clickTrapRef = useRef<((e: Event) => void) | null>(null)
  // «отменить текущий драг» — наполняется внутри главного эффекта, вызывается
  // из отдельных эффектов-стражей (editing выключили / кнопка исчезла)
  const endDragImplRef = useRef<(drop: boolean) => void>(() => {})

  const previewActs = useMemo(() => {
    if (!drag || !drag.target) return acts
    const res = moveActTo(acts, drag.id, drag.target, drag.index)
    return res.ok ? res.acts : acts
  }, [acts, drag])

  // FLIP: снимок «до» кладётся синхронно перед setDrag(...) (см. hitTest/endDrag ниже);
  // здесь, уже после перерисовки, меряем «после» и доигрываем разницу transform'ом.
  // Пишем на обёртку плитки (data-act-id), не на <button>: у кнопки inline transition
  // из actTileShell под управлением React, обнуление '' он не восстановит.
  // prefers-reduced-motion ничего чинить не надо — global.css глушит все transition сам.
  useLayoutEffect(() => {
    const snapshot = flipSnapshotRef.current
    const scope = scopeRef.current
    if (!snapshot || !scope) return
    flipSnapshotRef.current = null

    const skipId = dragRef.current?.id
    const moved: { el: HTMLElement; dx: number; dy: number }[] = []
    for (const el of scope.querySelectorAll<HTMLElement>('[data-act-id]')) {
      const id = el.dataset.actId
      if (!id || id === skipId) continue
      const prev = snapshot.get(id)
      if (!prev) continue
      const cur = el.getBoundingClientRect()
      const dx = prev.left - cur.left
      const dy = prev.top - cur.top
      if (dx || dy) moved.push({ el, dx, dy })
    }
    if (!moved.length) return

    for (const m of moved) {
      m.el.style.transition = 'none'
      m.el.style.transform = `translate(${m.dx}px, ${m.dy}px)`
    }
    void scope.offsetHeight // принудительный reflow — иначе браузер схлопнёт два style-изменения подряд
    for (const m of moved) {
      m.el.style.transition = `transform ${FLIP_MS}ms ease`
      m.el.style.transform = ''
      const clear = () => {
        m.el.style.transition = ''
        m.el.removeEventListener('transitionend', clear)
      }
      m.el.addEventListener('transitionend', clear)
      setTimeout(clear, FLIP_MS + 60)
    }
  }, [previewActs, scopeRef])

  // Единственный эффект на весь жизненный цикл хука — держит обработчики на window
  // (pointer capture — подстраховка, не единственный канал: реальные события идут отсюда).
  useEffect(() => {
    function captureFlip() {
      const scope = scopeRef.current
      if (!scope) return
      const map = new Map<string, DOMRect>()
      for (const el of scope.querySelectorAll<HTMLElement>('[data-act-id]')) {
        const id = el.dataset.actId
        if (id) map.set(id, el.getBoundingClientRect())
      }
      flipSnapshotRef.current = map
    }

    // нижняя граница автоскролла: верх фикс-дока на телефоне (сам док не запускает
    // скролл), иначе низ окна — на ноутбуке/wide 'hot' это часть потока, не fixed
    function bottomScrollLimit(): number {
      const zone = document.querySelector<HTMLElement>('[data-drop-zone="hot"]')
      if (zone && getComputedStyle(zone).position === 'fixed') return zone.getBoundingClientRect().top
      return window.innerHeight
    }

    function hitTest(x: number, y: number) {
      const d = dragRef.current
      if (!d) return
      const el = document.elementFromPoint(x, y)
      const zoneEl = el ? el.closest<HTMLElement>('[data-drop-zone]') : null

      let nextTarget: MoveTarget | null
      let nextIndex: number
      if (zoneEl) {
        nextTarget = parseZone(zoneEl.dataset.dropZone!)
        nextIndex = zoneIndex(zoneEl, d.id, x, y)
      } else {
        const onBoard = !!(el && el.closest('[data-board]'))
        // липкая цель: щели между полосами не должны сбрасывать превью и осциллировать
        if (onBoard) return
        nextTarget = null
        nextIndex = 0
      }

      const same = sameTarget(d.target, nextTarget)
      if (same && nextIndex === d.index) return
      if (same && Math.hypot(x - lastAcceptRef.current.x, y - lastAcceptRef.current.y) < HYSTERESIS_PX) return

      captureFlip()
      lastAcceptRef.current = { x, y }
      const res = nextTarget ? moveActTo(actsRef.current, d.id, nextTarget, nextIndex) : null
      const rejected = !!res && !res.ok && res.reason === 'hotFull'
      setDrag({ ...d, target: nextTarget, index: nextIndex, rejected })
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
        const { x, y } = lastPointerRef.current
        const limit = bottomScrollLimit()
        let dy = 0
        if (y < AUTO_SCROLL_EDGE) dy = -AUTO_SCROLL_MAX_SPEED * (1 - y / AUTO_SCROLL_EDGE)
        else if (y < limit && y > limit - AUTO_SCROLL_EDGE) {
          dy = AUTO_SCROLL_MAX_SPEED * ((y - (limit - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE)
        }
        if (dy) {
          window.scrollBy(0, dy)
          hitTest(x, y) // стоячий палец у края не шлёт pointermove — ретестим сами
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    function restoreBodyStyles() {
      document.body.style.userSelect = ''
      ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = ''
    }

    function trapNextClick() {
      const stop = (e: Event) => {
        e.stopPropagation()
        e.preventDefault()
      }
      clickTrapRef.current = stop
      window.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => {
        if (clickTrapRef.current === stop) {
          window.removeEventListener('click', stop, { capture: true })
          clickTrapRef.current = null
        }
      }, 0)
    }

    function endDrag(drop: boolean) {
      const d = dragRef.current
      stopAutoScroll()
      restoreBodyStyles()
      pendingRef.current = null
      if (d) {
        captureFlip() // «до»: плейсхолдер в финальной позиции превью — соседи доиграют FLIP
        if (drop && d.target) onDropRef.current(d.id, d.target, d.index)
      }
      setDrag(null)
    }
    endDragImplRef.current = endDrag

    function onPointerDown(e: PointerEvent) {
      if (!editingRef.current) return
      if (pendingRef.current || dragRef.current) return
      if (!e.isPrimary || e.button !== 0) return
      const target = e.target as Element | null
      if (target?.closest('[data-pin]')) return // ★ — не ручка перетаскивания
      const wrap = target?.closest<HTMLElement>('[data-act-id]')
      if (!wrap) return
      pendingRef.current = { id: wrap.dataset.actId!, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId }
      // без preventDefault — недодавленный клик остаётся кликом
    }

    function onPointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
      const pending = pendingRef.current
      if (!pending) return

      if (!dragRef.current) {
        const dx = e.clientX - pending.x0
        const dy = e.clientY - pending.y0
        if (Math.hypot(dx, dy) < THRESHOLD_PX) return

        const scope = scopeRef.current
        const el = scope?.querySelector<HTMLElement>(`[data-act-id="${CSS.escape(pending.id)}"]`)
        if (!el) {
          pendingRef.current = null
          return
        }
        try {
          el.setPointerCapture(pending.pointerId)
        } catch {
          /* мышь без capture тоже ок — события и так на window */
        }
        const r = el.getBoundingClientRect()
        document.body.style.userSelect = 'none'
        ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
        lastAcceptRef.current = { x: e.clientX, y: e.clientY }
        setDrag({
          id: pending.id,
          target: null,
          index: 0,
          rejected: false,
          grabRect: { left: r.left, top: r.top, width: r.width, height: r.height },
        })
        startAutoScroll()
      }

      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${e.clientX - pending.x0}px, ${e.clientY - pending.y0}px) scale(1.03)`
      }
      hitTest(e.clientX, e.clientY)
    }

    function onPointerUp() {
      if (!pendingRef.current) return
      if (dragRef.current) {
        trapNextClick()
        endDrag(true)
      } else {
        pendingRef.current = null // клик без порога — обычный клик отработает сам
      }
    }

    function onPointerCancel() {
      if (!pendingRef.current) return
      if (dragRef.current) endDrag(false)
      else pendingRef.current = null
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dragRef.current) endDrag(false)
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
      if (clickTrapRef.current) window.removeEventListener('click', clickTrapRef.current, { capture: true })
    }
  }, [scopeRef, ghostRef])

  // редактирование выключили среди драга (или кнопка исчезла — облачный pull) — отмена
  useEffect(() => {
    if (!editing) endDragImplRef.current(false)
  }, [editing])

  useEffect(() => {
    const d = dragRef.current
    if (d && !acts.some((a) => a.id === d.id)) endDragImplRef.current(false)
  }, [acts])

  return { drag, previewActs }
}
