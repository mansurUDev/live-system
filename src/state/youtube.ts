import { youtubeId, youtubeThumbnail } from '../logic/video'

export interface YoutubeMeta {
  title: string
  channel: string
  thumbnail: string
}

/**
 * Название и канал ролика по ссылке — публичный oEmbed YouTube, ключ не
 * нужен, CORS открыт. Таймаут и любая ошибка (не YouTube, сеть недоступна)
 * дают `null` — это не повод отказывать в сохранении самой ссылки, только
 * в живом превью для неё.
 */
export async function fetchYoutubeMeta(url: string, timeoutMs = 1200): Promise<YoutubeMeta | null> {
  const id = youtubeId(url)
  if (!id) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: controller.signal,
    })
    if (!res.ok) return null

    const body = (await res.json()) as { title?: unknown; author_name?: unknown }
    return {
      title: typeof body.title === 'string' ? body.title : '',
      channel: typeof body.author_name === 'string' ? body.author_name : '',
      thumbnail: youtubeThumbnail(id),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
