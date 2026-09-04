import { appPath } from '../ts/urls'

export type Session = { username: string | null; csrfToken: string }

let csrfToken = ''

export function csrfHeaders() {
  return { 'X-CSRF-Token': csrfToken }
}

export async function getSession(): Promise<Session> {
  const response = await fetch(appPath('/auth/session'), { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error('Не удалось проверить сессию. Попробуйте еще раз.')
  const session: Session = await response.json()
  csrfToken = session.csrfToken
  return session
}

async function authRequest(path: string, body?: { username: string; password: string }) {
  const response = await fetch(appPath(path), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { throw new Error('Не удалось связаться с сервером. Проверьте соединение и попробуйте еще раз.') })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error || 'Не удалось выполнить запрос. Попробуйте еще раз.')
  }
}

export const login = (username: string, password: string) => authRequest('/login', { username, password })
export const logout = () => authRequest('/logout')
