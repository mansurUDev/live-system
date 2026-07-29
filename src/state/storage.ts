import { BACKUP_KEY, LS_KEY, MAX_IMPORT_BYTES } from '../constants'
import { defaultDoc } from '../logic/defaults'
import { normalize } from '../logic/normalize'
import { localDateKey } from '../logic/time'
import type { Doc } from '../types'

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage
    if (!s) return null
    // В приватном режиме хранилище есть, но запись бросает исключение.
    const probe = '__sz_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function storageAvailable(): boolean {
  return storage() !== null
}

/** Читает сохранённое состояние; любые повреждения чинит normalize */
export function loadDoc(now: number = Date.now()): Doc {
  try {
    const raw = storage()?.getItem(LS_KEY)
    if (raw) return normalize(JSON.parse(raw), now)
  } catch {
    /* повреждённый JSON — начинаем с дефолта */
  }
  return defaultDoc(now)
}

export type SaveResult = 'ok' | 'quota' | 'unavailable'

export function saveDoc(doc: Doc): SaveResult {
  const s = storage()
  if (!s) return 'unavailable'
  try {
    s.setItem(LS_KEY, JSON.stringify(doc))
    return 'ok'
  } catch {
    return 'quota'
  }
}

/** Копия текущих данных перед импортом — импорт иначе необратим */
export function backupCurrent(): void {
  const s = storage()
  if (!s) return
  try {
    const raw = s.getItem(LS_KEY)
    if (raw) s.setItem(BACKUP_KEY, raw)
  } catch {
    /* нет места под копию — не повод срывать импорт */
  }
}

export function exportFile(doc: Doc, now: number = Date.now()): boolean {
  try {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sistema-zhizni-' + localDateKey(now) + '.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  } catch {
    return false
  }
}

export type ImportResult =
  | { ok: true; doc: Doc }
  | { ok: false; error: string }

/** Читает файл экспорта: проверяет размер, разбирает JSON, санитайзит через normalize */
export async function parseImportFile(file: File, now: number = Date.now()): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'Файл слишком большой — нужен JSON из экспорта' }
  }
  try {
    const text = await file.text()
    const raw: unknown = JSON.parse(text)
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { sectors?: unknown }).sectors)) {
      return { ok: false, error: 'Не удалось прочитать файл — нужен JSON из экспорта' }
    }
    return { ok: true, doc: normalize(raw, now) }
  } catch {
    return { ok: false, error: 'Не удалось прочитать файл — нужен JSON из экспорта' }
  }
}
