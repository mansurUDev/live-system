import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../state/AuthProvider'
import { useData } from '../state/DataProvider'
import { useToast } from '../state/ToastProvider'
import { A } from '../state/actions'
import { backupCurrent, exportFile, parseImportFile } from '../state/storage'
import { ImportConfirmModal } from '../components/modals/ImportConfirmModal'
import type { Doc } from '../types'

/**
 * Выгрузка и загрузка резервной копии.
 *
 * Вынесено в хук, потому что вызывать это можно из двух мест: из шапки на
 * большом экране и из меню «Ещё» на телефоне — а скрытый input и модалка
 * подтверждения при этом должны существовать в одном экземпляре.
 */
export function useBackup(): {
  onExport: () => void
  onImport: () => void
  elements: ReactNode
} {
  const { state, dispatch } = useData()
  const { code } = useAuth()
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
    backupCurrent(code)
    dispatch(A.replaceDoc(pending))
    setPending(null)
    toast(`Импортировано: ${pending.sectors.length} на колесе, ${pending.entries.length} записей времени`)
  }

  const elements = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        onChange={onFile}
        style={{ display: 'none' }}
      />
      {pending && (
        <ImportConfirmModal doc={pending} onCancel={() => setPending(null)} onConfirm={applyImport} />
      )}
    </>
  )

  return { onExport, onImport: () => fileRef.current?.click(), elements }
}
