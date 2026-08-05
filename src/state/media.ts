/**
 * Клиент фото идей: сжатие в браузере + загрузка/удаление через /api/media.
 *
 * Сжатие решает две задачи разом: держит тело запроса под лимитом Vercel и,
 * как побочный эффект перерисовки через canvas, срезает EXIF/GPS-метаданные
 * оригинала — небольшой плюс к приватности без отдельного кода.
 */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export interface CompressedImage {
  blob: Blob
  ext: 'jpg'
}

type Source = (ImageBitmap | HTMLImageElement) & { width: number; height: number }

function targetSize(w: number, h: number, maxSide: number): { w: number; h: number } {
  if (w <= maxSide && h <= maxSide) return { w, h }
  const scale = maxSide / Math.max(w, h)
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}

/** Белая подложка — иначе прозрачность PNG стала бы чёрной при перегоне в JPEG */
function render(source: Source, maxSide: number, quality: number): Promise<Blob | null> {
  const { w, h } = targetSize(source.width, source.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  return toBlob(canvas, quality)
}

async function loadSource(file: File): Promise<{ source: Source; objectUrl: string } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, objectUrl: '' }
    } catch {
      // фолбэк на Image ниже
    }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('не удалось прочитать фото'))
      el.src = objectUrl
    })
    return { source: img, objectUrl }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}

/** Длинная сторона ≤ 1920px, JPEG q=0.82; если всё ещё крупное — 1600px/q=0.75; иначе отказ */
export async function compressImage(file: File): Promise<CompressedImage | null> {
  if (!file.type.startsWith('image/')) return null

  const loaded = await loadSource(file)
  if (!loaded) return null
  const { source, objectUrl } = loaded

  try {
    let blob = await render(source, 1920, 0.82)
    if (blob && blob.size > 2.5 * 1024 * 1024) {
      blob = await render(source, 1600, 0.75)
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) return null
    return { blob, ext: 'jpg' }
  } finally {
    if ('close' in source) source.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export type UploadResult =
  | { ok: true; url: string }
  /** нет SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY на сервере — не повод ломать сохранение идеи */
  | { ok: false; notConfigured: true }
  | { ok: false; notConfigured?: false; error: string }

function headers(code: string): HeadersInit {
  return { 'Content-Type': 'application/octet-stream', 'x-access-code': code }
}

export async function uploadImage(code: string, file: File): Promise<UploadResult> {
  const compressed = await compressImage(file)
  if (!compressed) return { ok: false, error: 'Не удалось подготовить фото' }

  try {
    const res = await fetch(`/api/media?ext=${compressed.ext}`, {
      method: 'POST',
      headers: headers(code),
      body: compressed.blob,
    })
    // в vite dev /api/media не существует — 404 отдаёт та же ветка, что и «не настроено» на проде
    if (res.status === 503 || res.status === 404) return { ok: false, notConfigured: true }
    if (!res.ok) return { ok: false, error: 'Не удалось сохранить фото' }

    const body = (await res.json()) as { url?: unknown }
    if (typeof body.url !== 'string' || !body.url) return { ok: false, error: 'Не удалось сохранить фото' }
    return { ok: true, url: body.url }
  } catch {
    return { ok: false, notConfigured: true }
  }
}

/** Осиротевшие файлы терпимы (единицы КБ на удаление), поэтому удаление — по-максимуму, без ретраев */
export async function deleteImage(code: string, url: string): Promise<void> {
  try {
    await fetch(`/api/media?url=${encodeURIComponent(url)}`, {
      method: 'DELETE',
      headers: { 'x-access-code': code },
    })
  } catch {
    // сеть недоступна — не блокируем действие пользователя ради уборки файла
  }
}
