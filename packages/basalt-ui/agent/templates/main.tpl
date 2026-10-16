/**
 * The 2.0 entry (V2-SPEC § 2). `defineNav` rejects every call until the `Register` augmentation below
 * exists, so `src/lib/nav.tsx` fails `tsc` without this file. `basalt-ui/styles.css` already pulls in
 * the Mantine layers; do not import them separately.
 *
 * Scaffold written by `basalt-ui init`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import 'basalt-ui/styles.css'
import { createRoot } from 'react-dom/client'
import { BasaltProvider, createBasaltRouter } from 'basalt-ui'
import { routeTree } from './routeTree.gen'

// Telemetry: `<BasaltProvider telemetry={sink} />`; the `BasaltEvent` JSDoc has the OTel span mapping.
const router = createBasaltRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(<BasaltProvider router={router} />)
