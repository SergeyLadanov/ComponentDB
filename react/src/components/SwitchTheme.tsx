import { useEffect, useState } from 'react'

export default function SwitchTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('componentdb-theme') || 'auto' } catch { return 'auto' }
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.bsTheme = theme === 'auto' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    try { localStorage.setItem('componentdb-theme', theme) } catch { /* Storage can be disabled. */ }
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return <label className="theme-picker">
    <span>Тема</span>
    <select className="form-select form-select-sm" aria-label="Тема оформления" value={theme} onChange={event => setTheme(event.target.value)}>
      <option value="auto">Системная</option>
      <option value="light">Светлая</option>
      <option value="dark">Темная</option>
    </select>
  </label>
}
