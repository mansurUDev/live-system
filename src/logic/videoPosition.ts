import { parseRichText } from './richText'

/**
 * Позиция в видео, закодированная прямо в ссылке.
 *
 * YouTube сам понимает `t=<секунды>` (начать с места) и `index=<номер>`
 * (какое видео плейлиста открыть), поэтому отдельного поля в модели не нужно:
 * позиция живёт в URL внутри заметки, и любая копия ссылки — из карточки, из
 * брифинга — сама открывается с нужного места.
 */
export interface VideoPosition {
  /** секунды от начала; null — не задано */
  seconds: number | null
  /** номер видео в плейлисте; null — не задано или ссылка без плейлиста */
  index: number | null
}

function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith('.' + base)
}

export function isYoutubeUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return hostMatches(host, 'youtube.com') || host === 'youtu.be'
  } catch {
    return false
  }
}

/** Есть ли в ссылке плейлист — без него номер видео бессмысленен */
export function hasPlaylist(raw: string): boolean {
  try {
    return new URL(raw).searchParams.has('list')
  } catch {
    return false
  }
}

/**
 * Разбор t в форматах YouTube: `2100`, `2100s`, `35m`, `1h5m30s`.
 * Мусор — null: лучше «не задано», чем случайный ноль.
 */
export function parseT(t: string): number | null {
  if (/^\d+s?$/.test(t)) return parseInt(t, 10)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  return (parseInt(m[1] ?? '0', 10) * 3600 + parseInt(m[2] ?? '0', 10) * 60 + parseInt(m[3] ?? '0', 10)) || null
}

export function getVideoPosition(raw: string): VideoPosition {
  try {
    const url = new URL(raw)
    const t = url.searchParams.get('t')
    const index = url.searchParams.get('index')
    const seconds = t ? parseT(t) : null
    const idx = index && /^\d+$/.test(index) ? parseInt(index, 10) : null
    return { seconds, index: idx && idx > 0 ? idx : null }
  } catch {
    return { seconds: null, index: null }
  }
}

/**
 * Перезаписать позицию в ссылке. null или ноль убирают параметр совсем —
 * ссылка без позиции выглядит как обычная, а не как «с нулевой секунды».
 */
export function setVideoPosition(raw: string, pos: Partial<VideoPosition>): string {
  try {
    const url = new URL(raw)
    if (pos.seconds !== undefined) {
      if (pos.seconds && pos.seconds > 0) url.searchParams.set('t', String(Math.round(pos.seconds)))
      else url.searchParams.delete('t')
    }
    if (pos.index !== undefined) {
      // номер видео имеет смысл только внутри плейлиста
      if (pos.index && pos.index > 0 && url.searchParams.has('list')) {
        url.searchParams.set('index', String(Math.round(pos.index)))
      } else url.searchParams.delete('index')
    }
    return url.toString()
  } catch {
    return raw
  }
}

/** Первая youtube-ссылка в заметке — к ней и привязывается позиция */
export function firstYoutubeLink(note: string): string | null {
  for (const part of parseRichText(note)) {
    if (part.kind === 'link' && isYoutubeUrl(part.url)) return part.url
  }
  return null
}

/**
 * Замена ссылки в заметке на неё же с новой позицией. Одинаковые адреса
 * меняются все разом — это одна и та же ссылка, у неё одна позиция.
 */
export function updateNoteLink(note: string, oldUrl: string, newUrl: string): string {
  return note.split(oldUrl).join(newUrl)
}

/** «35:20» для секунд — короткая подпись позиции на чипе */
export function fmtSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m + ':' + String(s).padStart(2, '0')
}
