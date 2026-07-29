/** Геометрия колеса — размеры и координаты один в один из дизайн-мока */
export const WHEEL = {
  vbW: 760,
  vbH: 640,
  cx: 380,
  cy: 320,
  R: 208,
  r0: 54,
  /** зазор между соседними секторами, радианы (с каждой стороны) */
  gap: 0.014,
  /** радиус, на котором стоят подписи снаружи круга */
  labelR: 232,
  /** сектора начинаются сверху */
  start: -Math.PI / 2,
} as const

const TWO_PI = Math.PI * 2

/** Углы i-го сектора из n */
export function sectorAngles(n: number, i: number): { a1: number; a2: number; mid: number } {
  const step = n > 0 ? TWO_PI / n : 0
  const a1 = WHEEL.start + i * step
  const a2 = a1 + step
  return { a1, a2, mid: (a1 + a2) / 2 }
}

/**
 * Клин сектора между радиусами r0 и R.
 *
 * Зазор ужимает клин с обеих сторон; при единственном секторе это же не даёт
 * дуге замкнуться ровно на 360°, где начало совпало бы с концом и путь
 * выродился бы в пустоту.
 */
export function wedgePath(a1: number, a2: number, r0 = WHEEL.r0, R = WHEEL.R): string {
  let s = a1 + WHEEL.gap
  let e = a2 - WHEEL.gap
  if (e <= s) e = s + 0.002
  if (e - s > TWO_PI - 0.001) e = s + TWO_PI - 0.001

  const p = (a: number, r: number) =>
    (WHEEL.cx + Math.cos(a) * r).toFixed(1) + ' ' + (WHEEL.cy + Math.sin(a) * r).toFixed(1)
  const large = e - s > Math.PI ? 1 : 0

  return (
    'M' + p(s, r0) +
    'L' + p(s, R) +
    'A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p(e, R) +
    'L' + p(e, r0) +
    'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + p(s, r0) +
    'Z'
  )
}

/**
 * Радиус дуги-заливки для процента выполнения. Никогда не NaN: значение уходит
 * в атрибут r, где нечисло сломало бы отрисовку всего колеса.
 */
export function fillRadius(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 0
  const clamped = Math.max(0, Math.min(100, p))
  return Number((WHEEL.r0 - 2 + (WHEEL.R - WHEEL.r0) * (clamped / 100)).toFixed(1))
}

/**
 * Поле отрисовки с запасом по бокам.
 *
 * Подписи стоят снаружи круга и на узком экране упирались в край: та, что слева,
 * просто обрезалась. Запас раздвигает систему координат, колесо от этого
 * рисуется мельче, зато названиям есть куда лечь.
 */
export function wheelViewBox(padX = 0): string {
  return `${-padX} 0 ${WHEEL.vbW + padX * 2} ${WHEEL.vbH}`
}

export interface LabelPosition {
  leftPct: string
  topPct: string
  translateX: string
  translateY: string
  textAlign: 'left' | 'right' | 'center'
}

/** Положение подписи сектора снаружи круга, в процентах от контейнера */
export function labelPosition(mid: number, padX = 0): LabelPosition {
  const c = Math.cos(mid)
  const s = Math.sin(mid)
  const totalW = WHEEL.vbW + padX * 2
  return {
    leftPct: (((WHEEL.cx + c * WHEEL.labelR + padX) / totalW) * 100).toFixed(2) + '%',
    topPct: (((WHEEL.cy + s * WHEEL.labelR) / WHEEL.vbH) * 100).toFixed(2) + '%',
    translateX: c > 0.18 ? '0%' : c < -0.18 ? '-100%' : '-50%',
    translateY: s < -0.35 ? '-100%' : s > 0.35 ? '0%' : '-50%',
    textAlign: c > 0.18 ? 'left' : c < -0.18 ? 'right' : 'center',
  }
}

/**
 * Дуга сегмента доната. Доля, занимающая почти весь круг, рисуется отдельным
 * замкнутым путём — обычная дуга при совпадении концов не отрисовалась бы.
 */
export function donutSlice(a1: number, a2: number, r: number): string {
  const p = (a: number) => (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1)
  if (a2 - a1 >= TWO_PI - 0.01) {
    return 'M0 ' + -r + 'A' + r + ' ' + r + ' 0 1 1 0 ' + r + 'A' + r + ' ' + r + ' 0 1 1 0 ' + -r
  }
  let s = a1
  let e = a2
  if (e - s > 0.06) {
    s += 0.02
    e -= 0.02
  }
  return 'M' + p(s) + 'A' + r + ' ' + r + ' 0 ' + (e - s > Math.PI ? 1 : 0) + ' 1 ' + p(e)
}
