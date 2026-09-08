import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelExpectedDelivery,
  confirmExpectedDelivery,
  deleteExpectedDeliveryItem,
  importExpectedDelivery,
  updateExpectedDeliveryItems,
} from '../api/components'
import { ComponentForm, ExpectedDelivery, ExpectedDeliveryItem } from '../ts/types'

interface Props {
  deliveries: ExpectedDelivery[]
  loading: boolean
  onClose: () => void
  onReload: () => Promise<void>
  onConfirmed: (result: { created: number; merged: number; items: number }) => Promise<void>
  onNotice: (message: string) => void
}

const fields: { key: keyof ComponentForm; title: string; width?: string; type?: string }[] = [
  { key: 'group', title: 'Классификация', width: '170px' },
  { key: 'name', title: 'Наименование', width: '190px' },
  { key: 'value', title: 'Значение', width: '100px' },
  { key: 'unit', title: 'Ед. изм.', width: '90px' },
  { key: 'tol', title: 'Точность', width: '90px' },
  { key: 'description', title: 'Описание', width: '190px' },
  { key: 'case', title: 'Корпус', width: '100px' },
  { key: 'manufacturer', title: 'Производитель', width: '140px' },
  { key: 'cnt', title: 'Количество', width: '105px', type: 'number' },
  { key: 'cellnum', title: 'Ячейка', width: '110px' },
]

function toForm(item: ExpectedDeliveryItem): ComponentForm {
  const { id: _id, sourceRow: _sourceRow, ...form } = item
  return form
}

export default function ExpectedDeliveries({ deliveries, loading, onClose, onReload, onConfirmed, onNotice }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selectedId, setSelectedId] = useState(deliveries[0]?.id || '')
  const [drafts, setDrafts] = useState<Record<string, ComponentForm>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [])
  useEffect(() => {
    if (!deliveries.some(delivery => delivery.id === selectedId)) setSelectedId(deliveries[0]?.id || '')
    const next: Record<string, ComponentForm> = {}
    deliveries.forEach(delivery => delivery.items.forEach(item => { next[item.id] = toForm(item) }))
    setDrafts(current => ({ ...next, ...Object.fromEntries(Object.entries(current).filter(([id]) => dirty[id])) }))
  }, [deliveries, selectedId, dirty])

  const selected = deliveries.find(delivery => delivery.id === selectedId)
  const missingCells = useMemo(
    () => selected?.items.filter(item => !(drafts[item.id]?.cellnum ?? item.cellnum).trim()).length || 0,
    [selected, drafts],
  )
  const dirtyCount = Object.values(dirty).filter(Boolean).length

  function change(item: ExpectedDeliveryItem, key: keyof ComponentForm, value: string) {
    setDrafts(current => ({ ...current, [item.id]: { ...(current[item.id] || toForm(item)), [key]: value } }))
    setDirty(current => ({ ...current, [item.id]: true }))
  }

  async function saveAll() {
    const changedDeliveries = deliveries.map(delivery => ({
      id: delivery.id,
      items: delivery.items
        .filter(item => dirty[item.id] && drafts[item.id])
        .map(item => ({ id: item.id, ...drafts[item.id] })),
    })).filter(delivery => delivery.items.length > 0)
    if (!changedDeliveries.length) return
    setBusy(true); setError('')
    try {
      await Promise.all(changedDeliveries.map(delivery =>
        updateExpectedDeliveryItems(delivery.id, delivery.items)
      ))
      setDirty({})
      await onReload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить изменения.')
    } finally { setBusy(false) }
  }

  async function removeItem(item: ExpectedDeliveryItem) {
    if (!selected || !window.confirm(`Удалить строку ${item.sourceRow} «${drafts[item.id]?.name || item.name || item.group}» из поставки?`)) return
    setBusy(true); setError('')
    try {
      await deleteExpectedDeliveryItem(selected.id, item.id)
      setDirty(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      setDrafts(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      await onReload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить позицию.')
    } finally { setBusy(false) }
  }

  async function importFile(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true); setError('')
    try {
      const result = await importExpectedDelivery(file, name)
      await onReload()
      setSelectedId(result.id); setName(''); setFile(null)
      const input = dialog.current?.querySelector<HTMLInputElement>('#delivery-file')
      if (input) input.value = ''
      onNotice(`Поставка импортирована: ${result.items} поз.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось импортировать отчёт.')
    } finally { setBusy(false) }
  }

  async function confirm() {
    if (!selected || dirtyCount > 0 || selected.items.length === 0) return
    const question = missingCells
      ? `В ${missingCells} ${missingCells === 1 ? 'позиции не указана ячейка' : 'позициях не указаны ячейки'}. Они будут приняты на склад без номера ячейки. Продолжить?`
      : `Подтвердить поставку «${selected.name}»? Остатки будут увеличены.`
    if (!window.confirm(question)) return
    setBusy(true); setError('')
    try {
      const result = await confirmExpectedDelivery(selected.id)
      await Promise.all([onReload(), onConfirmed(result)])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось подтвердить поставку.')
    } finally { setBusy(false) }
  }

  async function cancel() {
    if (!selected || !window.confirm(`Отменить поставку «${selected.name}»? Складские остатки не изменятся.`)) return
    setBusy(true); setError('')
    try {
      await cancelExpectedDelivery(selected.id)
      const removedIds = new Set(selected.items.map(item => item.id))
      setDirty(current => Object.fromEntries(Object.entries(current).filter(([id]) => !removedIds.has(id))))
      setDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !removedIds.has(id))))
      await onReload()
      onNotice('Ожидаемая поставка отменена. Остатки не изменены.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отменить поставку.')
    } finally { setBusy(false) }
  }

  return <dialog ref={dialog} className="component-dialog deliveries-dialog" aria-labelledby="deliveries-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="dialog-heading">
      <div><h2 id="deliveries-title">Ожидаемые поставки</h2><p>Импорт из Excel и дозаказ из спецификаций</p></div>
      <button className="btn-close" aria-label="Закрыть" disabled={busy} onClick={onClose} />
    </div>
    <form className="delivery-import" onSubmit={importFile}>
      <label><span>Название</span><input className="form-control form-control-sm" value={name} maxLength={255} placeholder="По имени файла" onChange={event => setName(event.target.value)} /></label>
      <label className="delivery-file"><span>Отчёт Excel</span><input id="delivery-file" className="form-control form-control-sm" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <button className="btn btn-sm btn-primary" disabled={busy || !file}>{busy ? 'Загрузка…' : 'Создать поставку'}</button>
    </form>
    {error && <div className="alert alert-danger mx-4 mt-3 mb-0" role="alert">{error}</div>}
    <div className="deliveries-body">
      {loading ? <div className="delivery-empty"><span className="spinner-border spinner-border-sm" /> Загрузка поставок…</div> : deliveries.length === 0 ? <div className="delivery-empty"><strong>Ожидаемых поставок нет</strong><span>Загрузите Excel-отчёт, чтобы подготовить новую поставку.</span></div> : <>
        <div className="delivery-selector">
          <label><span>Поставка</span><select className="form-select form-select-sm" value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>{deliveries.map(delivery => <option key={delivery.id} value={delivery.id}>{delivery.name} ({delivery.items.length})</option>)}</select></label>
          {selected && <div className="delivery-meta">Источник: <strong>{selected.sourceFile}</strong><span>Создана: {selected.created}</span></div>}
        </div>
        {selected && <>
          <div className="delivery-status">
            <span>Позиций: <strong>{selected.items.length}</strong></span>
            <span className={missingCells ? 'text-danger' : 'text-success'}>Без ячейки: <strong>{missingCells}</strong></span>
            {dirtyCount > 0 && <span className="text-warning-emphasis">Несохранённых строк: {dirtyCount}</span>}
          </div>
          <div className="delivery-table-scroll">
            <table className="table table-sm delivery-table mb-0">
              <thead><tr><th>Строка</th>{fields.map(field => <th key={field.key} style={{ minWidth: field.width }}>{field.title}</th>)}<th aria-label="Удаление" /></tr></thead>
              <tbody>{selected.items.map(item => {
                const draft = drafts[item.id] || toForm(item)
                return <tr key={item.id} className={!draft.cellnum.trim() ? 'delivery-row-incomplete' : ''}>
                  <td>{item.sourceRow}</td>
                  {fields.map(field => <td key={field.key}><input className="form-control form-control-sm" type={field.type || 'text'} min={field.type === 'number' ? 1 : undefined} step={field.type === 'number' ? 1 : undefined} maxLength={field.type === 'number' ? undefined : 255} value={draft[field.key]} aria-label={`${field.title}, строка ${item.sourceRow}`} onChange={event => change(item, field.key, event.target.value)} /></td>)}
                  <td className="delivery-delete-cell"><button className="btn btn-sm btn-outline-danger delivery-delete-button" aria-label={`Удалить строку ${item.sourceRow}`} title="Удалить строку" disabled={busy} onClick={() => void removeItem(item)}>×</button></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </>}
      </>}
    </div>
    <div className="dialog-footer delivery-footer">
      <span>{selected && missingCells > 0 ? `Без ячейки: ${missingCells}. При подтверждении появится предупреждение.` : 'Остатки изменятся только после подтверждения.'}</span>
      <button className="btn btn-outline-primary" disabled={busy || dirtyCount === 0} onClick={() => void saveAll()}>Сохранить изменения{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</button>
      <button className="btn btn-outline-danger" disabled={busy || !selected} onClick={() => void cancel()}>Отменить поставку</button>
      <button className="btn btn-primary" disabled={busy || !selected || selected.items.length === 0 || dirtyCount > 0} onClick={() => void confirm()}>Подтвердить поставку</button>
    </div>
  </dialog>
}
