import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
// Side-effect import, and it has to come before the first render: i18next is
// initialised synchronously from inline bundles so `t()` resolves on the very
// first frame rather than painting keys (§6.1).
import './i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// registerType is 'autoUpdate', so a new SW takes over on the next load without
// prompting. No-op in dev; the virtual module is provided by vite-plugin-pwa.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
