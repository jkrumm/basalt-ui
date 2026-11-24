/**
 * The `ui-form-parts` fixture (bench-form-parts): every new form part in its states, no shell and no
 * provider. The harness is told to "mount" it by a no-op `window.basaltMountFixture`, since the page
 * renders itself on load.
 *
 * Probes, each a `data-testid`:
 * - `cards`: a RadioGroup of choice cards (the first selected, one disabled); `cards-multi`: a
 *   CheckboxGroup of cards; `tiles`: cards with a preview in a wrapping grid; `cards-invalid`;
 * - `matrix`: a CheckboxMatrix with both toggles, a locked and a disabled cell, `matrix-invalid`;
 * - `tags`: a TagInput with a valid and an invalid chip; `tags-many`: enough chips to wrap;
 * - `otp` and `otp-invalid`: a six-box code, filled and in error;
 * - `swatch`, `swatch-menu`: the picker inline and behind a trigger;
 * - `picks`: QuickPicks with the second pill picked.
 */
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { CheckboxGroup } from '../../../src/ui/checkbox'
import { CheckboxMatrix } from '../../../src/ui/checkbox-matrix'
import { Field } from '../../../src/ui/field'
import { OneTimeCode } from '../../../src/ui/one-time-code'
import { QuickPicks } from '../../../src/ui/quick-picks'
import { RadioGroup } from '../../../src/ui/radio-group'
import { SwatchPicker } from '../../../src/ui/swatch-picker'
import type { SwatchToken } from '../../../src/ui/swatch-picker'
import { TagInput } from '../../../src/ui/tag-input'

const PLANS = [
  { value: 'free', label: 'Free', description: 'Up to three users', trailing: '€0 / month' },
  { value: 'pro', label: 'Pro', description: 'Team seats and audit log', trailing: '€12 / seat' },
  { value: 'scale', label: 'Scale', description: 'SSO', trailing: '€40 / seat', disabled: true },
]

const THEMES = ['Light', 'Dark', 'System'].map((label) => ({
  value: label.toLowerCase(),
  label,
  preview: <span className="block h-16 w-full bg-inset" />,
}))

const ROWS = [
  { id: 'billing', label: 'Billing', description: 'Invoices and plans' },
  { id: 'members', label: 'Members', description: 'Invite and remove people' },
  { id: 'security', label: 'Security' },
]
const COLUMNS = ['Owner', 'Admin', 'Member', 'Guest'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))

const SWATCHES = [
  { value: 'brand', label: 'Blue' },
  { value: 'good', label: 'Green' },
  { value: 'warn', label: 'Amber' },
  { value: 'bad', label: 'Red' },
  { value: 'info', label: 'Sky' },
  { value: 'chart-1', label: 'Series 1' },
  { value: 'chart-2', label: 'Series 2' },
  { value: 'chart-3', label: 'Series 3' },
] as const

const PICKS = ['Today', 'Tomorrow', 'In 3 days', 'Next week'].map((label) => ({
  value: label.toLowerCase(),
  label,
}))

const isEmail = (tag: string): string | undefined =>
  tag.includes('@') ? undefined : 'Not an email'

function Labelled({ id, children }: { id: string; children: ReactNode }): ReactElement {
  return (
    <section data-testid={id} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">{id}</h2>
      {children}
    </section>
  )
}

function Fixture(): ReactElement {
  const [plan, setPlan] = useState('free')
  const [swatch, setSwatch] = useState<SwatchToken | undefined>('good')
  const [menuSwatch, setMenuSwatch] = useState<SwatchToken | undefined>('brand')
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 bg-background p-4 text-foreground">
      <Labelled id="cards">
        <RadioGroup
          variant="card"
          aria-label="Plan"
          value={plan}
          onValueChange={setPlan}
          options={PLANS}
        />
      </Labelled>
      <Labelled id="cards-multi">
        <CheckboxGroup
          variant="card"
          aria-label="Channels"
          defaultValue={['mail']}
          options={[
            { value: 'mail', label: 'Mail', description: 'A daily digest' },
            { value: 'push', label: 'Push', description: 'On your phone' },
          ]}
        />
      </Labelled>
      <Labelled id="tiles">
        <RadioGroup variant="tile" aria-label="Appearance" defaultValue="dark" options={THEMES} />
      </Labelled>
      <Labelled id="cards-invalid">
        <Field label="Plan again" description="Pick one to go on." error="Choose a plan.">
          <RadioGroup variant="card" options={PLANS.slice(0, 2)} />
        </Field>
      </Labelled>
      <Labelled id="matrix">
        <CheckboxMatrix
          aria-label="Permissions"
          rows={ROWS}
          columns={COLUMNS}
          rowsLabel="Permission"
          rowToggles
          columnToggles
          defaultValue={{ billing: ['owner', 'admin'], members: ['owner'] }}
          cellState={(row, column) =>
            row.id === 'billing' && column.id === 'owner'
              ? 'locked'
              : row.id === 'security' && column.id === 'guest'
                ? 'disabled'
                : undefined
          }
        />
      </Labelled>
      <Labelled id="matrix-invalid">
        <CheckboxMatrix
          aria-label="Permissions to check"
          rows={ROWS}
          columns={COLUMNS}
          aria-invalid
        />
      </Labelled>
      <Labelled id="tags">
        <TagInput
          aria-label="Invitees"
          defaultValue={['ana@example.com', 'not-an-email']}
          validate={isEmail}
          placeholder="Add emails"
        />
      </Labelled>
      <Labelled id="tags-many">
        <TagInput
          aria-label="Keywords"
          defaultValue={Array.from({ length: 14 }, (_, i) => `keyword-${i + 1}`)}
        />
      </Labelled>
      <Labelled id="otp">
        <OneTimeCode aria-label="Verification code" defaultValue="123" />
      </Labelled>
      <Labelled id="otp-invalid">
        <OneTimeCode aria-label="Verification code again" defaultValue="123456" aria-invalid />
      </Labelled>
      <Labelled id="swatch">
        <SwatchPicker
          aria-label="Stage color"
          options={SWATCHES}
          value={swatch}
          onValueChange={setSwatch}
        />
      </Labelled>
      <Labelled id="swatch-menu">
        <SwatchPicker
          aria-label="Label color"
          display="menu"
          options={SWATCHES}
          value={menuSwatch}
          onValueChange={setMenuSwatch}
          className="w-fit"
        />
      </Labelled>
      <Labelled id="picks">
        <QuickPicks aria-label="Due date shortcuts" options={PICKS} value="tomorrow" />
      </Labelled>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
