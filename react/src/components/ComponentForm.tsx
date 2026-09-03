import { FormEvent, useEffect, useRef, useState } from 'react'
import { ComponentForm as FormData, componentTypes, units } from '../ts/types'

interface Props {
  initial: FormData
  editing: boolean
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
}

const fields: { key: keyof FormData; title: string; type?: string }[] = [
  { key: 'name', title: 'Наименование' },
  { key: 'cnt', title: 'Количество', type: 'number' },
  { key: 'manufacturer', title: 'Производитель' },
  { key: 'cellnum', title: 'Номер ячейки' },
  { key: 'value', title: 'Значение' },
  { key: 'tol', title: 'Точность' },
  { key: 'case', title: 'Корпус' },
]

export default function ComponentForm({ initial, editing, busy, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(initial)
  const dialog = useRef<HTMLDialogElement>(null)
  const choices = Array.from(new Set([...componentTypes, form.group]))
  const unitChoices = Array.from(new Set(['', ...(units[form.group] || []), form.unit]))

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

  const update = (key: keyof FormData, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!busy) void onSubmit(form)
  }

  return <dialog ref={dialog} className="component-dialog" aria-labelledby="form-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={submit}>
      <div className="dialog-heading">
        <div><p className="eyebrow">КАРТОЧКА КОМПОНЕНТА</p><h2 id="form-title">{editing ? 'Редактирование позиции' : 'Добавление позиции'}</h2></div>
        <button type="button" className="btn-close" aria-label="Закрыть" disabled={busy} onClick={onClose} />
      </div>
      <div className="dialog-body">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <fieldset disabled={busy}>
          <div className="row g-3">
            <div className="col-12">
              <label htmlFor="component-group" className="form-label">Тип компонента</label>
              <select id="component-group" className="form-select" autoFocus value={form.group} onChange={event => setForm(current => ({ ...current, group: event.target.value, unit: units[event.target.value]?.[0] || '' }))}>
                {choices.map(type => <option key={type}>{type}</option>)}
              </select>
            </div>
            {fields.map(field => <div className="col-sm-6" key={field.key}>
              <label className="form-label" htmlFor={`component-${field.key}`}>{field.title}</label>
              <input id={`component-${field.key}`} className="form-control" type={field.type || 'text'} value={form[field.key]} maxLength={field.type === 'number' ? undefined : 255}
                min={field.type === 'number' ? 0 : undefined} max={field.type === 'number' ? Number.MAX_SAFE_INTEGER : undefined} step={field.type === 'number' ? 1 : undefined}
                required={field.key === 'cnt'} onChange={event => update(field.key, event.target.value)} />
            </div>)}
            <div className="col-sm-6">
              <label className="form-label" htmlFor="component-unit">Единицы измерения</label>
              <select id="component-unit" className="form-select" value={form.unit} onChange={event => update('unit', event.target.value)}>
                {unitChoices.map(unit => <option key={unit} value={unit}>{unit || 'Не указаны'}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="component-description">Описание</label>
              <textarea id="component-description" className="form-control" rows={3} maxLength={255} value={form.description} onChange={event => update('description', event.target.value)} />
            </div>
          </div>
        </fieldset>
        <p className="form-note">При совпадении характеристик позиции объединяются, их количество суммируется.</p>
      </div>
      <div className="dialog-footer">
        <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Отмена</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Сохранение…' : editing ? 'Сохранить изменения' : 'Добавить позицию'}</button>
      </div>
    </form>
  </dialog>
}
