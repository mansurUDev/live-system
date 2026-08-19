import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyBase, sameDoc } from '../logic/merge'
import { pull, push } from './cloud'
import { loadBase, loadCloudVersion, saveSyncPoint, versionKey } from './storage'
import { planSync, shouldPullOnResume } from './syncReconcile'
import type { Action } from './reducer'
import type { Doc } from '../types'

/** Пауза перед отправкой: серия правок уезжает одним запросом */
const PUSH_DELAY_MS = 1500

/** Сколько раз подряд уступаем чужой записи, прежде чем перестать спорить */
const MAX_CONFLICTS = 3

/** Больше браузер в keepalive-запрос всё равно не пустит */
const KEEPALIVE_LIMIT = 60_000

export type SyncState = 'off' | 'denied' | 'idle' | 'saving' | 'error'

/** Лучшее из возможного при закрытии вкладки — обычный fetch тело > ~64КБ не потянет */
function keepaliveFlush(code: string, doc: Doc, version: number): void {
  try {
    const body = JSON.stringify({ doc, version })
    if (body.length > KEEPALIVE_LIMIT) return
    fetch('/api/doc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-access-code': code },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* тело не собралось — не страшнее, чем если бы страница просто закрылась раньше */
  }
}

/**
 * Синхронизация с облаком.
 *
 * Облако хранит документ целиком, поэтому расхождение раньше решалось выбором
 * стороны — и любой выбор что-то стирал. Теперь у устройства есть база (тело
 * документа на версии, с которой оно согласовано), и расхождение объединяется:
 * см. `mergeDoc`. Отсюда три следствия, на которых всё держится.
 *
 * 1. «Есть неотправленные правки» — не флаг в памяти, а факт: документ отличается
 *    от базы. Флаг умирал вместе с вкладкой, и правка, не успевшая уехать до
 *    закрытия, на следующей загрузке выглядела как «своего нет».
 * 2. Слияние уезжает в редьюсер действием `mergeCloud`, а не считается здесь:
 *    пока летел запрос, человек мог что-то нажать, и это обязано попасть внутрь.
 * 3. Перед отправкой стоит эхо-стоп: тело, равное базе, не отправляется. Иначе
 *    каждое принятие облака поднимало бы версию, ничего не меняя, и превращало
 *    все остальные устройства в «отставшие» на ровном месте.
 */
export function useCloudSync(
  code: string,
  doc: Doc,
  dispatch: (a: Action) => void,
  notify?: (text: string) => void,
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
  const baseCache = useRef<{ version: number; doc: Doc } | null>(null)
  // последнее отправленное тело: по нему узнаём в облаке свою же запись,
  // ответ на которую не дошёл (keepalive при закрытии вкладки ответа не читает)
  const lastSent = useRef<Doc | null>(null)
  const conflicts = useRef(0)
  const warnedNoBase = useRef(false)
  const pendingPoint = useRef<{ version: number; doc: Doc } | null>(null)

  const getBase = useCallback((): Doc | null => {
    const cached = baseCache.current
    if (cached && cached.version === version.current) return cached.doc
    const stored = loadBase(code)
    if (stored) baseCache.current = { version: version.current, doc: stored }
    return stored
  }, [code])

  /**
   * Облако на версии v содержит ровно doc — точка согласования.
   *
   * Годится там, где отправленное тело уже лежит в хранилище: перед отправкой
   * документ прошёл через рендер, а DataProvider пишет его на каждое изменение.
   */
  const commit = useCallback(
    (v: number, next: Doc) => {
      version.current = v
      baseCache.current = { version: v, doc: next }
      saveSyncPoint(code, v, next)
    },
    [code],
  )

  /**
   * То же, но когда чужой документ ещё только предстоит применить.
   *
   * На диск точка уезжает не сразу, а когда результат уже сохранён: эффекты
   * этого хука отрабатывают после эффекта DataProvider, который пишет документ.
   * Иначе вкладка, погибшая между записью базы и сохранением слитого документа,
   * оставила бы базу «впереди» содержимого — и следующая загрузка сочла бы
   * чужие правки своими и отправила бы старое тело поверх них. С отложенной
   * записью в худшем случае останется прежняя точка, и слияние повторится.
   */
  const commitOnApply = useCallback((v: number, next: Doc) => {
    version.current = v
    baseCache.current = { version: v, doc: next }
    pendingPoint.current = { version: v, doc: next }
  }, [])

  /** Слить нечем: сообщаем и уступаем облаку — прежнее поведение, но не молча */
  const surrender = useCallback(
    (v: number, cloud: Doc) => {
      commitOnApply(v, cloud)
      dispatch({ type: 'replaceDoc', doc: cloud, now: Date.now() })
      if (!warnedNoBase.current) {
        warnedNoBase.current = true
        notify?.('Не хватило места для копии — данные взяты из облака. Выгрузи JSON, если что-то пропало')
      }
    },
    [commitOnApply, dispatch, notify],
  )

  const attemptSend = useCallback(
    async (payload: Doc) => {
      const base = getBase()
      // отправлять нечего: в облаке ровно это и лежит
      if (base && sameDoc(payload, base)) {
        setStatus('idle')
        return
      }

      setStatus('saving')
      // первая вставка в пустое облако — единственный случай, где базы нет
      // законно и где объединять от пустоты безопасно: удалять ещё нечего
      const wasInitial = version.current === 0
      lastSent.current = payload

      const res = await push(code, payload, version.current)
      if (res.ok) {
        commit(res.version, payload)
        conflicts.current = 0
        setStatus('idle')
        return
      }
      if (!res.conflict) {
        // правка целиком остаётся локально, база не сдвинута — уедет позже
        setStatus(res.error === 'offline' ? 'off' : 'error')
        return
      }

      const fresh = await pull(code)
      if (!fresh.ok) {
        setStatus(fresh.denied ? 'denied' : 'off')
        return
      }
      if (!fresh.doc) {
        // документ из облака убрали — следующая отправка вставит заново
        version.current = fresh.version
        resendPending.current = true
        setStatus('idle')
        return
      }

      // В облаке наше же тело: keepalive при закрытии вкладки долетел, а ответ
      // прочитать было уже некому. Это успех, а не чужая правка.
      if (lastSent.current && sameDoc(fresh.doc, lastSent.current)) {
        commit(fresh.version, fresh.doc)
        conflicts.current = 0
        resendPending.current = true
        setStatus('idle')
        return
      }

      conflicts.current += 1
      if (conflicts.current > MAX_CONFLICTS) {
        // кто-то пишет непрерывно; ничего не отбрасываем — документ остаётся
        // «база + свои правки», следующая правка или возврат на вкладку повторят
        conflicts.current = 0
        setStatus('error')
        return
      }

      const prev = getBase() ?? (wasInitial ? emptyBase(Date.now()) : null)
      if (!prev) {
        surrender(fresh.version, fresh.doc)
        return
      }
      commitOnApply(fresh.version, fresh.doc)
      dispatch({ type: 'mergeCloud', base: prev, cloud: fresh.doc, now: Date.now() })
      setStatus('idle')
    },
    [code, commit, commitOnApply, dispatch, getBase, surrender],
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
    baseCache.current = null
    conflicts.current = 0
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

      const base = getBase()
      const plan = planSync({ doc: res.doc, version: res.version }, known, base, latest.current)
      const now = Date.now()

      switch (plan.kind) {
        case 'push-initial':
          void sendNow(latest.current)
          break
        case 'apply-cloud':
          if (res.doc) {
            commitOnApply(plan.version, res.doc)
            dispatch({ type: 'replaceDoc', doc: res.doc, now })
          }
          break
        case 'in-sync':
          // содержимое совпало — остаётся завести базу, если её ещё не было
          if (res.doc) commit(plan.version, res.doc)
          break
        case 'push-local':
          if (res.doc) commit(plan.version, res.doc)
          void sendNow(latest.current)
          break
        case 'merge':
          if (res.doc && base) {
            commitOnApply(plan.version, res.doc)
            dispatch({ type: 'mergeCloud', base, cloud: res.doc, now })
          }
          break
      }
    })

    return () => {
      alive = false
      enabled.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [code, commit, commitOnApply, dispatch, getBase, sendNow])

  // Отложенная точка согласования уезжает на диск здесь: этот эффект следует за
  // эффектом DataProvider, который уже записал новый документ.
  useEffect(() => {
    const point = pendingPoint.current
    if (!point) return
    pendingPoint.current = null
    saveSyncPoint(code, point.version, point.doc)
  }, [code, doc])

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
      const payload = latest.current
      const base = getBase()
      if (base && sameDoc(payload, base)) return
      // Таймер намеренно не снимаем: если вкладка выживет, обычный запрос с
      // чтением ответа доедет сам, а повтор безвреден — своё же тело в облаке
      // узнаётся по lastSent и засчитывается как успех.
      lastSent.current = payload
      keepaliveFlush(code, payload, version.current)
    }

    const resume = async () => {
      if (!shouldPullOnResume({ enabled: enabled.current, busy: !!timer.current || sending.current })) return
      const res = await pull(code)
      // строго новее того, что мы сами писали или читали, — значит правил кто-то другой
      if (!res.ok || !res.doc || res.version <= version.current) return
      const base = getBase()
      const now = Date.now()
      if (!base) {
        surrender(res.version, res.doc)
        return
      }
      commitOnApply(res.version, res.doc)
      dispatch({ type: 'mergeCloud', base, cloud: res.doc, now })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else void resume()
    }
    // focus нужен вдобавок к visibilitychange: у macOS переключение между окнами
    // не всегда меняет видимость вкладки, а вернуться к ней хочется со свежими данными
    const onFocus = () => void resume()

    // соседняя вкладка договорилась с облаком — её версия и база теперь общие
    const onStorage = (e: StorageEvent) => {
      if (e.key !== versionKey(code)) return
      const v = Number(e.newValue) || 0
      if (v <= version.current) return
      version.current = v
      baseCache.current = null
    }

    window.addEventListener('pagehide', flush)
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [code, commitOnApply, dispatch, getBase, surrender])

  return status
}
