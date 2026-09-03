import MainContainer from '../containers/MainContainer'
import SwitchTheme from '../components/SwitchTheme'

export default function App() {
  return <>
    <header className="app-header">
      <a className="brand" href="/" aria-label="ComponentDB — главная">
        <span className="brand-icon" aria-hidden="true">▦</span>
        <span>Component<span className="brand-accent">DB</span></span>
      </a>
      <span className="header-caption">Электронные компоненты</span>
      <SwitchTheme />
    </header>
    <MainContainer />
    <footer className="app-footer">ComponentDB <span>Учет и хранение электронных компонентов</span></footer>
  </>
}
