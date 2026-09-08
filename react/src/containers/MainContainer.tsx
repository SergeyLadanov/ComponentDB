import { useEffect, useMemo, useRef, useState } from 'react'
import { getExpectedDeliveries, getSpecifications, saveComponent } from '../api/components'
import ComponentForm from '../components/ComponentForm'
import ComponentTable from '../components/ComponentTable'
import ExpectedDeliveries from '../components/ExpectedDeliveries'
import Specifications from '../components/Specifications'
import { useComponents } from '../hooks/useComponents'
import { createComponentSearch, createSearchHighlighter } from '../ts/search'
import { ColumnFilters, ColumnKey, columns, ComponentForm as FormData, componentTypes, emptyForm, ExpectedDelivery, Operation, Specification } from '../ts/types'

const compare = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })
const normalize = (text: string) => text.toLocaleLowerCase('ru').trim()

export default function MainContainer() {
  const { components, loading, error, reload } = useComponents()
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [sort, setSort] = useState<{ key: ColumnKey; ascending: boolean }>({ key: 'id', ascending: true })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [subtract, setSubtract] = useState('1')
  const [modal, setModal] = useState<{ initial: FormData; id: string; editing: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [deliveries, setDeliveries] = useState<ExpectedDelivery[]>([])
  const [deliveriesOpen, setDeliveriesOpen] = useState(false)
  const [deliveriesLoading, setDeliveriesLoading] = useState(false)
  const [specifications, setSpecifications] = useState<Specification[]>([])
  const [specificationsOpen, setSpecificationsOpen] = useState(false)
  const [specificationsLoading, setSpecificationsLoading] = useState(false)

  const types = useMemo(() => Array.from(new Set([...componentTypes, ...components.map(item => item.group)])), [components])
  const highlight = useMemo(() => createSearchHighlighter(search, components.map(item => item.unit)), [search, components])
  const filtered = useMemo(() => {
    const matchesSearch = createComponentSearch(search, components.map(item => item.unit))
    const columnFilters = Object.entries(filters) as [ColumnKey, string][]
    return components.filter(item => {
      if (type && item.group !== type) return false
      return matchesSearch(item) && columnFilters.every(([key, value]) => normalize(item[key]).includes(normalize(value)))
    }).sort((left, right) => {
      const column = columns.find(item => item.key === sort.key)
      let value = compare.compare(left[sort.key], right[sort.key])
      if (column?.numeric && left[sort.key] !== '' && right[sort.key] !== '') {
        const a = Number(left[sort.key].replace(',', '.'))
        const b = Number(right[sort.key].replace(',', '.'))
        if (Number.isFinite(a) && Number.isFinite(b)) value = a - b
      }
      return sort.ascending ? value : -value
    })
  }, [components, type, search, filters, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedComponents = selectedIds.flatMap(id => {
    const component = components.find(item => item.id === id)
    return component ? [component] : []
  })
  const selected = selectedComponents.length === 1 ? selectedComponents[0] : undefined
  const disabled = busy || loading || Boolean(error)
  const hasFilters = Boolean(type || search || Object.values(filters).some(Boolean))
  const totalQuantity = components.reduce((total, item) => total + Number(item.cnt), 0)

  useEffect(() => { setPage(1); setSelectedIds([]) }, [type, search, filters, pageSize])
  useEffect(() => {
    setSelectedIds(current => current.filter(id => components.some(item => item.id === id)))
  }, [components])
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  useEffect(() => { void Promise.all([reloadDeliveries(), reloadSpecifications()]) }, [])

  async function reloadDeliveries() {
    setDeliveriesLoading(true)
    try {
      setDeliveries(await getExpectedDeliveries())
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Не удалось загрузить ожидаемые поставки.')
    } finally {
      setDeliveriesLoading(false)
    }
  }
  async function reloadSpecifications() {
    setSpecificationsLoading(true)
    try {
      setSpecifications(await getSpecifications())
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Не удалось загрузить спецификации.')
    } finally {
      setSpecificationsLoading(false)
    }
  }
  function openForm(editing: boolean, component = selected) {
    setActionError('')
    setNotice('')
    setModal({
      editing,
      id: editing && component ? component.id : '',
      initial: component ? { ...component, cnt: editing ? component.cnt : '1' } : emptyForm(type || undefined),
    })
  }

  async function mutate(operation: Operation, form: FormData, id = '') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const result = await saveComponent(operation, form, id)
      setModal(null)
      setNotice(result === 'Match' ? 'Совпадающие позиции объединены. Количество суммировано.' : operation === 'Remove' ? 'Позиция удалена.' : operation === 'Add' ? 'Позиция добавлена.' : 'Изменения сохранены.')
      if (operation !== 'Edit' || result === 'Match') setSelectedIds([])
      await reload()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Не удалось сохранить изменения.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function showConfirmedDelivery(result: { created: number; merged: number }) {
    setType('')
    setSearch('')
    setFilters({})
    setSort({ key: 'changed', ascending: false })
    setPage(1)
    setSelectedIds([])
    setDeliveriesOpen(false)
    await reload()
    setNotice(`Поставка подтверждена: новых позиций — ${result.created}, объединено — ${result.merged}. Последние изменения показаны сверху.`)
  }

  async function remove() {
    if (selectedComponents.length === 0) return
    const confirmation = selectedComponents.length === 1
      ? `Удалить позицию №${selectedComponents[0].id} «${selectedComponents[0].name || selectedComponents[0].group}»?`
      : `Удалить выбранные позиции (${selectedComponents.length})?`
    if (!window.confirm(confirmation) || inFlight.current) return

    inFlight.current = true
    setBusy(true)
    setActionError('')
    setNotice('')
    const failedIds: string[] = []
    try {
      for (const component of selectedComponents) {
        try {
          await saveComponent('Remove', component, component.id)
        } catch {
          failedIds.push(component.id)
        }
      }
      setSelectedIds(failedIds)
      await reload()
      const deletedCount = selectedComponents.length - failedIds.length
      if (deletedCount > 0) setNotice(deletedCount === 1 ? 'Позиция удалена.' : `Удалено позиций: ${deletedCount}.`)
      if (failedIds.length > 0) setActionError(`Не удалось удалить позиций: ${failedIds.length}. Обновите таблицу и повторите попытку.`)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function writeOff() {
    if (selected) void mutate('Edit', { ...selected, cnt: String(Math.max(0, Number(selected.cnt) - Number(subtract))) }, selected.id)
  }

  function resetFilters() { setType(''); setSearch(''); setFilters({}) }

  return <main className="app-main">
    <div className="page-heading">
      <div><h1>Учет компонентов</h1></div>
      <div className="page-actions">
        <button className="btn btn-outline-primary deliveries-button" onClick={() => { setSpecificationsOpen(true); void reloadSpecifications() }}>
          Спецификации <span>{specifications.length}</span>
        </button>
        <button className="btn btn-outline-primary deliveries-button" onClick={() => { setDeliveriesOpen(true); void reloadDeliveries() }}>
          Ожидаемые поставки <span>{deliveries.length}</span>
        </button>
      </div>
    </div>

    <section className="summary-grid" aria-label="Статистика склада">
      <div className="summary-card"><span>Всего позиций</span><strong>{components.length.toLocaleString('ru')}</strong><small>в базе компонентов</small></div>
      <div className="summary-card"><span>Общий остаток</span><strong>{totalQuantity.toLocaleString('ru')} <small>шт.</small></strong><small>по всем позициям</small></div>
      <div className="summary-card"><span>Найдено позиций</span><strong>{filtered.length.toLocaleString('ru')}</strong><small>{hasFilters ? 'с учетом фильтров' : 'все компоненты'}</small></div>
    </section>

    {error && <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert"><span>{error}</span><button className="btn btn-sm btn-outline-danger" disabled={loading} onClick={() => void reload()}>Повторить</button></div>}
    {actionError && !modal && <div className="alert alert-danger" role="alert">{actionError}</div>}
    {notice && <div className="alert alert-success d-flex justify-content-between gap-3" role="status">{notice}<button className="btn-close" aria-label="Скрыть сообщение" onClick={() => setNotice('')} /></div>}

    <section className="inventory-panel" aria-label="Каталог компонентов">
      <div className="inventory-heading"><h2>Каталог компонентов</h2><span className="inventory-count">{filtered.length}</span><button className="btn btn-sm btn-outline-secondary refresh-button" onClick={() => void reload()} disabled={busy || loading}>{loading ? 'Загрузка…' : 'Обновить'}</button></div>
      <div className="filter-bar">
        <label className="type-filter"><span>Классификация</span><select className="form-select" value={type} onChange={event => setType(event.target.value)}><option value="">Все компоненты</option>{types.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="search-filter"><span>Поиск по всем полям</span><input className="form-control" type="search" placeholder="Наименование, номинал, корпус, ячейка…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <button className="btn btn-outline-secondary" disabled={!hasFilters} onClick={resetFilters}>Сбросить фильтры</button>
      </div>
      <div className="selection-toolbar">
        <span className="selection-status">{selectedComponents.length === 0 ? 'Выберите позиции в таблице' : selected ? <>Позиция <strong>№{selected.id}</strong><span className="selection-quantity">Остаток: <strong>{selected.cnt} шт.</strong></span></> : <>Выбрано позиций: <strong>{selectedComponents.length}</strong></>}</span>
        <div className="selection-actions">
          <button className="btn btn-sm btn-primary add-button" disabled={disabled} onClick={() => openForm(false)}><span aria-hidden="true">＋</span> Добавить позицию</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={!selected || disabled} onClick={() => openForm(true)}>Редактировать</button>
          <button className="btn btn-sm btn-outline-danger" disabled={selectedComponents.length === 0 || disabled} onClick={() => void remove()}>Удалить</button>
          <button className="btn btn-sm btn-outline-primary" disabled={selectedComponents.length === 0 || disabled} onClick={() => { setSpecificationsOpen(true); void reloadSpecifications() }}>В спецификацию</button>
          <div className="write-off-controls">
            <select className="form-select form-select-sm" aria-label="Количество для списания" value={subtract} disabled={!selected || disabled} onChange={event => setSubtract(event.target.value)}>{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <option key={value}>{value}</option>)}</select><span>шт.</span>
            <button className="btn btn-sm btn-outline-secondary" disabled={!selected || disabled || Number(selected.cnt) === 0} onClick={writeOff}>Списать</button>
          </div>
        </div>
      </div>

      <ComponentTable rows={rows} highlight={highlight} selectedIds={selectedIdSet} onSelect={id => setSelectedIds(current => current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id])} onEdit={item => openForm(true, item)} filters={filters} onFilter={(key, value) => setFilters(current => ({ ...current, [key]: value }))} sort={sort} onSort={key => setSort(current => ({ key, ascending: current.key === key ? !current.ascending : true }))} loading={loading} disabled={disabled} />

      <div className="table-footer">
        <span role="status">{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} из ${filtered.length}` : 'Нет записей'}</span>
        <label className="page-size">На странице<select className="form-select form-select-sm" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label>
        <nav className="pagination-controls" aria-label="Страницы таблицы">
          <button className="btn btn-sm btn-outline-secondary" aria-label="Первая страница" disabled={currentPage === 1} onClick={() => { setPage(1); setSelectedIds([]) }}>«</button>
          <button className="btn btn-sm btn-outline-secondary" aria-label="Предыдущая страница" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedIds([]) }}>‹</button>
          <span>{currentPage} / {pages}</span>
          <button className="btn btn-sm btn-outline-secondary" aria-label="Следующая страница" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); setSelectedIds([]) }}>›</button>
          <button className="btn btn-sm btn-outline-secondary" aria-label="Последняя страница" disabled={currentPage === pages} onClick={() => { setPage(pages); setSelectedIds([]) }}>»</button>
        </nav>
      </div>
    </section>
    <p className="table-hint">Двойной щелчок по строке — редактирование. «Добавить позицию» при выбранной строке — добавление по образцу.</p>
    {modal && <ComponentForm initial={modal.initial} editing={modal.editing} busy={busy} error={actionError} onClose={() => { setModal(null); setActionError('') }} onSubmit={form => mutate(modal.editing ? 'Edit' : 'Add', form, modal.id)} />}
    {deliveriesOpen && <ExpectedDeliveries deliveries={deliveries} loading={deliveriesLoading} onClose={() => setDeliveriesOpen(false)} onReload={reloadDeliveries} onConfirmed={showConfirmedDelivery} onNotice={setNotice} />}
    {specificationsOpen && <Specifications specifications={specifications} components={components} selectedComponents={selectedComponents} loading={specificationsLoading} onClose={() => setSpecificationsOpen(false)} onReload={reloadSpecifications} onStockReload={reload} onDeliveryCreated={reloadDeliveries} onNotice={setNotice} onSelectionClear={() => setSelectedIds([])} />}
  </main>
}
