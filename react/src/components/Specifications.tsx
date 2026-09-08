import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  addSpecificationItem, createSpecification, deleteSpecification,
  deleteSpecificationItem, importSpecification, specificationExportUrl,
  updateSpecification, updateSpecificationItem,
} from '../api/components'
import { Component, componentTypes, Specification, SpecificationItem, SpecificationItemForm } from '../ts/types'

interface Props {
  specifications: Specification[]
  components: Component[]
  selectedComponent?: Component
  loading: boolean
  onClose: () => void
  onReload: () => Promise<void>
  onNotice: (message: string) => void
}

const fields: { key: keyof SpecificationItemForm; title: string; width: string; type?: string }[] = [
  { key: 'componentId', title: 'ID склада', width: '105px' },
  { key: 'group', title: 'Классификация', width: '170px' },
  { key: 'name', title: 'Наименование', width: '190px' },
  { key: 'value', title: 'Значение', width: '95px' },
  { key: 'unit', title: 'Ед. изм.', width: '85px' },
  { key: 'tol', title: 'Точность', width: '85px' },
  { key: 'case', title: 'Корпус', width: '95px' },
  { key: 'manufacturer', title: 'Производитель', width: '140px' },
  { key: 'description', title: 'Описание', width: '180px' },
  { key: 'quantityPerDevice', title: 'На устройство', width: '110px', type: 'number' },
]

function toDraft(item: SpecificationItem): SpecificationItemForm {
  return Object.fromEntries(fields.map(field => [field.key, item[field.key]])) as unknown as SpecificationItemForm
}

function fromComponent(component: Component): SpecificationItemForm {
  return {
    componentId: component.id, group: component.group, name: component.name,
    value: component.value, unit: component.unit, tol: component.tol,
    description: component.description, case: component.case,
    manufacturer: component.manufacturer, quantityPerDevice: '1',
  }
}

const emptyItem = (): SpecificationItemForm => ({
  componentId: '', group: 'Резистор', name: '', value: '', unit: 'Ом', tol: '',
  description: '', case: '', manufacturer: '', quantityPerDevice: '1',
})

export default function Specifications({ specifications, components, selectedComponent, loading, onClose, onReload, onNotice }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selectedId, setSelectedId] = useState(specifications[0]?.id || '')
  const [newName, setNewName] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')
  const [file, setFile] = useState<File | null>(null)
  const [headerName, setHeaderName] = useState('')
  const [deviceQuantity, setDeviceQuantity] = useState('1')
  const [drafts, setDrafts] = useState<Record<string, SpecificationItemForm>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pickerItem, setPickerItem] = useState<SpecificationItem | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    if (!specifications.some(specification => specification.id === selectedId)) setSelectedId(specifications[0]?.id || '')
    const next: Record<string, SpecificationItemForm> = {}
    specifications.forEach(specification => specification.items.forEach(item => { next[item.id] = toDraft(item) }))
    setDrafts(current => ({ ...next, ...Object.fromEntries(Object.entries(current).filter(([id]) => dirty[id])) }))
  }, [specifications, selectedId, dirty])

  const selected = specifications.find(specification => specification.id === selectedId)
  useEffect(() => {
    if (selected) { setHeaderName(selected.name); setDeviceQuantity(selected.deviceQuantity) }
  }, [selected?.id, selected?.name, selected?.deviceQuantity])
  const selectedDirty = selected?.items.filter(item => dirty[item.id]).length || 0
  const headerDirty = Boolean(selected && (headerName !== selected.name || deviceQuantity !== selected.deviceQuantity))
  const stockOptions = useMemo(() => components.map(component => ({
    id: component.id,
    label: `${component.id} — ${component.name || component.group}${component.value ? `, ${component.value} ${component.unit}` : ''}, ${component.case || 'без корпуса'}`,
  })), [components])
  const componentsById = useMemo(() => new Map(components.map(component => [component.id, component])), [components])
  const pickerResults = useMemo(() => {
    const terms = pickerSearch.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean)
    if (!terms.length) return components.slice(0, 50)
    return components.filter(component => {
      const text = [component.id, component.group, component.name, component.value,
        component.unit, component.tol, component.description, component.case,
        component.manufacturer, component.cellnum].join(' ').toLocaleLowerCase('ru')
      return terms.every(term => text.includes(term))
    }).slice(0, 50)
  }, [components, pickerSearch])

  function fail(reason: unknown, fallback: string) {
    setError(reason instanceof Error ? reason.message : fallback)
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = file
        ? await importSpecification(file, newName || file.name.replace(/\.xlsx$/i, ''), newQuantity)
        : await createSpecification(newName, newQuantity)
      await onReload()
      setSelectedId(result.id); setNewName(''); setNewQuantity('1'); setFile(null)
      const input = dialog.current?.querySelector<HTMLInputElement>('#specification-file')
      if (input) input.value = ''
      onNotice(file ? `Спецификация импортирована: ${'items' in result ? result.items : 0} поз.` : 'Спецификация создана.')
    } catch (reason) { fail(reason, 'Не удалось создать спецификацию.') }
    finally { setBusy(false) }
  }

  async function save() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      if (headerDirty) await updateSpecification(selected.id, headerName, deviceQuantity)
      const changedItems = selected.items.filter(item => dirty[item.id])
      for (const item of changedItems) {
        await updateSpecificationItem(selected.id, item.id, drafts[item.id])
      }
      setDirty(current => Object.fromEntries(Object.entries(current).filter(([id]) => !selected.items.some(item => item.id === id))))
      await onReload()
      onNotice('Спецификация сохранена и пересчитана.')
    } catch (reason) { fail(reason, 'Не удалось сохранить спецификацию.') }
    finally { setBusy(false) }
  }

  async function add(item: SpecificationItemForm) {
    if (!selected) return
    setBusy(true); setError('')
    try {
      await addSpecificationItem(selected.id, item)
      await onReload()
      onNotice(item.componentId ? `Компонент №${item.componentId} добавлен в спецификацию.` : 'Свободная строка добавлена.')
    } catch (reason) { fail(reason, 'Не удалось добавить позицию.') }
    finally { setBusy(false) }
  }

  async function removeItem(item: SpecificationItem) {
    if (!selected || !window.confirm(`Удалить «${item.name || item.group}» из спецификации?`)) return
    setBusy(true); setError('')
    try { await deleteSpecificationItem(selected.id, item.id); await onReload() }
    catch (reason) { fail(reason, 'Не удалось удалить позицию.') }
    finally { setBusy(false) }
  }

  async function removeSpecification() {
    if (!selected || !window.confirm(`Удалить спецификацию «${selected.name}»?`)) return
    setBusy(true); setError('')
    try { await deleteSpecification(selected.id); setSelectedId(''); await onReload(); onNotice('Спецификация удалена.') }
    catch (reason) { fail(reason, 'Не удалось удалить спецификацию.') }
    finally { setBusy(false) }
  }

  function change(item: SpecificationItem, key: keyof SpecificationItemForm, value: string) {
    setDrafts(current => ({ ...current, [item.id]: { ...(current[item.id] || toDraft(item)), [key]: value } }))
    setDirty(current => ({ ...current, [item.id]: true }))
  }

  function openPicker(item: SpecificationItem) {
    setPickerItem(item)
    setPickerSearch(item.value ? `${item.value} ${item.unit}` : item.name)
  }

  function chooseComponent(component: Component) {
    if (!pickerItem) return
    const quantityPerDevice = (drafts[pickerItem.id] || toDraft(pickerItem)).quantityPerDevice
    setDrafts(current => ({
      ...current,
      [pickerItem.id]: { ...fromComponent(component), quantityPerDevice },
    }))
    setDirty(current => ({ ...current, [pickerItem.id]: true }))
    setPickerItem(null)
  }

  const statusText = (item: SpecificationItem) => item.status === 'enough' ? 'Хватает' : item.status === 'shortage' ? `Не хватает ${item.shortageQuantity}` : 'Не сопоставлено'

  return <dialog ref={dialog} className="component-dialog specifications-dialog" aria-labelledby="specifications-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="dialog-heading">
      <div><h2 id="specifications-title">Спецификации</h2><p>Потребность на тираж и контроль складских остатков</p></div>
      <button className="btn-close" aria-label="Закрыть" disabled={busy} onClick={onClose} />
    </div>
    <form className="specification-create" onSubmit={create}>
      <label><span>Название</span><input className="form-control form-control-sm" value={newName} maxLength={255} placeholder={file ? 'По имени файла' : 'Например, Контроллер v2'} required={!file} onChange={event => setNewName(event.target.value)} /></label>
      <label className="device-count"><span>Устройств</span><input className="form-control form-control-sm" type="number" min="1" step="1" value={newQuantity} required onChange={event => setNewQuantity(event.target.value)} /></label>
      <label className="specification-file"><span>Импорт (необязательно)</span><input id="specification-file" className="form-control form-control-sm" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <button className="btn btn-sm btn-primary" disabled={busy}>{file ? 'Импортировать' : 'Создать пустую'}</button>
    </form>
    {error && <div className="alert alert-danger mx-4 mt-3 mb-0" role="alert">{error}</div>}
    <div className="specifications-body">
      {loading ? <div className="delivery-empty">Загрузка спецификаций…</div> : specifications.length === 0 ? <div className="delivery-empty"><strong>Спецификаций пока нет</strong><span>Создайте пустую вручную или загрузите Excel-файл.</span></div> : <>
        <div className="specification-toolbar">
          <label className="specification-picker"><span>Спецификация</span><select className="form-select form-select-sm" value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>{specifications.map(specification => <option value={specification.id} key={specification.id}>{specification.name}</option>)}</select></label>
          {selected && <>
            <label className="specification-name"><span>Название</span><input className="form-control form-control-sm" value={headerName} maxLength={255} onChange={event => setHeaderName(event.target.value)} /></label>
            <label className="device-count"><span>Устройств</span><input className="form-control form-control-sm" type="number" min="1" step="1" value={deviceQuantity} onChange={event => setDeviceQuantity(event.target.value)} /></label>
            <button className="btn btn-sm btn-outline-danger align-self-end" disabled={busy} onClick={() => void removeSpecification()}>Удалить</button>
          </>}
        </div>
        {selected && <>
          <div className="specification-summary">
            <span>Позиций: <strong>{selected.summary.items}</strong></span>
            <span className="text-success">Хватает: <strong>{selected.summary.enough}</strong></span>
            <span className={selected.summary.shortage ? 'text-danger' : 'text-success'}>К дозаказу: <strong>{selected.summary.shortage} поз. / {selected.summary.toOrder} шт.</strong></span>
            <div className="specification-add-actions">
              {selectedComponent && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void add(fromComponent(selectedComponent))}>Добавить выбранный №{selectedComponent.id}</button>}
              <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => void add(emptyItem())}>Добавить строку по параметрам</button>
            </div>
          </div>
          <datalist id="specification-components">{stockOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</datalist>
          <datalist id="specification-types">{componentTypes.map(type => <option key={type} value={type} />)}</datalist>
          <div className="specification-table-scroll">
            <table className="table table-sm specification-table mb-0">
              <thead><tr>{fields.map(field => <th key={field.key} style={{ minWidth: field.width }}>{field.title}</th>)}<th>Требуется</th><th>Склад</th><th>Результат</th><th /></tr></thead>
              <tbody>{selected.items.map(item => {
                const draft = drafts[item.id] || toDraft(item)
                const draftComponent = componentsById.get(draft.componentId)
                const linkChanged = Boolean(dirty[item.id] && draftComponent && draft.componentId !== item.componentId)
                const displayStatus = linkChanged ? 'pending' : item.status
                return <tr key={item.id} className={`specification-row-${displayStatus}`}>
                  {fields.map(field => <td key={field.key}><input className="form-control form-control-sm" type={field.type || 'text'} min={field.type === 'number' ? 1 : undefined} step={field.type === 'number' ? 1 : undefined} list={field.key === 'componentId' ? 'specification-components' : field.key === 'group' ? 'specification-types' : undefined} value={draft[field.key]} aria-label={field.title} onChange={event => change(item, field.key, event.target.value)} /></td>)}
                  <td className="specification-number">{item.requiredQuantity}</td>
                  <td className="specification-number">{linkChanged ? draftComponent?.cnt : item.stockQuantity}</td>
                  <td><span className={`specification-status ${displayStatus}`}>{linkChanged ? `Связь №${draft.componentId} выбрана` : statusText(item)}</span><button className="specification-pick-button" disabled={busy} onClick={() => openPicker(item)}>{draft.componentId ? 'Изменить связь' : 'Найти на складе'}</button></td>
                  <td><button className="btn btn-sm btn-outline-danger delivery-delete-button" aria-label="Удалить позицию" disabled={busy} onClick={() => void removeItem(item)}>×</button></td>
                </tr>
              })}</tbody>
            </table>
            {selected.items.length === 0 && <div className="delivery-empty"><strong>В спецификации нет позиций</strong><span>Выберите компонент в основном каталоге или добавьте строку по параметрам.</span></div>}
          </div>
        </>}
      </>}
    </div>
    {pickerItem && <div className="component-picker-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPickerItem(null) }}>
      <section className="component-picker" role="dialog" aria-modal="true" aria-labelledby="component-picker-title">
        <div className="component-picker-heading"><div><h3 id="component-picker-title">Выбрать компонент на складе</h3><p>Строка: {pickerItem.name || [pickerItem.value, pickerItem.unit].filter(Boolean).join(' ') || pickerItem.group}</p></div><button className="btn-close" aria-label="Закрыть подбор" onClick={() => setPickerItem(null)} /></div>
        <div className="component-picker-search"><input className="form-control" type="search" autoFocus placeholder="ID, артикул, номинал, корпус, описание…" value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} /><span>Показано {pickerResults.length} из {components.length}</span></div>
        <div className="component-picker-results">
          <table className="table table-sm mb-0"><thead><tr><th>ID</th><th>Классификация</th><th>Наименование</th><th>Номинал</th><th>Корпус</th><th>Описание</th><th>Остаток</th><th /></tr></thead>
            <tbody>{pickerResults.map(component => <tr key={component.id}><td>{component.id}</td><td>{component.group}</td><td><strong>{component.name || '—'}</strong></td><td>{component.value ? `${component.value} ${component.unit}` : '—'}</td><td>{component.case || '—'}</td><td>{component.description || '—'}</td><td>{component.cnt}</td><td><button className="btn btn-sm btn-primary" onClick={() => chooseComponent(component)}>Привязать</button></td></tr>)}</tbody>
          </table>
          {pickerResults.length === 0 && <div className="component-picker-empty">На складе ничего не найдено. Измените поисковый запрос.</div>}
        </div>
        <div className="component-picker-footer">Выбранная связь сразу появится в строке. Для её сохранения нажмите «Сохранить и пересчитать».</div>
      </section>
    </div>}
    <div className="dialog-footer specification-footer">
      <span>{selectedDirty || headerDirty ? `Есть несохранённые изменения${selectedDirty ? `: ${selectedDirty} строк` : ''}` : 'Расчёт использует текущие остатки склада.'}</span>
      {selected && <>
        <a className={`btn btn-outline-secondary ${busy ? 'disabled' : ''}`} href={specificationExportUrl(selected.id, 'all')}>Выгрузить весь список</a>
        <a className={`btn btn-outline-primary ${busy || selected.summary.shortage === 0 ? 'disabled' : ''}`} href={specificationExportUrl(selected.id, 'missing')}>Выгрузить дозаказ</a>
        <button className="btn btn-primary" disabled={busy || (!selectedDirty && !headerDirty)} onClick={() => void save()}>Сохранить и пересчитать</button>
      </>}
    </div>
  </dialog>
}
