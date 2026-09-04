import { FormEvent, useRef, useState } from 'react'
import { login } from '../api/auth'
import { appPath } from '../ts/urls'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      window.location.replace(appPath('/'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти. Проверьте соединение и попробуйте еще раз.')
      inFlight.current = false
      setBusy(false)
    }
  }

  return <main className="auth-main">
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-icon" aria-hidden="true">▦</div>
      <p className="eyebrow">COMPONENTDB</p>
      <h1 id="login-title">Вход в систему</h1>
      <p className="auth-description">Войдите, чтобы работать с базой электронных компонентов.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <div className="auth-field">
          <label className="form-label" htmlFor="username">Логин</label>
          <input className="form-control" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required disabled={busy} value={username} onChange={event => setUsername(event.target.value)} />
        </div>
        <div className="auth-field">
          <label className="form-label" htmlFor="password">Пароль</label>
          <div className="auth-password">
            <input className="form-control" id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
            <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Скрыть' : 'Показать'}</button>
          </div>
        </div>
        {error && <div className="alert alert-danger auth-error" role="alert">{error}</div>}
        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
      <p className="auth-help">Нет доступа? Обратитесь к администратору.</p>
    </section>
  </main>
}
