import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { LS_KEY } from '../constants'
import { normalize } from '../logic/normalize'
import { localDateKey } from '../logic/time'
import { initialState, reducer, type Action, type AppState } from './reducer'
import { loadDoc, saveDoc, storageAvailable } from './storage'
import { useToast } from './ToastProvider'

interface DataContextValue {
  state: AppState
  dispatch: (action: Action) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadDoc()))

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
    if (!storageAvailable()) {
      toast('Браузер запрещает сохранение — данные живут только до закрытия вкладки')
      warned.current = true
    }
  }, [state.doc.snapshots, toast])

  useEffect(() => {
    const result = saveDoc(state.doc)
    if (result === 'ok' || warned.current) return
    warned.current = true
    toast(
      result === 'quota'
        ? 'Не хватает места в браузере — выгрузи копию через «Экспорт в JSON»'
        : 'Браузер запрещает сохранение — данные живут только до закрытия вкладки',
    )
  }, [state.doc, toast])

  // Вторая вкладка того же приложения: без этой синхронизации она перезаписала бы
  // чужие правки и «воскресила» уже остановленный таймер.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return
      try {
        dispatch({ type: 'replaceDoc', doc: normalize(JSON.parse(e.newValue)), now: Date.now() })
      } catch {
        /* чужая вкладка записала мусор — игнорируем */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <DataContext.Provider value={{ state, dispatch }}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData вне DataProvider')
  return ctx
}

export function useDoc() {
  return useData().state.doc
}
