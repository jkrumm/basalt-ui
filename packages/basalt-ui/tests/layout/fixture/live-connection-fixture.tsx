/**
 * The `live-connection` fixture (live-realtime 7, P4 layout half): `ConnectionIndicator` in every
 * state beside a `RefreshButton` of each scope, no shell and no provider. The entry the
 * `live-connection` layout test bundles; the harness "mounts" it with a no-op.
 *
 * Probes, each carrying a `data-testid` on a wrapper: `lc-<state>` for the five indicator states,
 * `lc-open` (an indicator with stream and data ages, the popover under test), `lc-refresh-page`
 * and `lc-refresh-global` (a data time five minutes old).
 */
import { createRoot } from 'react-dom/client'
import type { ConnectionView } from '../../../src/core/ports'
import { IntlScope } from '../../../src/core/provider-props'
import { ConnectionIndicator } from '../../../src/page/connection-indicator'
import { RefreshButton } from '../../../src/page/refresh-button'

const base: ConnectionView = { state: 'polling', stream: 'none', online: true, reachable: true }

const STATES: readonly (readonly [string, ConnectionView])[] = [
  ['live', { ...base, state: 'live', stream: 'live' }],
  ['polling', base],
  ['reconnecting', { ...base, stream: 'retrying' }],
  ['offline', { ...base, state: 'offline', reachable: false }],
  ['unauthorized', { ...base, stream: 'unauthorized' }],
]

const NOW = Date.now()
const OPEN: ConnectionView = {
  ...base,
  state: 'live',
  stream: 'live',
  lastFrameAt: NOW - 2 * 60_000,
  lastUpdatedAt: NOW - 5 * 60_000,
}

function Fixture() {
  return (
    <IntlScope locale="en-US">
      <main className="flex flex-col gap-6 p-4 text-foreground">
        <h1 className="text-lg font-medium">Connection</h1>
        <section aria-label="States" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {STATES.map(([name, connection]) => (
            <span key={name} data-testid={`lc-${name}`}>
              <ConnectionIndicator connection={connection} />
            </span>
          ))}
        </section>
        <section aria-label="Bar" className="flex items-center justify-end gap-2">
          <span data-testid="lc-open">
            <ConnectionIndicator connection={OPEN} />
          </span>
          <span data-testid="lc-refresh-page" className="inline-flex items-center">
            <RefreshButton
              scope="page"
              syncing={false}
              lastCompletedAt={NOW - 5 * 60_000}
              onSync={() => {}}
            />
          </span>
          <span data-testid="lc-refresh-global" className="inline-flex items-center">
            <RefreshButton
              scope="global"
              syncing={false}
              lastCompletedAt={NOW - 5 * 60_000}
              onSync={() => {}}
            />
          </span>
        </section>
      </main>
    </IntlScope>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
