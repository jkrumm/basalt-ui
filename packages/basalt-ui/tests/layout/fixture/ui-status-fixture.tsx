/**
 * The `ui-status` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 27-32): the
 * status, alert, progress and meter primitives on their own markup, no shell and no provider, the
 * page set to `de-DE` by an `IntlScope`. It is the entry the `ui-status` layout test bundles; the
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each carrying a `data-testid`:
 * - `ui-status-<tone>` and `ui-swatch-<n>`: a status per tone and three series swatches;
 * - `ui-alert-<tone>`: an alert per tone, `ui-alert-bad` with a long unbroken body;
 * - `ui-progress`: a bar at 40; `ui-progress-wait`: indeterminate; `ui-ring`: 42.5; `ui-ring-full`: 100;
 * - `ui-meter-zones`: three zones, 1.1 on 0..2; `ui-meter-hot`: 1.7; `ui-meter-null`: no value;
 *   `ui-meter-plain`: no zones, 30 of 100.
 */
import { createRoot } from 'react-dom/client'
import type { MeterZone } from '../../../src/core/ports'
import { IntlScope } from '../../../src/core/provider-props'
import { Alert } from '../../../src/ui/alert'
import { Meter } from '../../../src/ui/meter'
import { Progress, Ring } from '../../../src/ui/progress'
import { Status, Swatch } from '../../../src/ui/status'
import { VX } from '../../../src/tokens'

const TONES = ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const
const ZONES: [MeterZone, MeterZone, MeterZone] = [
  { to: 0.8, tone: 'info', label: 'Detraining' },
  { to: 1.3, tone: 'good', label: 'Optimal' },
  { to: 2, tone: 'bad', label: 'Overreaching' },
]
const SERIES = [VX.good, VX.warn, VX.bad] as const

function Fixture() {
  return (
    <IntlScope locale="de-DE">
      <main className="flex flex-col gap-8 p-4 text-foreground">
        <h1 className="text-lg font-medium">Status</h1>
        <section aria-label="Status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {TONES.map((tone) => (
            <Status key={tone} tone={tone} data-testid={`ui-status-${tone}`}>
              {tone}
            </Status>
          ))}
          {SERIES.map((color, i) => (
            <span key={color} className="flex items-center gap-1.5 text-sm">
              <Swatch color={color} data-testid={`ui-swatch-${i}`} />
              Series {i + 1}
            </span>
          ))}
        </section>
        <section aria-label="Alerts" className="flex flex-col gap-3">
          {TONES.map((tone) => (
            <Alert
              key={tone}
              tone={tone}
              title={`${tone} title`}
              data-testid={`ui-alert-${tone}`}
              className="max-w-prose"
            >
              {tone === 'bad'
                ? 'Sync failed at step three because the upstream answered withanunbrokenverylongtokenthatmustwrapinsidethealertandnotpushthepagesidewaysatanywidth.'
                : 'Body text for the alert.'}
            </Alert>
          ))}
        </section>
        <section aria-label="Progress" className="flex flex-col gap-4">
          <Progress value={40} aria-label="Upload" data-testid="ui-progress" className="max-w-xs" />
          <Progress
            value={null}
            tone="info"
            aria-label="Import"
            data-testid="ui-progress-wait"
            className="max-w-xs"
          />
          <div className="flex items-center gap-4">
            <Ring value={42.5} aria-label="Storage used" data-testid="ui-ring" />
            <Ring value={100} tone="good" aria-label="Done" data-testid="ui-ring-full" />
          </div>
        </section>
        <section aria-label="Meters" className="flex max-w-xs flex-col gap-4">
          <Meter label="Load" value={1.1} max={2} zones={ZONES} data-testid="ui-meter-zones" />
          <Meter label="Load, high" value={1.7} max={2} zones={ZONES} data-testid="ui-meter-hot" />
          <Meter
            label="Load, no data"
            value={null}
            max={2}
            zones={ZONES}
            data-testid="ui-meter-null"
          />
          <Meter label="Disk" value={30} max={100} tone="warn" data-testid="ui-meter-plain" />
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
