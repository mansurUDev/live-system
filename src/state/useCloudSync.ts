import { useCallback, useEffect, useRef, useState } from 'react'
import { pull, push } from './cloud'
import { loadCloudVersion, saveCloudVersion } from './storage'
import { reconcile, resolvePushConflict, shouldPullOnResume } from './syncReconcile'
import type { Action } from './reducer'
import type { Doc } from '../types'

/** Пауза перед отправкой: серия правок уезжает одним запросом */
const PUSH_DELAY_MS = 1500

export type SyncState = 'off' | 'denied' | 'idle' | 'saving' | 'error'

/** Лучшее из возможного при закрытии вкладки — обычный fetch тело > ~64КБ не потянет */
function keepaliveFlush(code: string, doc: Doc, version: number): void {
  try {
    fetch('/api/doc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-access-code': code },
      body: JSON.stringify({ doc, version }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* тело не собралось — не страшнее, чем если бы страница просто закрылась раньше */
  }
}

/**
 * Синхронизация с облаком.
 *
 * При входе документ забирается с сервера и заменяет локальный. Если в облаке
 * пусто — наоборот, туда сразу уезжает то, что есть на устройстве: иначе первый
 * вход со второго устройства показал бы чистый экран, потому что отправка
 * ждала бы правки, которой могло и не случиться.
 *
 * Если облако не настроено или недоступно, всё продолжает работать локально.
 *
 * `dirty` — ref от вызывающего кода: есть ли правки человека, которых ещё нет в
 * облаке (см. AUTO_ACTIONS в reducer.ts). Нужен, чтобы pull, летящий в фоне при
 * каждой загрузке, не затирал правку, случившуюся уже после того момента, на
 * который отвечает облако. Флаг снимается после удачной отправки: с этого
 * момента спорить не о чем, и в конфликте устройство уступает облаку — иначе
 * вкладка, провисевшая ночь в спящем ноутбуке, стирала бы чужой день.
 */
export function useCloudSync(
  code: string,
  doc: Doc,
  dispatch: (a: Action) => void,
  dirty: { current: boolean },
): SyncState {
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
  // пока запрос летит, новый sendNow не стартует параллельно — просто
  // помечает, что по завершении нужно отправить ещё раз («хвостовая» отправка)
  const sending = useRef(false)
  const resendPending = useRef(false)

  const attemptSend = useCallback(
    async (initialPayload: Doc) => {
      setStatus('saving')
      let payload = initialPayload

      // максимум одна повторная попытка после конфликта: пуш → конфликт →
      // забрать чужое → либо принять его, либо дослать своё, если оно есть
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await push(code, payload, version.current)
        if (res.ok) {
          version.current = res.version
          saveCloudVersion(code, res.version)
          // всё, что человек успел поправить, теперь в облаке — устройство
          // больше не «активнее» остальных и в следующем споре уступит. Если за
          // время запроса появилась ещё правка, документ уже другой и флаг стоит
          if (latest.current === payload) dirty.current = false
          setStatus('idle')
          return
        }
        if (!res.conflict) {
          setStatus(res.error === 'offline' ? 'off' : 'error')
          return
        }
        if (attempt === 0) {
          const fresh = await pull(code)
          if (!fresh.ok) {
            setStatus(fresh.denied ? 'denied' : 'off')
            return
          }
          version.current = fresh.version
          // Своих неотправленных правок нет — значит это устройство просто
          // отстало (вкладка провисела в спящем ноутбуке). Дослать свою память
          // означало бы стереть чужой день, поэтому принимаем облако.
          if (resolvePushConflict(dirty.current) === 'take-cloud' && fresh.doc) {
            saveCloudVersion(code, fresh.version)
            dispatch({ type: 'replaceDoc', doc: fresh.doc, now: Date.now() })
            setStatus('idle')
            return
          }
          // за время pull могла случиться ещё одна правка — берём самую свежую
          payload = latest.current
          continue
        }
      }

      // конфликт повторился — на этот раз действительно забираем чужое и
      // останавливаемся: спорить дальше означало бы слать запросы по кругу.
      // Версия обновляется ДО replaceDoc, иначе push-эффект тут же уйдёт в
      // новый конфликт на том же самом ответе.
      const fresh = await pull(code)
      if (fresh.ok && fresh.doc) {
        version.current = fresh.version
        saveCloudVersion(code, fresh.version)
        dispatch({ type: 'replaceDoc', doc: fresh.doc, now: Date.now() })
      }
      setStatus('idle')
    },
    [code, dispatch, dirty],
  )

  const sendNow = useCallback(
    async (payload: Doc) => {
      if (sending.current) {
        resendPending.current = true
        return
      }
      sending.current = true
      try {
        await attemptSend(payload)
      } finally {
        sending.current = false
        if (resendPending.current) {
          resendPending.current = false
          void sendNow(latest.current)
        }
      }
    },
    [attemptSend],
  )

  useEffect(() => {
    let alive = true
    enabled.current = false
    // версия, с которой точно согласованы данные этого устройства — известна
    // только по прошлой сверке с облаком, не всегда «0»
    const known = loadCloudVersion(code)
    version.current = known

    pull(code).then((res) => {
      if (!alive) return

      if (!res.ok) {
        // код не подошёл — облако работает, но не для него; молчать об этом
        // нельзя, иначе человек решит, что синхронизация сломалась
        setStatus(res.denied ? 'denied' : 'off')
        return
      }

      enabled.current = true
      setStatus('idle')

      const pulledDoc = res.doc
      const decision = reconcile({ doc: pulledDoc, version: res.version }, known, latest.current, dirty.current)
      switch (decision.kind) {
        case 'push-initial':
          void sendNow(latest.current)
          break
        case 'apply-cloud':
          if (pulledDoc) {
            version.current = decision.version
            saveCloudVersion(code, decision.version)
            dispatch({ type: 'replaceDoc', doc: pulledDoc, now: Date.now() })
          }
          break
        case 'keep-local':
          version.current = decision.version
          if (decision.push) void sendNow(latest.current)
          break
      }
    })

    return () => {
      alive = false
      enabled.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [code, dispatch, dirty, sendNow])

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

  // Уход со страницы (смена вкладки, закрытие) не должен ждать дебаунс —
  // иначе правка в последнюю секунду перед закрытием просто не уедет.
  // Возврат на вкладку, наоборот, перечитывает облако: вкладку могут не
  // закрывать сутками, и без этого ноутбук показывал бы вчерашний день, пока с
  // телефона уже отметили ночь.
  useEffect(() => {
    const flush = () => {
      if (!timer.current || !enabled.current) return
      clearTimeout(timer.current)
      timer.current = null
      keepaliveFlush(code, latest.current, version.current)
    }

    const resume = async () => {
      if (!shouldPullOnResume({ enabled: enabled.current, busy: !!timer.current || sending.current, hasUnsentEdits: dirty.current })) {
        return
      }
      const res = await pull(code)
      // строго новее того, что мы сами писали или читали, — значит правил кто-то другой
      if (!res.ok || !res.doc || res.version <= version.current) return
      version.current = res.version
      saveCloudVersion(code, res.version)
      dispatch({ type: 'replaceDoc', doc: res.doc, now: Date.now() })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else void resume()
    }
    // focus нужен вдобавок к visibilitychange: у macOS переключение между окнами
    // не всегда меняет видимость вкладки, а вернуться к ней хочется со свежими данными
    const onFocus = () => void resume()

    window.addEventListener('pagehide', flush)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [code, dispatch, dirty])

  return status
}
