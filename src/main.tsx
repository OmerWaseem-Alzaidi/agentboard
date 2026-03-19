import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After deploy, DevTools → Sources: main chunk should NOT stay `index-BYO1oV6C.js` forever (stale CDN/deploy).
console.info(`[AgentBoard] v${__APP_VERSION__}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
