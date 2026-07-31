import { useCallback } from 'react'
import { pull, push, remove } from '../state/cloud'
import { useAuth } from '../state/AuthProvider'
import { useData } from '../state/DataProvider'
import { dropDoc, saveDoc } from '../state/storage'

export type ChangeResult =
  | { ok: true; cloud: boolean }
  | { ok: false; error: string }

/**
 * Смена кода доступа с сохранением данных.
 *
 * Порядок важен: сначала копия под новым кодом, потом переключение сессии и
 * только затем удаление старой записи. Если что-то оборвётся посередине,
 * данные останутся хотя бы в одном месте, а не пропадут между двумя.
 */
export function useChangeCode(): (nextCode: string) => Promise<ChangeResult> {
  const { code, login } = useAuth()
  const { state } = useData()

  return useCallback(
    async (raw: string): Promise<ChangeResult> => {
      const next = raw.trim().slice(0, 40)
      if (!next) return { ok: false, error: 'Введи новый код' }
      if (next === code) return { ok: false, error: 'Это тот же код' }

      const doc = state.doc

      // Не затираем чужое: под новым кодом уже могут быть данные другого человека.
      const existing = await pull(next)
      if (existing.ok && existing.doc) {
        return { ok: false, error: 'Под этим кодом уже есть данные — придумай другой' }
      }

      let cloud = false
      if (existing.ok) {
        const sent = await push(next, doc, 0)
        if (!sent.ok) return { ok: false, error: 'Облако не приняло данные — код не сменён' }
        cloud = true
      }

      // Локальная копия — чтобы после переключения экран не оказался пустым,
      // даже если облако недоступно.
      saveDoc(next, doc)
      login(next)

      if (cloud) await remove(code)
      dropDoc(code)

      return { ok: true, cloud }
    },
    [code, login, state.doc],
  )
}
