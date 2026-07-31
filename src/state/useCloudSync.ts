import { useCallback, useEffect, useRef, useState } from 'react'
import { pull, push } from './cloud'
import type { Action } from './reducer'
import type { Doc } from '../types'

/** Пауза перед отправкой: серия правок уезжает одним запросом */
const PUSH_DELAY_MS = 1500

export type SyncState = 'off' | 'idle' | 'saving' | 'error'

/**
 * Синхронизация с облаком.
 *
 * При входе документ забирается с сервера и заменяет локальный. Если в облаке
 * пусто — наоборот, туда сразу уезжает то, что есть на устройстве: иначе первый
 * вход со второго устройства показал бы чистый экран, потому что отправка
 * ждала бы правки, которой могло и не случиться.
 *
 * Если облако не настроено или недоступно, всё продолжает работать локально.
 */
export function useCloudSync(code: string, doc: Doc, dispatch: (a: Action) => void): SyncState {
  const [status, setStatus] = useState<SyncState>('off')
  const version = useRef(0)
  // Признак «облако отвечает» держим в ref, а не в состоянии: если завязать на
  // него эффект отправки, тот начнёт перезапускаться от собственных же
  // переключений статуса и будет слать запросы по кругу.
  const enabled = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // всегда актуальный документ — нужен внутри отложенных операций
  const latest = useRef(doc)
  latest.current = doc

  const sendNow = useCallback(
    async (payload: Doc) => {
      setStatus('saving')
      const res = await push(code, payload, version.current)

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
    },
    [code, dispatch],
  )

  useEffect(() => {
    let alive = true
    enabled.current = false
    version.current = 0

    pull(code).then((res) => {
      if (!alive) return

      if (!res.ok) {
        setStatus('off')
        return
      }

      version.current = res.version
      enabled.current = true
      setStatus('idle')

      if (res.doc) {
        dispatch({ type: 'replaceDoc', doc: res.doc, now: Date.now() })
      } else {
        // облако пустое — заселяем его тем, что накопилось на устройстве
        void sendNow(latest.current)
      }
    })

    return () => {
      alive = false
      enabled.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [code, dispatch, sendNow])

  // Отправка идёт только на изменение документа. Серия правок схлопывается в
  // один запрос, а без правок в облако не уходит ничего.
  useEffect(() => {
    if (!enabled.current) return
    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(() => void sendNow(doc), PUSH_DELAY_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [doc, sendNow])

  return status
}
