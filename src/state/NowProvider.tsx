import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { runningEntry } from '../logic/segs'
import { useData } from './DataProvider'

const NowContext = createContext<number>(0)

/** Секунда — когда на экране живой таймер; иначе редкий пульс */
const FAST_MS = 1000
const IDLE_MS = 30_000

/**
 * Тикающий текущий момент.
 *
 * Ежесекундно обновляется только тогда, когда это кто-то видит: идёт запись
 * времени либо открыт трекер. В остальное время достаточно редкого пульса —
 * без него аналитика, открытая спустя часы, считала бы период от момента
 * загрузки страницы и не заметила бы смены суток.
 *
 * Каждый тик берёт Date.now() заново: фоновые вкладки браузер притормаживает, и
 * счётчик «сам себе +1000» разъехался бы с реальным временем.
 */
export function NowProvider({ trackerOpen, children }: { trackerOpen: boolean; children: ReactNode }) {
  const { state } = useData()
  const hasRunning = !!runningEntry(state.doc.entries)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const period = hasRunning || trackerOpen ? FAST_MS : IDLE_MS
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), period)
    return () => clearInterval(id)
  }, [hasRunning, trackerOpen])

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>
}

export function useNow(): number {
  return useContext(NowContext)
}
