import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '../theme'
import { useData } from '../state/DataProvider'
import { useToast } from '../state/ToastProvider'
import { A } from '../state/actions'
import { backupCurrent, exportFile, parseImportFile } from '../state/storage'
import { ImportConfirmModal } from './modals/ImportConfirmModal'
import type { Doc } from '../types'

const headerStyle: CSSProperties = {
  maxWidth: 1220,
  margin: '0 auto',
  padding: '20px 18px 8px',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '10px 18px',
}

const dotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: C.cyan,
  boxShadow: '0 0 12px #22d3ee',
  animation: 'blink 2.4s ease-in-out infinite',
}

const titleStyle: CSSProperties = {
  fontSize: 23,
  fontWeight: 700,
  letterSpacing: '5px',
  textTransform: 'uppercase',
  color: C.textHead,
  textShadow: '0 0 20px rgba(34,211,238,.5)',
  margin: 0,
}

const subtitleStyle: CSSProperties = {
  fontSize: 12.5,
  letterSpacing: '1.5px',
  color: C.dim,
  margin: '3px 0 0 19px',
  textTransform: 'uppercase',
}

const ioBtn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  color: '#cbd5e1',
  background: 'rgba(148,163,184,.08)',
  border: '1px solid rgba(148,163,184,.28)',
  borderRadius: 10,
  padding: '8px 14px',
  cursor: 'pointer',
  letterSpacing: '.4px',
}

export function Header() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Doc | null>(null)

  const onExport = () => {
    toast(exportFile(state.doc) ? 'Файл с резервной копией сохранён' : 'Не получилось сохранить файл')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Сброс обязателен: иначе повторный выбор того же файла не вызовет onChange.
    e.target.value = ''
    if (!file) return

    const result = await parseImportFile(file)
    if (!result.ok) {
      toast(result.error)
      return
    }
    setPending(result.doc)
  }

  const applyImport = () => {
    if (!pending) return
    backupCurrent()
    dispatch(A.replaceDoc(pending))
    setPending(null)
    toast(
      `Импортировано: ${pending.sectors.length} на колесе, ${pending.entries.length} записей времени`,
    )
  }

  return (
    <>
      <header style={headerStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={dotStyle} />
            <h1 style={titleStyle}>Система жизни</h1>
          </div>
          <div style={subtitleStyle}>командный центр баланса и целей</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="h-ghost" style={ioBtn} onClick={onExport}>
            Экспорт в JSON
          </button>
          <button className="h-ghost" style={ioBtn} onClick={() => fileRef.current?.click()}>
            Импорт из JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </div>
      </header>

      {pending && (
        <ImportConfirmModal doc={pending} onCancel={() => setPending(null)} onConfirm={applyImport} />
      )}
    </>
  )
}
