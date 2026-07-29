import { Modal } from './Modal'
import { btnAccent, btnGhost, C } from '../../theme'
import { plural } from '../../logic/time'
import type { Doc } from '../../types'

interface Props {
  doc: Doc
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Импорт затирает всё содержимое, поэтому спрашиваем подтверждение и показываем,
 * что именно приедет. Предыдущее состояние перед заменой уходит в резервный ключ.
 */
export function ImportConfirmModal({ doc, onCancel, onConfirm }: Props) {
  const sectors = doc.sectors.length
  const entries = doc.entries.length
  const acts = doc.acts.length
  const archive = doc.archive.length

  return (
    <Modal
      title="Заменить данные?"
      width={460}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={onConfirm}>
            Импортировать
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12, fontSize: 14.5, color: C.textSoft, lineHeight: 1.5 }}>
        Из файла приедет: на колесе — {sectors}, {entries}{' '}
        {plural(entries, 'запись', 'записи', 'записей')} времени, {acts}{' '}
        {plural(acts, 'кнопка', 'кнопки', 'кнопок')}
        {archive > 0 && `, ${archive} в архиве`}.
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: C.faint, lineHeight: 1.5 }}>
        Текущие данные будут заменены. Их копия сохранится в браузере под отдельным ключом — на
        случай, если импорт окажется ошибкой.
      </div>
    </Modal>
  )
}
