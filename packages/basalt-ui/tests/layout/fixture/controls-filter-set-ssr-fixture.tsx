/**
 * The SSR entry of the `controls-filter-set` fixture: it hydrates the markup the test rendered on
 * the server and records every recoverable error and console error, so the test can say "zero".
 */
import { hydrateRoot } from 'react-dom/client'
import { Probe } from './controls-filter-set-probe'

type Seen = { recoverable: string[]; errors: string[] }
const seen: Seen = { recoverable: [], errors: [] }
;(window as unknown as { basaltHydration: Seen }).basaltHydration = seen

const original = console.error
console.error = (...args: unknown[]) => {
  seen.errors.push(args.map(String).join(' '))
  original(...args)
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
document.body.classList.add('bg-background')
hydrateRoot(container, <Probe />, {
  onRecoverableError: (error) => {
    seen.recoverable.push(String(error))
  },
})
