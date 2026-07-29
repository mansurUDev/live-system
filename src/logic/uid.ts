/**
 * Идентификатор сущности. crypto.randomUUID есть не везде (insecure context,
 * старые Safari), поэтому предусмотрен запасной вариант.
 */
export function uid(prefix = ''): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (typeof g.crypto?.randomUUID === 'function') return prefix + g.crypto.randomUUID()
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
