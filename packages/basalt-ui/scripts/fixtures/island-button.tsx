// The smallest island `check-budgets/provider-v3.ts` measures: one React root, a `BasaltProvider`
// with no router (locale only, no `link`), and one `Button`, imported from source. What an Astro
// island that mounts its own root pays over `base0`. Bundled with its peers.
import { createRoot } from 'react-dom/client'

import { BasaltProvider } from '../../src/core/provider'
import { Button } from '../../src/ui/button'

const root = document.getElementById('root')
if (root !== null) {
  createRoot(root).render(
    <BasaltProvider locale="de-DE">
      <Button>Vote</Button>
    </BasaltProvider>,
  )
}
