import { useEffect, useRef, useState } from 'react'
import { pull, push } from './cloud'
import type { Action } from './reducer'
import type { Doc } from '../types'

/** Пауза перед отправкой: серия правок уезжает одним запросом */
const PUSH_DELAY_MS = 1500

export type SyncState = 'off' | 'idle' | 'saving' | 'error'

/**
 * Синхронизация с облаком.
 *
 * При входе документ забирается с сервера и, если он свежее локального,
 * заменяет его. Дальше каждое изменение уезжает обратно с небольшой задержкой.
 * Если облако не настроено или недоступно, всё продолжает работать локально —
 * приложение остаётся полностью рабочим без сети.
 */
export function useCloudSync(code: string, doc: Doc, dispatch: (a: Action) => void): SyncState {
  const [status, setStatus] = useState<SyncState>('off')
  const version = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // первый документ приходит из localStorage — его отправлять сразу не нужно
  const primed = useRef(false)

  useEffect(() => {
    let alive = true
    primed.current = false

    pull(code).then((res) => {
      if (!alive) return
      if (!res.ok) {
        setStatus('off')
        primed.current = true
        return
      }
      version.current = res.version
      setStatus('idle')
      if (res.doc) dispatch({ type: 'replaceDoc', doc: res.doc, now: Date.now() })
      primed.current = true
    })

    return () => {
      alive = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [code, dispatch])

  useEffect(() => {
    if (status === 'off' || !primed.current) return
    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(async () => {
      setStatus('saving')
      const res = await push(code, doc, version.current)

      if (res.ok) {
        version.current = res.version
        setStatus('idle')
        return
      }
      if (res.conflict) {
        // на другом устройстве сохранили свежее — забираем и не спорим
        const fresh = await pull(code)
        if (fresh.ok && fresh.doc) {
          version.current = fresh.version
          dispatch({ type: 'replaceDoc', doc: fresh.doc, now: Date.now() })
        }
        setStatus('idle')
        return
      }
      setStatus(res.error === 'offline' ? 'off' : 'error')
    }, PUSH_DELAY_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [doc, code, status, dispatch])

  return status
}
