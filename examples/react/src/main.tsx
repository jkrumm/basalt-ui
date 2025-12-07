import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'

import App from './App.tsx'

// biome-ignore lint/style/noNonNullAssertion: Validated to be non-null
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
