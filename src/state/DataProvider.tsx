import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { normalize } from '../logic/normalize'
import { localDateKey } from '../logic/time'
import { useAuth } from './AuthProvider'
import { initialState, reducer, type Action, type AppState } from './reducer'
import { docKey, loadDoc, saveDoc, storageAvailable } from './storage'
import { useCloudSync, type SyncState } from './useCloudSync'
import { useToast } from './ToastProvider'

interface DataContextValue {
  state: AppState
  dispatch: (action: Action) => void
  /** состояние облачной синхронизации; 'off' — работаем только локально */
  sync: SyncState
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const { code } = useAuth()
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadDoc(code)))

  // Отдельный флаг, чтобы не показывать одно и то же предупреждение на каждое действие.
  const warned = useRef(false)

  // Снимок за сегодня появляется сам при любом действии; при первом запуске за день
  // действий может не быть, поэтому запрашиваем его сразу после загрузки.
  const ensured = useRef(false)
  useEffect(() => {
    if (ensured.current) return
    ensured.current = true
    if (!state.doc.snapshots[localDateKey(Date.now())]) {
      dispatch({ type: 'ensureSnapshot', now: Date.now() })
    }
    // Планка дохода живёт помесячно: если приложение не открывали с прошлого
    // месяца, итог всё равно закроется корректно при первом входе.
    dispatch({ type: 'rollFinanceMonth', now: Date.now() })
    if (!storageAvailable()) {
      toast('Браузер запрещает сохранение — данные живут только до закрытия вкладки')
      warned.current = true
    }
  }, [state.doc.snapshots, toast])

  // Последний JSON, записанный этой вкладкой: соседняя вкладка сохранит ровно
  // его же, и её событие `storage` не должно приниматься за чужую правку.
  const lastWritten = useRef('')

  useEffect(() => {
    const { result, json } = saveDoc(code, state.doc)
    lastWritten.current = json
    if (result === 'ok' || warned.current) return
    warned.current = true
    toast(
      result === 'quota'
        ? 'Не хватает места в браузере — выгрузи копию через «Экспорт в JSON»'
        : 'Браузер запрещает сохранение — данные живут только до закрытия вкладки',
    )
  }, [state.doc, code, toast])

  // Вторая вкладка того же приложения: без этой синхронизации она перезаписала бы
  // чужие правки и «воскресила» уже остановленный таймер.
  useEffect(() => {
    const key = docKey(code)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return
      // Соседняя вкладка сохранила ровно то же, что лежит и здесь — это эхо
      // общего состояния, а не правка. Принимать его за новость нельзя: обе
      // вкладки пересобирали бы документ по кругу, вхолостую переписывая
      // хранилище тысячи раз в секунду, и правка, сделанная в этот момент,
      // тонула бы в этом потоке.
      if (e.newValue === lastWritten.current) return
      try {
        dispatch({ type: 'replaceDoc', doc: normalize(JSON.parse(e.newValue)), now: Date.now() })
      } catch {
        /* чужая вкладка записала мусор — игнорируем */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [code])

  const sync = useCloudSync(code, state.doc, dispatch, toast)

  return <DataContext.Provider value={{ state, dispatch, sync }}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData вне DataProvider')
  return ctx
}

export function useDoc() {
  return useData().state.doc
}
