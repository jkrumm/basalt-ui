import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import 'basalt-ui/styles.css'
import { BasaltProvider } from 'basalt-ui'
import { BasaltNotifications } from 'basalt-ui/notifications'
import { applyOverrides, loadOverrides } from 'basalt-ui/theme-lab'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { demoPaletteGroups } from './demo/series'

// The theme lab owns only the editing UI — the host re-applies any persisted overrides at boot, so
// a tuning session survives a refresh (per the theme-lab contract).
applyOverrides(loadOverrides())

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    {/* paletteOptions.groups emits the consumer's `--vx-demo-*` custom properties alongside the
        framework primitives, so the app-side series colors resolve per scheme just like the chrome. */}
    <BasaltProvider paletteOptions={{ groups: demoPaletteGroups }}>
      <BasaltNotifications />
      <App />
    </BasaltProvider>
  </StrictMode>,
)
