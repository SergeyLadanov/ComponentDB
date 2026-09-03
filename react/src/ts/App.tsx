import { useEffect, useRef, useState } from 'react'
import { getSession, logout, Session } from '../api/auth'
import MainContainer from '../containers/MainContainer'
import LoginPage from '../components/LoginPage'
import SwitchTheme from '../components/SwitchTheme'

export default function App() {
  const loginPage = window.location.pathname === '/login'
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const logoutInFlight = useRef(false)

  async function loadSession() {
    setError('')
    try {
      const current = await getSession()
      if (!current.username && !loginPage) { window.location.replace('/login'); return }
      if (current.username && loginPage) { window.location.replace('/'); return }
      setSession(current)
    } catch {
      setError('Не удалось связаться с сервером. Проверьте соединение и попробуйте еще раз.')
    }
  }

  useEffect(() => {
    document.title = loginPage ? 'Вход — ComponentDB' : 'ComponentDB — учет компонентов'
    void loadSession()
    // Recheck sessions when a browser restores a page after logout.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload() }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function signOut() {
    if (logoutInFlight.current) return
    logoutInFlight.current = true
    setLeaving(true)
    setError('')
    try {
      await logout()
      window.location.replace('/login')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выйти. Попробуйте еще раз.')
      logoutInFlight.current = false
      setLeaving(false)
    }
  }

  return <>
    <header className="app-header">
      <a className="brand" href="/" aria-label="ComponentDB — главная">
        <span className="brand-icon" aria-hidden="true">▦</span>
        <span>Component<span className="brand-accent">DB</span></span>
      </a>
      <span className="header-caption">Электронные компоненты</span>
      <SwitchTheme />
      {session?.username && <div className="header-account">
        <span className="account-name" title={session.username}>{session.username}</span>
        <button className="btn btn-outline-light btn-sm" type="button" disabled={leaving} onClick={() => void signOut()}>{leaving ? 'Выходим…' : 'Выйти'}</button>
      </div>}
    </header>
    {error && <div className="session-error alert alert-danger" role="alert">
      {error}
      {!session && <button className="btn btn-outline-danger btn-sm ms-3" onClick={() => void loadSession()}>Повторить</button>}
    </div>}
    {session ? (loginPage ? <LoginPage /> : <MainContainer />) : !error && <main className="first-loading" role="status">Загрузка…</main>}
    <footer className="app-footer">ComponentDB <span>Учет и хранение электронных компонентов</span></footer>
  </>
}
