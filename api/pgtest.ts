import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Временная проверка: доезжает ли модуль pg до рантайма функций */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  const out: Record<string, unknown> = {
    node: process.version,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    envKeys: Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|SUPABASE/i.test(k)),
  }
  try {
    const mod = await import('pg')
    out.pg = 'ok'
    out.hasPool = typeof (mod as { default?: { Pool?: unknown } }).default?.Pool
    out.namedPool = typeof (mod as { Pool?: unknown }).Pool
  } catch (e) {
    out.pg = 'FAIL: ' + (e instanceof Error ? e.message : String(e))
  }
  res.status(200).json(out)
}
