import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { diffSummary } from '../../logic/docSummary'
import { sameDoc } from '../../logic/merge'
import { fmtD } from '../../logic/time'
import { fetchHistory, fetchVersion, type VersionInfo } from '../../state/cloud'
import { useAuth } from '../../state/AuthProvider'
import { useData } from '../../state/DataProvider'
import { useToast } from '../../state/ToastProvider'
import { backupCurrent } from '../../state/storage'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, MONO, plainCard } from '../../theme'
import type { Doc } from '../../types'

type Loaded = { enabled: boolean; versions: VersionInfo[] } | null

/** Выбранная версия вместе с уже загруженным телом — до подтверждения ничего не меняется */
type Picked = { info: VersionInfo; doc: Doc } | null

/**
 * История версий документа.
 *
 * Откат не «понижает версию» в облаке — так нельзя, номер там только растёт.
 * Выбранное тело просто становится текущим документом и уезжает следующей
 * версией: для остальных устройств это обычная чужая правка, которую они
 * сольют привычным способом.
 */
export function VersionsModal({ onClose }: { onClose: () => void }) {
  const { code } = useAuth()
  const { state, dispatch } = useData()
  const toast = useToast()

  const [loaded, setLoaded] = useState<Loaded>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<Picked>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchHistory(code).then((res) => {
      if (!alive) return
      if (!res) setFailed(true)
      else setLoaded(res)
    })
    return () => {
      alive = false
    }
  }, [code])

  const pick = async (info: VersionInfo) => {
    setBusy(true)
    const doc = await fetchVersion(code, info.version)
    setBusy(false)
    if (!doc) {
      toast('Не получилось загрузить версию')
      return
    }
    setPicked({ info, doc })
  }

  const restore = () => {
    if (!picked) return
    if (sameDoc(picked.doc, state.doc)) {
      toast('Это и есть текущее состояние')
      setPicked(null)
      return
    }
    // копия перед заменой: та же страховка, что и при импорте файла
    backupCurrent(code)
    dispatch(A.replaceDoc(picked.doc))
    // месяц финансов переводится при входе, а восстановленный документ мог
    // застать другой месяц — иначе планка осталась бы от старого
    dispatch(A.rollFinanceMonth())
    onClose()
    toast(`Восстановлена версия от ${when(picked.info.savedAt)} — уедет в облако как новая`)
  }

  return (
    <Modal
      title={picked ? 'Восстановить версию' : 'История версий'}
      width={460}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={picked ? () => setPicked(null) : onClose}>
            {picked ? 'Назад' : 'Закрыть'}
          </button>
          {picked && (
            <button className="h-accent" style={btnAccent} onClick={restore}>
              Восстановить
            </button>
          )}
        </div>
      }
    >
      {picked ? (
        <Preview picked={picked} current={state.doc} />
      ) : (
        <List loaded={loaded} failed={failed} busy={busy} onPick={pick} />
      )}
    </Modal>
  )
}

function List({
  loaded,
  failed,
  busy,
  onPick,
}: {
  loaded: Loaded
  failed: boolean
  busy: boolean
  onPick: (info: VersionInfo) => void
}) {
  if (failed) return <Note text="Облако не ответило — попробуй позже" />
  if (!loaded) return <Note text="Загружаю…" />
  if (!loaded.enabled)
    return (
      <Note text="История выключена: в Supabase нужно один раз выполнить sql/schema.sql — там появилась таблица версий (см. README)." />
    )
  if (!loaded.versions.length) return <Note text="Пока ни одной версии — они появятся при следующих правках" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {loaded.versions.map((v, i) => (
        <button
          key={v.version}
          className="h-row-soft"
          disabled={busy}
          onClick={() => onPick(v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
            fontSize: 14,
            color: C.text,
            background: 'none',
            border: '1px solid rgba(148,163,184,.18)',
            borderRadius: 10,
            padding: '10px 12px',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <span style={{ flex: 1 }}>
            {when(v.savedAt)}
            {i === 0 && <span style={{ color: C.faint, marginLeft: 8 }}>текущая</span>}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>{Math.round(v.bytes / 1024)} КБ</span>
        </button>
      ))}
    </div>
  )
}

function Preview({ picked, current }: { picked: NonNullable<Picked>; current: Doc }) {
  const diff = diffSummary(current, picked.doc)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 15, color: C.textBright }}>Версия от {when(picked.info.savedAt)}</div>
      <div style={plainCard({ padding: '12px 14px', marginTop: 10, fontSize: 14, color: C.textSoft, lineHeight: 1.6 })}>
        {diff.length ? diff.join(', ') : 'Содержимое совпадает с текущим'}
      </div>
      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        Всё, что записано после этой версии на любом устройстве, будет заменено. Копия текущего состояния
        сохранится в браузере — на случай, если откат окажется лишним.
      </div>
    </div>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div style={plainCard({ padding: 16, marginTop: 12, fontSize: 13.5, color: C.faint, lineHeight: 1.5 })}>{text}</div>
  )
}

/** Дата и время: за сегодняшним снимком идёт вчерашний, и час их различает */
function when(iso: string): string {
  const d = new Date(iso)
  const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  return `${fmtD(iso)}, ${hhmm}`
}
