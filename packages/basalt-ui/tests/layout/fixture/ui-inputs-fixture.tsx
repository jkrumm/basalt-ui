/**
 * The `ui-inputs` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 3-4 and 8):
 * the textarea, the number field and the checkbox on their own markup, no shell and no provider.
 * It is the entry the `ui-inputs` layout test bundles; the harness is told to "mount" it by a no-op
 * `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each carrying a `data-testid`:
 * - `ui-note`: a textarea, three rows;
 * - `ui-qty`: a number field, 1234.5 in `de-DE`; `ui-qty-sm`: the same at size `sm`;
 * - `ui-tag-*`: a three-option checkbox group, `team` checked; `ui-agree`: a lone checkbox, off;
 *   `ui-mixed`: an indeterminate one; `ui-lock`: a disabled one.
 */
/* oxlint-disable jsx-a11y/label-has-associated-control -- the wrapped controls are custom components the rule cannot see */
import { createRoot } from 'react-dom/client'
import { Checkbox, CheckboxGroup } from '../../../src/ui/checkbox'
import { NumberField } from '../../../src/ui/number-field'
import { Textarea } from '../../../src/ui/textarea'

const TAGS = ['ops', 'team', 'dev'] as const
const ROW = 'flex items-center gap-3 text-base'

function Fixture() {
  return (
    <main className="flex flex-col gap-12 p-4 text-foreground">
      <h1 className="text-lg font-medium">Inputs</h1>
      <section aria-label="Text" className="flex flex-col gap-6">
        <Textarea aria-label="Note" data-testid="ui-note" placeholder="Note" />
        <NumberField
          aria-label="Quantity"
          locale="de-DE"
          defaultValue={1234.5}
          min={0}
          data-testid="ui-qty"
        />
        <NumberField
          aria-label="Quantity, compact"
          size="sm"
          locale="de-DE"
          defaultValue={1234.5}
          data-testid="ui-qty-sm"
        />
      </section>
      <section aria-label="Checkboxes" className="flex flex-col gap-12">
        <CheckboxGroup aria-label="Tags" defaultValue={['team']}>
          {TAGS.map((tag) => (
            <label key={tag} className={ROW}>
              <Checkbox value={tag} data-testid={`ui-tag-${tag}`} />
              {tag}
            </label>
          ))}
        </CheckboxGroup>
        <label className={ROW}>
          <Checkbox data-testid="ui-agree" />
          Agree
        </label>
        <label className={ROW}>
          <Checkbox indeterminate data-testid="ui-mixed" />
          Some
        </label>
        <label className={ROW}>
          <Checkbox disabled data-testid="ui-lock" />
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
