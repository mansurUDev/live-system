// index — номер видео в плейлисте: без него ссылка «на седьмой урок» открывала бы первый
const YOUTUBE_PARAM_ALLOWLIST = new Set(['v', 't', 'list', 'index'])
const TRACKING_PARAM_DENYLIST = new Set(['fbclid', 'gclid', 'igsh', 'si', 'ref', 'ref_src'])

function hostMatches(host: string, base: string): boolean {
  return host === base || host.endsWith('.' + base)
}

function isInstagramHost(host: string): boolean {
  return hostMatches(host, 'instagram.com') || hostMatches(host, 'instagr.am')
}

function isYoutubeHost(host: string): boolean {
  return hostMatches(host, 'youtube.com') || host === 'youtu.be'
}

/**
 * Убирает из ссылки параметры, по которым можно вычислить, кто именно ей
 * поделился (Instagram и подобные сервисы вшивают такой идентификатор в
 * `igsh=`/`utm_source=` при копировании через «Поделиться»). Не-ссылка
 * возвращается как есть — сохранять же что-то надо.
 */
export function cleanShareUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  const host = parsed.hostname.toLowerCase()

  // Instagram кладёt идентификатор шэринга в любой параметр, что проще
  // выкинуть весь query целиком, чем гадать про очередное новое имя ключа
  if (isInstagramHost(host)) {
    return parsed.origin + parsed.pathname
  }

  if (isYoutubeHost(host)) {
    const kept = new URLSearchParams()
    for (const [key, value] of parsed.searchParams) {
      if (YOUTUBE_PARAM_ALLOWLIST.has(key)) kept.append(key, value)
    }
    const query = kept.toString()
    return parsed.origin + parsed.pathname + (query ? '?' + query : '')
  }

  const kept = new URLSearchParams()
  for (const [key, value] of parsed.searchParams) {
    const lower = key.toLowerCase()
    if (TRACKING_PARAM_DENYLIST.has(lower) || lower.startsWith('utm_')) continue
    kept.append(key, value)
  }
  const query = kept.toString()
  return parsed.origin + parsed.pathname + (query ? '?' + query : '') + parsed.hash
}

/**
 * Ссылка без схемы (`youtube.com/x` вместо `https://youtube.com/x`) сохраняется
 * в памяти и рендерится как обычная, но `safeUrl` при следующей загрузке её
 * молча срезает — лучше отбить в форме сразу, чем потерять после перезагрузки.
 */
export function isHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
