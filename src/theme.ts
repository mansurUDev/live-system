import type { CSSProperties } from 'react'

/** Токены дизайн-мока «Система жизни» */
export const C = {
  bg: '#070b14',
  text: '#dbe4f5',
  textBright: '#eaf3ff',
  textHead: '#e9f7ff',
  textSoft: '#aab8d0',
  muted: '#8fa0bd',
  dim: '#68779a',
  faint: '#5b6a86',
  cyan: '#22d3ee',
  cyanBright: '#8ff4ff',
  cyanPale: '#dff9ff',
  danger: '#f87171',
  dangerPale: '#fecaca',
  dangerText: '#fca5a5',
  ok: '#34d399',
  inputBg: '#0b1222',
  onAccent: '#031018',
} as const

export const MONO = "'JetBrains Mono', monospace"

const CARD_BG = 'linear-gradient(165deg, rgba(22,32,58,.72), rgba(10,16,32,.88))'
const CARD_BORDER = '1px solid rgba(110,160,255,.14)'

/** Стеклянная карточка — базовый контейнер интерфейса */
export function card(extra?: CSSProperties): CSSProperties {
  return {
    background: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxSizing: 'border-box',
    ...extra,
  }
}

/** Карточка без блюра — для плотных блоков аналитики (как в моке) */
export function plainCard(extra?: CSSProperties): CSSProperties {
  return {
    background: CARD_BG,
    border: CARD_BORDER,
    borderRadius: 16,
    boxSizing: 'border-box',
    ...extra,
  }
}

/** Чип-переключатель: категории, типы, выбор активности */
export function chipBtn(selected: boolean, color: string): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 13,
    color: selected ? '#eaf6ff' : C.textSoft,
    padding: '6px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    border: `1px solid ${selected ? color : 'rgba(148,163,184,.25)'}`,
    background: selected ? `${color}22` : 'rgba(148,163,184,.06)',
    ...(selected ? { boxShadow: `0 0 10px ${color}44` } : null),
  }
}

/** Цветной квадратик-маркер рядом с названием */
export function chipDot(color: string): CSSProperties {
  return {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: 3,
    background: color,
    boxShadow: `0 0 8px ${color}88`,
    flex: 'none',
  }
}

/** Крупный квадратик-маркер (панель сектора, архив) */
export function chipSquare(color: string): CSSProperties {
  return {
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: 4,
    background: color,
    boxShadow: `0 0 10px ${color}88`,
    flex: 'none',
    marginTop: 4,
  }
}

/** Кнопка-таб верхней навигации */
export function tabBtn(active: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 14.5,
    letterSpacing: '.8px',
    padding: '10px 18px',
    cursor: 'pointer',
    background: active
      ? 'linear-gradient(180deg, rgba(34,211,238,.1), transparent)'
      : 'transparent',
    border: 'none',
    borderBottom: `2px solid ${active ? C.cyan : 'transparent'}`,
    color: active ? C.cyanBright : C.muted,
    fontWeight: active ? 600 : 400,
    ...(active ? { textShadow: '0 0 12px rgba(34,211,238,.6)' } : null),
  }
}

/** Переключатель периода в аналитике */
export function periodBtn(active: boolean): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 13.5,
    letterSpacing: '.6px',
    padding: '7px 18px',
    cursor: 'pointer',
    borderRadius: 9,
    border: `1px solid ${active ? 'rgba(94,234,255,.55)' : 'rgba(148,163,184,.22)'}`,
    background: active ? 'rgba(34,211,238,.12)' : 'rgba(148,163,184,.06)',
    color: active ? C.cyanBright : C.muted,
    ...(active ? { boxShadow: '0 0 12px rgba(34,211,238,.25)' } : null),
  }
}

/** Квадрат выбора цвета в формах */
export function swatch(selected: boolean, color: string): CSSProperties {
  return {
    width: 30,
    height: 30,
    padding: 0,
    cursor: 'pointer',
    borderRadius: 9,
    border: `2px solid ${selected ? '#eaf6ff' : 'transparent'}`,
    background: color,
    boxShadow: `0 0 ${selected ? '14px' : '6px'} ${color}88`,
  }
}

/** Акцентная кнопка действия */
export const btnAccent: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 600,
  color: C.onAccent,
  background: 'linear-gradient(180deg,#38e0f8,#0ea5c4)',
  border: '1px solid rgba(94,234,255,.7)',
  borderRadius: 10,
  padding: '8px 17px',
  cursor: 'pointer',
  boxShadow: '0 0 16px rgba(34,211,238,.35)',
}

/** Нейтральная кнопка (Отмена, Экспорт, служебные действия) */
export const btnGhost: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 14,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.3)',
  borderRadius: 10,
  padding: '8px 15px',
  cursor: 'pointer',
}

/** Мелкая нейтральная кнопка */
export const btnGhostSm: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.28)',
  borderRadius: 9,
  padding: '6px 12px',
  cursor: 'pointer',
}

/** Квадратная кнопка-иконка (закрыть, стрелки дней) */
export function iconBtn(size = 28): CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1,
    color: C.muted,
    background: 'rgba(148,163,184,.07)',
    border: '1px solid rgba(148,163,184,.3)',
    borderRadius: 8,
    width: size,
    height: size,
    cursor: 'pointer',
    flex: 'none',
  }
}

/** Поле ввода */
export const input: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 15,
  color: '#e2e8f0',
  background: C.inputBg,
  border: '1px solid rgba(120,170,255,.25)',
  borderRadius: 10,
  padding: '9px 11px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
}

/** Подпись поля формы */
export const fieldLabel: CSSProperties = { fontSize: 13, color: C.muted }

/** Заголовок секции — разреженный капс */
export const sectionLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '2.5px',
  color: C.dim,
  textTransform: 'uppercase',
}

/** Текст ошибки в форме */
export const errText: CSSProperties = {
  color: C.dangerText,
  fontSize: 13.5,
  marginTop: 10,
}

/** Основной контейнер страницы; на телефоне поля уже — контенту нужна ширина */
export function pageStyle(mobile = false): CSSProperties {
  return {
    maxWidth: 1220,
    margin: '0 auto',
    padding: mobile ? '0 10px 60px' : '0 18px 70px',
  }
}

export const page = pageStyle(false)

/** Оверлей модального окна */
export const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  background: 'rgba(3,6,14,.72)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
}

/** Карточка модального окна */
export function modalCard(width: number): CSSProperties {
  return {
    background: 'linear-gradient(165deg, rgba(24,34,60,.95), rgba(11,17,33,.98))',
    border: '1px solid rgba(110,160,255,.25)',
    borderRadius: 16,
    boxShadow: '0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(34,211,238,.08)',
    padding: '18px 20px',
    width: `min(${width}px, 100%)`,
    maxHeight: '88vh',
    overflow: 'auto',
    boxSizing: 'border-box',
    animation: 'popIn .22s ease',
  }
}

/** Кнопка «Удалить …» — текстовая, пунктирное подчёркивание */
/** Круглая кнопка ✎ — вызов формы правки на карточке */
export const btnEdit: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  color: C.muted,
  background: 'none',
  border: '1px solid rgba(148,163,184,.3)',
  borderRadius: 9,
  padding: '7px 10px',
  cursor: 'pointer',
}

export const btnDeleteLink: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  color: C.danger,
  textDecoration: 'underline dotted',
}

/** Кнопка подтверждения удаления */
export const btnDeleteConfirm: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  color: C.dangerPale,
  background: 'rgba(248,113,113,.12)',
  border: '1px solid rgba(248,113,113,.5)',
  borderRadius: 8,
  padding: '5px 12px',
  cursor: 'pointer',
}

/** Мелкая кнопка отмены рядом с подтверждением удаления */
export const btnCancelSm: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.3)',
  borderRadius: 8,
  padding: '5px 12px',
  cursor: 'pointer',
}

/** Высота нижней навигации (без safe-area) — точка отсчёта для дока трекера */
export const NAV_H = 52

/** Фон/рамка/свечение плитки активности — общие для всех размеров трекера */
export function actTileShell(color: string, running: boolean): CSSProperties {
  return {
    background: 'linear-gradient(165deg, rgba(22,32,58,.7), rgba(10,16,32,.85))',
    border: `1px solid ${color}${running ? 'cc' : '44'}`,
    boxShadow: running ? `0 0 18px ${color}55, inset 0 0 24px ${color}18` : `inset 0 0 16px ${color}0e`,
    transition: 'border-color .2s, box-shadow .2s, transform .15s',
    '--tile-hov-border': `${color}cc`,
    '--tile-hov-shadow': `0 0 16px ${color}44, inset 0 0 20px ${color}16`,
  } as CSSProperties
}
