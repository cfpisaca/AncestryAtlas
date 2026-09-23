import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// HashRouter, not BrowserRouter: GitHub Pages serves static files with no
// server-side rewrite rules, so a direct load or refresh on /quiz would 404
// with path-based routing. Hash-based routes (/#/quiz) never hit the server
// for the route itself.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
