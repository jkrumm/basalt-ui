import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import '@mantine/spotlight/styles.layer.css'
import 'basalt-ui/styles.css'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import { BasaltOverlays } from 'basalt-ui/commands'
import { applyOverrides, loadOverrides } from 'basalt-ui/theme-lab'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Side-effect import: registers the app's global command registry (basalt-ui/commands'
// defineCommands) before BasaltOverlays mounts, so Spotlight/ShortcutsHelp see it from boot.
import './demo/commands'
import { demoPaletteGroups } from './demo/series'
import { routeTree } from './routeTree.gen'

// ── SSR / Next.js manual-provider path (reference) ───────────────────────────
//
// Consumers who cannot use BasaltProvider directly (e.g. Next.js App Router where the
// provider must be in a Server Component boundary, or apps that already own their
// MantineProvider) can compose the three pieces manually:
//
//   import { MantineProvider } from '@mantine/core'
//   import { baseTheme, cssVariablesResolver, createBasaltTheme } from 'basalt-ui'
//
//   // Option A — use baseTheme as-is (zero overrides):
//   <MantineProvider theme={baseTheme} cssVariablesResolver={cssVariablesResolver}>
//     {children}
//   </MantineProvider>
//
//   // Option B — merge consumer overrides on top (createBasaltTheme is mergeThemeOverrides):
//   const theme = createBasaltTheme({ primaryColor: 'teal' })
//   <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
//     {children}
//   </MantineProvider>
//
// NOTE: This path skips BasaltProvider's error boundary, palette injection, and the Vx
// chart theme context. Add those pieces manually if needed:
//   - Palette:      emit buildPaletteCss() as a <style> tag in your document <head>.
//   - Chart bridge: wrap children in <VxThemeProvider colorScheme={resolved}>.
//   - Error boundary: wrap with <BasaltErrorBoundary onError={…}>.
//
// ─────────────────────────────────────────────────────────────────────────────

// The theme lab owns only the editing UI — the host re-applies any persisted overrides at boot, so
// a tuning session survives a refresh (per the theme-lab contract).
applyOverrides(loadOverrides())

// createBasaltTheme exercises the export. A consumer can build a full MantineThemeOverride
// and pass it to BasaltProvider.theme — the provider merges it onto the base internally.
// Extracting it here (rather than inlining) proves the named export resolves at build time.
const playgroundTheme = createBasaltTheme()

// Browser-history router built from the generated route tree. Registering its type below makes
// every <Link>/useNavigate across the app type-safe against the real route set.
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('root element not found')

createRoot(root).render(
  <StrictMode>
    {/* paletteOptions.groups emits the consumer's `--vx-demo-*` custom properties alongside the
        framework primitives, so the app-side series colors resolve per scheme just like the chrome. */}
    {/* theme={playgroundTheme}: exercises createBasaltTheme — the result is a valid MantineThemeOverride.
        BasaltProvider merges it with mergeThemeOverrides(base, overrides), so no-override call is safe. */}
    <BasaltProvider
      theme={playgroundTheme}
      paletteOptions={{ groups: demoPaletteGroups }}
      // oxlint-disable-next-line no-console
      onError={(error, ctx) => console.error('[basalt]', ctx, error)}
    >
      {/* hotkeys={false}: the demo commands are registered page-locally in CommandsDemoPage, which
          binds them itself via useCommandHotkeys(). A real app registers commands app-wide and keeps
          the default (hotkeys enabled) so BasaltOverlays binds them globally. */}
      <BasaltOverlays hotkeys={false}>
        <RouterProvider router={router} />
      </BasaltOverlays>
    </BasaltProvider>
  </StrictMode>,
)
