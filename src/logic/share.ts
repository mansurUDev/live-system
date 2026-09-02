import { classifyShare } from '../../api/shareLogic'
import type { ShareKind } from '../../api/shareLogic'

export type { ShareKind }

/** Что предложить по умолчанию — та же догадка, что и на сервере */
export function guessShareKind(url: string): ShareKind {
  return classifyShare(url).kind
}

/** Категория «Смотреть» по домену: аниме-сайт знает про запись больше, чем мы */
export function guessShowKind(url: string): string | undefined {
  return classifyShare(url, 'show').showKind
}

export interface SharePayload {
  url: string
  title: string
}

const SHARE_KEY = 'sz-share'

/**
 * Ссылка, пришедшая через «Поделиться».
 *
 * Android отдаёт её в адресной строке (share_target), но приложение может быть
 * ещё не открыто: пока человек вводит код, параметры должны где-то подождать —
 * поэтому они сразу переезжают в sessionStorage, а адрес чистится, иначе
 * перезагрузка страницы предложила бы сохранить ту же ссылку заново.
 */
export function takeShareFromUrl(loc: { search: string }): SharePayload | null {
  const q = new URLSearchParams(loc.search)
  const text = q.get('text') ?? ''
  const raw = (q.get('url') ?? q.get('share') ?? firstUrl(text)).trim()
  if (!raw || !/^https?:\/\//i.test(raw)) return null
  return { url: raw, title: (q.get('title') ?? '').trim() }
}

export function stashShare(p: SharePayload): void {
  try {
    sessionStorage.setItem(SHARE_KEY, JSON.stringify(p))
  } catch {
    /* приватный режим — тогда ссылка просто не переживёт вход */
  }
}

export function takeStashedShare(): SharePayload | null {
  try {
    const raw = sessionStorage.getItem(SHARE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(SHARE_KEY)
    const p = JSON.parse(raw) as SharePayload
    return p && typeof p.url === 'string' ? p : null
  } catch {
    return null
  }
}

/** Android часто кладёт ссылку не в url, а в text — вместе с описанием */
function firstUrl(text: string): string {
  const m = /https?:\/\/[^\s<>]+/.exec(text)
  return m ? m[0].replace(/[.,;:!?)\]»"'’]+$/, '') : ''
}
