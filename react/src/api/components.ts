import { columns, Component, ComponentForm, Operation } from '../ts/types'

async function checkResponse(response: Response) {
  if (response.ok) return
  if (response.status === 401) throw new Error('Требуется авторизация. Обновите страницу и введите логин и пароль.')
  let message = 'Не удалось выполнить запрос. Проверьте соединение с сервером и повторите попытку.'
  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = await response.json()
    if (typeof body.error === 'string') message = body.error
  }
  throw new Error(message)
}

export async function getComponents(signal?: AbortSignal): Promise<Component[]> {
  const response = await fetch('/get_data?filter=', { credentials: 'same-origin', cache: 'no-store', signal })
  await checkResponse(response)
  const result = await response.json()
  if (!Array.isArray(result.data)) throw new Error('Сервер вернул некорректные данные.')
  return result.data.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== columns.length) throw new Error('Сервер вернул некорректную строку таблицы.')
    return Object.fromEntries(columns.map(({ key }, index) => [key, String(row[index] ?? '')])) as unknown as Component
  })
}

export async function saveComponent(operation: Operation, form: ComponentForm, id = '') {
  const response = await fetch('/request_handler', {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams({ ...form, id, reqtype: operation }),
  })
  await checkResponse(response)
  const result = (await response.text()).trim()
  if (result !== 'True' && result !== 'Match' && !(operation === 'Edit' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result))) {
    throw new Error('Изменения не сохранены. Возможно, позиция уже удалена. Обновите таблицу и повторите попытку.')
  }
  return result
}
