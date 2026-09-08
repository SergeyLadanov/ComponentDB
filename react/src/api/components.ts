import { columns, Component, ComponentForm, ExpectedDelivery, Operation, Specification, SpecificationItemForm } from '../ts/types'
import { appPath } from '../ts/urls'
import { csrfHeaders } from './auth'

async function checkResponse(response: Response) {
  if (response.ok) return
  if (response.status === 401) {
    window.location.replace(appPath('/login'))
    throw new Error('Сессия завершена. Войдите снова.')
  }
  let message = 'Не удалось выполнить запрос. Проверьте соединение с сервером и повторите попытку.'
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = await response.json()
    if (typeof body.error === 'string') message = body.error
  }
  throw new Error(message)
}

export async function getComponents(signal?: AbortSignal): Promise<Component[]> {
  const response = await fetch(appPath('/get_data?filter='), { credentials: 'same-origin', cache: 'no-store', signal })
  await checkResponse(response)
  const result = await response.json()
  if (!Array.isArray(result.data)) throw new Error('Сервер вернул некорректные данные.')
  return result.data.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== columns.length) throw new Error('Сервер вернул некорректную строку таблицы.')
    return Object.fromEntries(columns.map(({ key }, index) => [key, String(row[index] ?? '')])) as unknown as Component
  })
}

export async function saveComponent(operation: Operation, form: ComponentForm, id = '') {
  const response = await fetch(appPath('/request_handler'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
    body: new URLSearchParams({ ...form, id, reqtype: operation }),
  })
  await checkResponse(response)
  const result = (await response.text()).trim()
  if (result !== 'True' && result !== 'Match' && !(operation === 'Edit' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result))) {
    throw new Error('Изменения не сохранены. Возможно, позиция уже удалена. Обновите таблицу и повторите попытку.')
  }
  return result
}


export async function getExpectedDeliveries(signal?: AbortSignal): Promise<ExpectedDelivery[]> {
  const response = await fetch(appPath('/deliveries'), {
    credentials: 'same-origin', cache: 'no-store', signal,
  })
  await checkResponse(response)
  const result = await response.json()
  if (!Array.isArray(result.data)) throw new Error('Сервер вернул некорректный список поставок.')
  return result.data as ExpectedDelivery[]
}


export async function importExpectedDelivery(file: File, name: string) {
  const body = new FormData()
  body.append('file', file)
  if (name.trim()) body.append('name', name.trim())
  const response = await fetch(appPath('/deliveries/import'), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(), body,
  })
  await checkResponse(response)
  return response.json() as Promise<{ id: string; items: number }>
}


export async function updateExpectedDeliveryItem(deliveryId: string, itemId: string, form: ComponentForm) {
  const response = await fetch(appPath(`/deliveries/${deliveryId}/items/${itemId}`), {
    method: 'PUT', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  })
  await checkResponse(response)
}


export async function updateExpectedDeliveryItems(deliveryId: string, items: Array<ComponentForm & { id: string }>) {
  const response = await fetch(appPath(`/deliveries/${deliveryId}/items`), {
    method: 'PUT', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  await checkResponse(response)
}


export async function deleteExpectedDeliveryItem(deliveryId: string, itemId: string) {
  const response = await fetch(appPath(`/deliveries/${deliveryId}/items/${itemId}`), {
    method: 'DELETE', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
}


export async function confirmExpectedDelivery(deliveryId: string) {
  const response = await fetch(appPath(`/deliveries/${deliveryId}/confirm`), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
  return response.json() as Promise<{ created: number; merged: number; items: number }>
}


export async function cancelExpectedDelivery(deliveryId: string) {
  const response = await fetch(appPath(`/deliveries/${deliveryId}/cancel`), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
}


export async function getSpecifications(signal?: AbortSignal): Promise<Specification[]> {
  const response = await fetch(appPath('/specifications'), {
    credentials: 'same-origin', cache: 'no-store', signal,
  })
  await checkResponse(response)
  const result = await response.json()
  if (!Array.isArray(result.data)) throw new Error('Сервер вернул некорректный список спецификаций.')
  return result.data as Specification[]
}


export async function createSpecification(name: string, deviceQuantity: string) {
  const response = await fetch(appPath('/specifications'), {
    method: 'POST', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, deviceQuantity }),
  })
  await checkResponse(response)
  return response.json() as Promise<{ id: string }>
}


export async function importSpecification(file: File, name: string, deviceQuantity: string) {
  const body = new FormData()
  body.append('file', file)
  body.append('name', name)
  body.append('deviceQuantity', deviceQuantity)
  const response = await fetch(appPath('/specifications/import'), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(), body,
  })
  await checkResponse(response)
  return response.json() as Promise<{ id: string; items: number }>
}


export async function updateSpecification(id: string, name: string, deviceQuantity: string) {
  const response = await fetch(appPath(`/specifications/${id}`), {
    method: 'PUT', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, deviceQuantity }),
  })
  await checkResponse(response)
}


export async function deleteSpecification(id: string) {
  const response = await fetch(appPath(`/specifications/${id}`), {
    method: 'DELETE', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
}


export async function addSpecificationItem(specificationId: string, item: SpecificationItemForm) {
  const response = await fetch(appPath(`/specifications/${specificationId}/items`), {
    method: 'POST', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(item),
  })
  await checkResponse(response)
  return response.json() as Promise<{ id: string }>
}


export async function addSelectedSpecificationItems(specificationId: string, componentIds: string[]) {
  const response = await fetch(appPath(`/specifications/${specificationId}/selected-items`), {
    method: 'POST', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ componentIds }),
  })
  await checkResponse(response)
  return response.json() as Promise<{ added: number; incremented: number; missing: string[] }>
}


export interface SpecificationWriteOffResult {
  writtenOffPositions: number
  writtenOffQuantity: string
  unmatched: Array<{ itemId: string; name: string; requiredQuantity: string }>
  insufficient: Array<{ componentId: string; name: string; requiredQuantity: string; stockQuantity: string }>
}

export async function writeOffSpecification(specificationId: string) {
  const response = await fetch(appPath(`/specifications/${specificationId}/write-off`), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
  return response.json() as Promise<SpecificationWriteOffResult>
}


export async function updateSpecificationItem(specificationId: string, itemId: string, item: SpecificationItemForm) {
  const response = await fetch(appPath(`/specifications/${specificationId}/items/${itemId}`), {
    method: 'PUT', credentials: 'same-origin',
    headers: { ...csrfHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(item),
  })
  await checkResponse(response)
}


export async function deleteSpecificationItem(specificationId: string, itemId: string) {
  const response = await fetch(appPath(`/specifications/${specificationId}/items/${itemId}`), {
    method: 'DELETE', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
}


export async function createExpectedDeliveryFromSpecification(specificationId: string) {
  const response = await fetch(appPath(`/specifications/${specificationId}/delivery`), {
    method: 'POST', credentials: 'same-origin', headers: csrfHeaders(),
  })
  await checkResponse(response)
  return response.json() as Promise<{ id: string; items: number; name: string }>
}


export function specificationExportUrl(specificationId: string, scope: 'missing' | 'all') {
  return appPath(`/specifications/${specificationId}/export?scope=${scope}`)
}
