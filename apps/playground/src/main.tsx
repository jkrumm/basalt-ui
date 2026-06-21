import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/spotlight/styles.css'
import 'basalt-ui/styles.css'
import { BasaltProvider } from 'basalt-ui'
import { BasaltOverlays } from 'basalt-ui/commands'
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
      {/* hotkeys={false}: the demo commands are registered page-locally in CommandsDemoPage, which
          binds them itself via useCommandHotkeys(). A real app registers commands app-wide and keeps
          the default (hotkeys enabled) so BasaltOverlays binds them globally. */}
      <BasaltOverlays hotkeys={false}>
        <App />
      </BasaltOverlays>
    </BasaltProvider>
  </StrictMode>,
)
