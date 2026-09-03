export interface ComponentForm {
  group: string
  name: string
  value: string
  unit: string
  tol: string
  description: string
  case: string
  manufacturer: string
  cnt: string
  cellnum: string
}

export interface Component extends ComponentForm {
  id: string
  changed: string
}

export type Operation = 'Add' | 'Edit' | 'Remove'
export type ColumnKey = keyof Component
export type ColumnFilters = Partial<Record<ColumnKey, string>>

export const columns: { key: ColumnKey; title: string; numeric?: boolean }[] = [
  { key: 'id', title: 'ID', numeric: true },
  { key: 'group', title: 'Классификация' },
  { key: 'name', title: 'Наименование' },
  { key: 'value', title: 'Значение', numeric: true },
  { key: 'unit', title: 'Ед. изм.' },
  { key: 'tol', title: 'Точность' },
  { key: 'description', title: 'Описание' },
  { key: 'case', title: 'Корпус' },
  { key: 'manufacturer', title: 'Производитель' },
  { key: 'cnt', title: 'Количество', numeric: true },
  { key: 'cellnum', title: 'Ячейка' },
  { key: 'changed', title: 'Дата изменения' },
]

export const componentTypes = [
  'Конденсатор', 'Резистор', 'Катушка индуктивности', 'Транзистор',
  'Микросхема', 'Модуль', 'Разъем', 'Варистор', 'Диод', 'Светодиод',
  'Стабилитрон', 'Переключатель', 'Кварцевый резонатор', 'Трансформатор',
  'Фотоэлемент', 'Тиристор', 'Блок питания', 'Прочее',
]

export const units: Record<string, string[]> = {
  Конденсатор: ['пФ', 'мкФ'],
  Резистор: ['Ом', 'кОм', 'МОм'],
  'Катушка индуктивности': ['мкГн', 'Гн'],
}

export function emptyForm(group = 'Конденсатор'): ComponentForm {
  return {
    group, name: '', value: '', unit: units[group]?.[0] || '', tol: '',
    description: '', case: '', manufacturer: '', cnt: '1', cellnum: '',
  }
}
