import { BACKUP_KEY, CODE_KEY, LS_KEY, MAX_IMPORT_BYTES, TAB_KEY } from '../constants'
import { defaultDoc } from '../logic/defaults'
import { normalize } from '../logic/normalize'
import { localDateKey } from '../logic/time'
import type { Doc, Tab } from '../types'

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

/**
 * Данные каждого кода лежат отдельно — так на общем устройстве сессии не
 * смешиваются. LS_KEY остался от версии без входа: если под кодом ещё пусто, а
 * старые данные есть, они подхватываются при первом входе.
 */
export function docKey(code: string): string {
  return `${LS_KEY}:${code}`
}

export function versionKey(code: string): string {
  return `${LS_KEY}:${code}:cv`
}

function baseKey(code: string): string {
  return `${LS_KEY}:${code}:base`
}

/**
 * Версия облака, с которой локальные данные точно согласованы — либо оттуда
 * забрана, либо туда же успешно отправлена. Без этой памяти при каждой
 * перезагрузке пришлось бы слепо доверять тому, что вернуло облако, даже если
 * оно ещё не увидело самую свежую правку с этого устройства.
 */
export function loadCloudVersion(code: string): number {
  try {
    return Number(storage()?.getItem(versionKey(code))) || 0
  } catch {
    return 0
  }
}

export function saveCloudVersion(code: string, version: number): void {
  try {
    storage()?.setItem(versionKey(code), String(version))
  } catch {
    /* не критично — в худшем случае следующая загрузка спросит у облака заново */
  }
}

/**
 * База — тело документа, которое облако содержало на версии `:cv`.
 *
 * Зная её, расхождение с облаком можно объединить, а не решать выбором стороны:
 * что появилось после базы у нас — наша правка, что появилось у облака — чужая,
 * и обе должны уцелеть. Номер версии лежит внутри и сверяется с `:cv`: база,
 * отставшая от номера, опаснее отсутствующей — она выдала бы чужие правки за
 * наши и воскресила бы удалённое, поэтому такая база считается отсутствующей.
 * Версию передаёт вызывающий, а не берём из `:cv`: в памяти номер может быть уже
 * новее, чем на диске, и молчаливая сверка с диском вернула бы базу не от той
 * версии.
 */
export function loadBase(code: string, version: number, now: number = Date.now()): Doc | null {
  try {
    const raw = storage()?.getItem(baseKey(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: unknown; doc?: unknown }
    if (parsed?.v !== version || !parsed.doc) return null
    return normalize(parsed.doc, now)
  } catch {
    return null
  }
}

/**
 * Точка согласования: облако на версии `version` содержит ровно `doc`.
 *
 * Сначала база, потом номер — при обрыве между ними база окажется «впереди»
 * номера и будет отброшена при чтении. Обратный порядок оставил бы базу позади,
 * и она молча стала бы источником фантомных правок. Если места не хватило,
 * база удаляется совсем: синхронизация умеет работать без неё, а с устаревшей —
 * нет.
 */
export function saveSyncPoint(code: string, version: number, doc: Doc): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(baseKey(code), JSON.stringify({ v: version, doc }))
  } catch {
    try {
      s.removeItem(baseKey(code))
    } catch {
      /* хранилище недоступно целиком — дальше всё равно работаем локально */
    }
  }
  try {
    s.setItem(versionKey(code), String(version))
  } catch {
    /* см. saveCloudVersion */
  }
}

export function readCode(): string {
  try {
    return storage()?.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeCode(code: string): void {
  try {
    storage()?.setItem(CODE_KEY, code)
  } catch {
    /* без хранилища сессия проживёт до перезагрузки */
  }
}

export function clearCode(): void {
  try {
    storage()?.removeItem(CODE_KEY)
  } catch {
    /* нечего чистить */
  }
}

const TABS: Tab[] = ['brief', 'wheel', 'track', 'habits', 'fin', 'books', 'lib', 'watch', 'an', 'arch', 'ideas']

/** Последняя открытая вкладка — чтобы перезагрузка не выбрасывала в брифинг */
export function readTab(): Tab {
  try {
    const raw = storage()?.getItem(TAB_KEY)
    return TABS.includes(raw as Tab) ? (raw as Tab) : 'brief'
  } catch {
    return 'brief'
  }
}

export function writeTab(tab: Tab): void {
  try {
    storage()?.setItem(TAB_KEY, tab)
  } catch {
    /* без хранилища выбор проживёт до перезагрузки */
  }
}

/** Читает сохранённое состояние; любые повреждения чинит normalize */
export function loadDoc(code: string, now: number = Date.now()): Doc {
  const s = storage()
  try {
    const raw = s?.getItem(docKey(code))
    if (raw) return normalize(JSON.parse(raw), now)
  } catch {
    /* повреждённый JSON — пробуем то, что осталось от версии без входа */
  }
  try {
    const legacy = s?.getItem(LS_KEY)
    if (legacy) return normalize(JSON.parse(legacy), now)
  } catch {
    /* и его нет — начинаем с чистого листа */
  }
  return defaultDoc(now)
}

export type SaveResult = 'ok' | 'quota' | 'unavailable'

/**
 * Записывает документ и возвращает вместе с результатом сам JSON — по нему
 * вкладка потом узнаёт собственную запись в событии `storage` соседней вкладки
 * (см. DataProvider): без этого две открытые вкладки будили бы друг друга без
 * конца.
 */
export function saveDoc(code: string, doc: Doc): { result: SaveResult; json: string } {
  const json = JSON.stringify(doc)
  const s = storage()
  if (!s) return { result: 'unavailable', json }
  try {
    s.setItem(docKey(code), json)
    return { result: 'ok', json }
  } catch {
    return { result: 'quota', json }
  }
}

/** Убирает локальные данные кода — после переезда под новый */
export function dropDoc(code: string): void {
  try {
    storage()?.removeItem(docKey(code))
    storage()?.removeItem(versionKey(code))
    storage()?.removeItem(baseKey(code))
  } catch {
    /* нечего чистить */
  }
}

/** Копия текущих данных перед импортом — импорт иначе необратим */
export function backupCurrent(code: string): void {
  const s = storage()
  if (!s) return
  try {
    const raw = s.getItem(docKey(code)) ?? s.getItem(LS_KEY)
    if (raw) s.setItem(`${BACKUP_KEY}:${code}`, raw)
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
