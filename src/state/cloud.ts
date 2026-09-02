import { normalize } from '../logic/normalize'
import type { Doc } from '../types'

/**
 * Клиент облачного хранилища.
 *
 * Работает поверх той же схемы, что и локальные данные, поэтому приезжающий
 * документ прогоняется через тот же normalize — чужой или устаревший ответ не
 * может сломать состояние.
 */

export interface CloudDoc {
  doc: Doc | null
  version: number
}

export type PullResult =
  | { ok: true; doc: Doc | null; version: number }
  /** облако не настроено — приложение просто продолжает работать локально */
  | { ok: false; offline: true; denied?: false }
  /** код не в списке разрешённых — облако есть, но не для этого кода */
  | { ok: false; offline: false; denied: true }
  | { ok: false; offline: false; denied?: false; error: string }

export type PushResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; version: number }
  | { ok: false; conflict: false; error: string }

function headers(code: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-access-code': code }
}

export async function pull(code: string, now: number = Date.now()): Promise<PullResult> {
  try {
    const res = await fetch('/api/doc', { headers: headers(code) })
    if (res.status === 503 || res.status === 404) return { ok: false, offline: true }
    // Облако работает, но этот код в списке разрешённых не значится — это
    // отдельный случай, и путать его с «облака нет» нельзя.
    if (res.status === 401) return { ok: false, offline: false, denied: true }
    if (!res.ok) return { ok: false, offline: false, error: 'Облако ответило ошибкой' }

    const body = (await res.json()) as { doc?: unknown; version?: number }
    return {
      ok: true,
      doc: body.doc ? normalize(body.doc, now) : null,
      version: Number(body.version) || 0,
    }
  } catch {
    return { ok: false, offline: true }
  }
}

/**
 * Убирает документ из облака.
 *
 * Нужно при смене кода: данные к этому моменту уже лежат под новым, и старая
 * запись — это оставшийся рабочий ключ к ним.
 */
export async function remove(code: string): Promise<boolean> {
  try {
    const res = await fetch('/api/doc', { method: 'DELETE', headers: headers(code) })
    return res.ok
  } catch {
    return false
  }
}

export async function push(code: string, doc: Doc, version: number): Promise<PushResult> {
  try {
    const res = await fetch('/api/doc', {
      method: 'PUT',
      headers: headers(code),
      body: JSON.stringify({ doc, version }),
    })
    if (res.status === 503 || res.status === 404) {
      return { ok: false, conflict: false, error: 'offline' }
    }
    if (res.status === 409) {
      const body = (await res.json()) as { version?: number }
      return { ok: false, conflict: true, version: Number(body.version) || 0 }
    }
    if (!res.ok) return { ok: false, conflict: false, error: 'Не удалось сохранить в облако' }

    const body = (await res.json()) as { version?: number }
    return { ok: true, version: Number(body.version) || 0 }
  } catch {
    return { ok: false, conflict: false, error: 'offline' }
  }
}

export interface VersionInfo {
  version: number
  savedAt: string
  bytes: number
}

/**
 * Список версий документа. Таблицы истории может не быть — пользователь
 * подключил облако раньше, чем она появилась; тогда приходит enabled:false,
 * и приложение показывает, что нужно сделать, а не пустой список.
 */
export async function fetchHistory(code: string): Promise<{ enabled: boolean; versions: VersionInfo[] } | null> {
  try {
    const res = await fetch('/api/doc?history=1', { headers: headers(code) })
    if (!res.ok) return null
    const body = (await res.json()) as { enabled?: boolean; versions?: VersionInfo[] }
    return { enabled: !!body.enabled, versions: Array.isArray(body.versions) ? body.versions : [] }
  } catch {
    return null
  }
}

/** Тело одной версии — уже нормализованное, как и всё, что приходит из облака */
export async function fetchVersion(code: string, version: number, now: number = Date.now()): Promise<Doc | null> {
  try {
    const res = await fetch(`/api/doc?version=${version}`, { headers: headers(code) })
    if (!res.ok) return null
    const body = (await res.json()) as { doc?: unknown }
    return body.doc ? normalize(body.doc, now) : null
  } catch {
    return null
  }
}
