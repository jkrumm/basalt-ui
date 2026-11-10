// The v3 provider-only app `check-budgets/provider-v3.ts` measures: React `createRoot` plus the
// skeleton, imported from source (the root `.` still serves the 2.x provider). Bundled with its peers.
import { createRoot } from 'react-dom/client'

import { BasaltProvider } from '../../src/core/provider'

const root = document.getElementById('root')
if (root !== null) {
  createRoot(root).render(
    <BasaltProvider locale="de-DE" scheme="dark">
      <div />
    </BasaltProvider>,
  )
}
