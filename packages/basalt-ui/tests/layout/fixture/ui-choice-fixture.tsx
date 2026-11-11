/**
 * The `ui-choice` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 7-9): the
 * radio group and the switch on their own markup, no shell and no provider. It is the entry the
 * `ui-choice` layout test bundles; the harness is told to "mount" it by a no-op
 * `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each in a `data-testid` box:
 * - `uc-plan`: a three-option group, `b` selected, labelled by wrapping `<label>`s;
 * - `uc-sync`: a switch, on; `uc-beta`: a switch, off; `uc-lock`: a disabled switch.
 */
/* oxlint-disable jsx-a11y/label-has-associated-control -- the wrapped controls are custom components the rule cannot see */
import { createRoot } from 'react-dom/client'
import { Radio, RadioGroup } from '../../../src/ui/radio-group'
import { Switch } from '../../../src/ui/switch'

const PLANS = ['free', 'team', 'pro'] as const
const ROW = 'flex items-center gap-3 text-base'

function Fixture() {
  return (
    <main className="flex flex-col gap-12 p-4 text-foreground">
      <h1 className="text-lg font-medium">Choices</h1>
      <section aria-label="Plan" data-testid="uc-plan">
        <RadioGroup aria-label="Plan" defaultValue="team">
          {PLANS.map((plan) => (
            <label key={plan} className={ROW}>
              <Radio value={plan} data-testid={`uc-radio-${plan}`} />
              {plan}
            </label>
          ))}
        </RadioGroup>
      </section>
      <section aria-label="Switches" className="flex flex-col gap-12">
        <label className={ROW} data-testid="uc-sync">
          <Switch defaultChecked data-testid="uc-switch-sync" />
          Sync
        </label>
        <label className={ROW} data-testid="uc-beta">
          <Switch data-testid="uc-switch-beta" />
          Beta
        </label>
        <label className={ROW} data-testid="uc-lock">
          <Switch disabled data-testid="uc-switch-lock" />
          Locked
        </label>
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
