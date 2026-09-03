import { createRoot } from 'react-dom/client'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../scss/styles.scss'

const container = document.getElementById('app')
if (container) createRoot(container).render(<App />)
