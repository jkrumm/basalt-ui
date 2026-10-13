import '@mantine/core/styles.layer.css'
// `@mantine/dates` is basalt's one OPTIONAL peer: only `basalt-ui/controls-dates` needs it, and its
// layer bundle has to land with the other Mantine ones, before `basalt-ui/styles.css`.
import '@mantine/dates/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/spotlight/styles.layer.css'
import 'basalt-ui/styles.css'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Side-effect import: registers the app's command registry (`defineCommands`) and the nav
// definition (`defineNav`) before the provider mounts, so Spotlight and the hotkeys see them at boot.
import './demo/commands'
import './demo/nav-model'
import { demoPaletteGroups } from './demo/series'
import { routeTree } from './routeTree.gen'

const router = createBasaltRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Literal env checks, so a build without either flag drops the dynamic import and its chunk.
// `VITE_TELEMETRY=1` builds the telemetry in (exporter URL then comes from `window.__BASALT_OTLP__`
// at runtime); `VITE_OTLP_ENDPOINT` bakes the URL in. See docs/waves/evidence/w2/observability.md.
// A telemetry failure must never block mounting the app.
let telemetry: typeof import('./telemetry').telemetry | undefined
if (import.meta.env['VITE_TELEMETRY'] === '1' || import.meta.env['VITE_OTLP_ENDPOINT']) {
  try {
    telemetry = (await import('./telemetry')).telemetry
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error('[basalt] telemetry failed to start', error)
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    {/* paletteOptions.groups emits the consumer's `--vx-demo-*` custom properties alongside the
        framework primitives, so the app-side series colors resolve per scheme just like the chrome. */}
    <BasaltProvider
      router={router}
      paletteOptions={{ groups: demoPaletteGroups }}
      {...(telemetry && { telemetry })}
    />
  </StrictMode>,
)
