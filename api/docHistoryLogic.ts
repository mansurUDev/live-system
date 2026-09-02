/**
 * Правила хранения истории версий документа.
 *
 * Файл самодостаточен и без импортов: серверные функции Vercel собираются
 * отдельно от приложения. Здесь только чистые решения — что перезаписать, а
 * что удалить, — чтобы их можно было проверить тестами без Postgres.
 */

/** Правки летят в облако каждые полторы секунды: без склейки история сгорит за минуты */
export const COALESCE_MS = 5 * 60 * 1000

/** Сколько последних версий хранить всегда */
export const KEEP_RECENT = 30

/** За сколько дней держать по одному снимку в день */
export const KEEP_DAYS = 30

export interface VersionRow {
  id: number
  version: number
  savedAt: string
}

/**
 * Продолжать ли писать в последнюю строку вместо новой.
 *
 * Пока человек правит один экран, версии идут пачками по несколько секунд —
 * каждая такая пачка это одно изменение с точки зрения человека, и в истории
 * ей место одной записью.
 */
export function shouldCoalesce(lastSavedAt: string | null, now: number): boolean {
  if (!lastSavedAt) return false
  const t = Date.parse(lastSavedAt)
  return Number.isFinite(t) && now - t < COALESCE_MS
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Что удалить из истории: id строк, которые больше не нужны.
 *
 * Оставляем последние KEEP_RECENT версий — чтобы отменить недавнюю ошибку, —
 * и по одному снимку на каждый из последних KEEP_DAYS дней: «верни, как было
 * в прошлый вторник» без этого невозможно, а тридцати последних версий на
 * такой срок никогда не хватит.
 */
export function planRetention(rows: VersionRow[], now: number): number[] {
  const sorted = [...rows].sort((a, b) => b.version - a.version)
  const keep = new Set<number>()

  for (const r of sorted.slice(0, KEEP_RECENT)) keep.add(r.id)

  const oldestDay = new Date(now - KEEP_DAYS * 86400000).toISOString().slice(0, 10)
  const seenDay = new Set<string>()
  for (const r of sorted) {
    const day = dayKey(r.savedAt)
    if (day < oldestDay) continue
    // строки идут от свежих к старым, поэтому первая в дне — последняя за день
    if (!seenDay.has(day)) {
      seenDay.add(day)
      keep.add(r.id)
    }
  }

  return sorted.filter((r) => !keep.has(r.id)).map((r) => r.id)
}
