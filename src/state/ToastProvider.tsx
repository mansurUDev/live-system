import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOpts {
  action?: ToastAction
  ms?: number
}

export interface ToastValue {
  message: string
  action?: ToastAction
}

type ToastFn = (message: string, opts?: ToastOpts) => void

const ToastContext = createContext<ToastFn | null>(null)
const ToastValueContext = createContext<ToastValue | null>(null)

const TOAST_MS = 3000
/** С кнопкой тост живёт дольше: три секунды на «Отменить» — это гонка с человеком */
const TOAST_ACTION_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ToastValue | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback<ToastFn>((message, opts) => {
    if (timer.current) clearTimeout(timer.current)
    const action = opts?.action
    setValue({
      message,
      // тост гаснет сам, до самого действия: иначе второй тап по кнопке
      // повторил бы возврат, а тост висел бы уже без смысла
      ...(action
        ? {
            action: {
              label: action.label,
              onClick: () => {
                if (timer.current) clearTimeout(timer.current)
                setValue(null)
                action.onClick()
              },
            },
          }
        : null),
    })
    const ms = opts?.ms ?? (opts?.action ? TOAST_ACTION_MS : TOAST_MS)
    timer.current = setTimeout(() => setValue(null), ms)
  }, [])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const fn = useMemo(() => toast, [toast])

  return (
    <ToastContext.Provider value={fn}>
      <ToastValueContext.Provider value={value}>{children}</ToastValueContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast вне ToastProvider')
  return ctx
}

export function useToastMessage(): ToastValue | null {
  return useContext(ToastValueContext)
}
