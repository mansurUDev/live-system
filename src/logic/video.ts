const YOUTUBE_ID_RE = /^[\w-]{11}$/

/**
 * Извлекает id ролика из любой формы ссылки YouTube: короткой (youtu.be),
 * обычной (watch?v=), shorts или embed — с любыми доп. параметрами (таймкод,
 * плейлист, si= из share-меню). Не-YouTube и битые ссылки — null, это не
 * ошибка: такую ссылку всё равно можно сохранить, просто без превью.
 */
export function youtubeId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^(www|m)\./, '')

  if (host === 'youtu.be') {
    return matchId(parsed.pathname.slice(1))
  }
  if (host !== 'youtube.com') return null

  if (parsed.pathname === '/watch') {
    return matchId(parsed.searchParams.get('v') ?? '')
  }
  for (const prefix of ['/shorts/', '/embed/']) {
    if (parsed.pathname.startsWith(prefix)) {
      return matchId(parsed.pathname.slice(prefix.length))
    }
  }
  return null
}

function matchId(raw: string): string | null {
  const id = raw.split('/')[0] ?? ''
  return YOUTUBE_ID_RE.test(id) ? id : null
}

/** Картинка грузится браузером сама по этому адресу — отдельный запрос не нужен */
export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
