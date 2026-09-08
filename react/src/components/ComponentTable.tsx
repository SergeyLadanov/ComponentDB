import { ColumnFilters, ColumnKey, columns, Component } from '../ts/types'
import { createSearchHighlighter } from '../ts/search'

interface Props {
  rows: Component[]
  highlight: ReturnType<typeof createSearchHighlighter>
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (component: Component) => void
  filters: ColumnFilters
  onFilter: (key: ColumnKey, value: string) => void
  sort: { key: ColumnKey; ascending: boolean }
  onSort: (key: ColumnKey) => void
  loading: boolean
  disabled: boolean
}

export default function ComponentTable({ rows, highlight, selectedId, onSelect, onEdit, filters, onFilter, sort, onSort, loading, disabled }: Props) {
  const renderValue = (component: Component, key: ColumnKey) => highlight(component, key, filters[key]).map((fragment, index) =>
    fragment.highlighted ? <mark className="search-match" key={index}>{fragment.text}</mark> : fragment.text)

  return <div className="table-scroll" aria-busy={loading}>
    <table className="table component-table mb-0">
      <caption className="visually-hidden">Список электронных компонентов. Выберите строку для изменения, добавления по образцу или списания.</caption>
      <thead>
        <tr>
          <th scope="col" className="select-column"><span className="visually-hidden">Выбрать</span></th>
          {columns.map(column => <th scope="col" key={column.key} aria-sort={sort.key === column.key ? (sort.ascending ? 'ascending' : 'descending') : 'none'}>
            <button className="column-sort" onClick={() => onSort(column.key)}>
              {column.title}<span aria-hidden="true">{sort.key === column.key ? (sort.ascending ? '↑' : '↓') : '↕'}</span>
            </button>
          </th>)}
        </tr>
        <tr className="column-filters">
          <td />
          {columns.map(column => <td key={column.key}>
            <input className="form-control form-control-sm" type="search" value={filters[column.key] || ''} placeholder="Поиск…" aria-label={`Поиск: ${column.title}`} onChange={event => onFilter(column.key, event.target.value)} />
          </td>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(component => <tr key={component.id} className={selectedId === component.id ? 'selected-row' : ''} onClick={() => { if (!disabled) onSelect(component.id) }} onDoubleClick={() => { if (!disabled) onEdit(component) }}>
          <td className="select-column"><input className="form-check-input" type="checkbox" checked={selectedId === component.id} disabled={disabled} aria-label={`Выбрать позицию ${component.id}`} onClick={event => event.stopPropagation()} onChange={() => onSelect(component.id)} /></td>
          {columns.map(column => <td key={column.key} className={`cell-${column.key}`}>
            {column.key === 'cnt' ? <span className={`quantity ${Number(component.cnt) === 0 ? 'quantity-empty' : ''}`}>{renderValue(component, column.key)}</span> : component[column.key] ? renderValue(component, column.key) : <span className="empty-value">—</span>}
          </td>)}
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="empty-state">
          {loading ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Загрузка компонентов…</> : <><strong>Компоненты не найдены</strong><span>Добавьте позицию или измените условия поиска.</span></>}
        </td></tr>}
      </tbody>
    </table>
  </div>
}
