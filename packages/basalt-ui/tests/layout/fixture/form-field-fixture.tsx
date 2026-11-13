/**
 * The `form-field` fixture (docs/v3/issues/g3/v3-ctl-7-formfield.json): `FormField` and `FormRow` on
 * their own markup, no shell and no provider. Long labels, descriptions and errors on purpose.
 *
 * Probes, each a `data-testid` box:
 * - `ff-wide`: a 44 rem frame with a two-field `FormRow` (side by side from the `regular` tier);
 * - `ff-narrow`: a 17 rem frame holding the same row (stacked);
 * - `ff-kinds`: one `FormField` of every control kind, a long label, description and error each;
 * - `ff-clean`: a field with no error yet, the empty live region.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { FieldLike } from '../../../src/core/ports'
import { memoryHandle } from '../../../src/controls/control-view.handles'
import { FormField } from '../../../src/controls/form-field'
import { FormRow } from '../../../src/controls/form-row'
import { Checkbox } from '../../../src/ui/checkbox'
import { Input } from '../../../src/ui/input'
import { NumberField } from '../../../src/ui/number-field'
import { Select } from '../../../src/ui/select'
import { Slider } from '../../../src/ui/slider'
import { Switch } from '../../../src/ui/switch'

const LONG_LABEL = 'A deliberately long label that has to wrap inside a narrow field'
const LONG_ERROR =
  'This value cannot be saved because the upstream service rejected it and returned a long explanation'
const LONG_HELP = 'Shown on every invoice and in the weekly digest, so keep it short and neutral.'

function fieldLike<T>(value: T, error?: string): FieldLike<T> {
  return {
    state: { value, meta: { errors: error === undefined ? [] : [error] } },
    handleChange() {},
    handleBlur() {},
  }
}

const OPTIONS = [
  { value: 'a', label: 'Alpha, with a name long enough to need truncating in a narrow frame' },
  { value: 'b', label: 'Beta' },
]

function Frame({
  testid,
  width,
  children,
}: {
  testid: string
  width: string
  children: ReactElement | ReactElement[]
}): ReactElement {
  return (
    <div
      data-testid={testid}
      className={`flex max-w-full min-w-0 flex-col gap-4 rounded-card border border-border bg-card p-3 ${width}`}
    >
      {children}
    </div>
  )
}

function Row(): ReactElement {
  return (
    <FormRow legend="Line 1">
      <FormField label="Item" required field={fieldLike('Widget')}>
        <Input />
      </FormField>
      <FormField label="Quantity" field={fieldLike(3, 'Too many')}>
        <NumberField />
      </FormField>
    </FormRow>
  )
}

function Fixture(): ReactElement {
  const pref = memoryHandle('ff.pref', 'changed', { kind: 'string' })
  return (
    <main lang="en" className="flex flex-col gap-4 p-4 text-foreground">
      <Frame testid="ff-wide" width="w-[44rem]">
        <Row />
      </Frame>
      <Frame testid="ff-narrow" width="w-[17rem]">
        <Row />
      </Frame>
      <Frame testid="ff-clean" width="w-[24rem]">
        <FormField label="Email" description={LONG_HELP} field={fieldLike('')}>
          <Input />
        </FormField>
      </Frame>
      <Frame testid="ff-kinds" width="w-[24rem]">
        <FormField
          label={LONG_LABEL}
          description={LONG_HELP}
          required
          field={fieldLike('', LONG_ERROR)}
        >
          <Input />
        </FormField>
        <FormField label={LONG_LABEL} field={fieldLike('a', LONG_ERROR)}>
          <Select aria-label="Kind" options={OPTIONS} />
        </FormField>
        <FormField label={LONG_LABEL} field={fieldLike(2, LONG_ERROR)}>
          <NumberField />
        </FormField>
        <FormField label={LONG_LABEL} field={fieldLike(false, LONG_ERROR)}>
          <Switch />
        </FormField>
        <FormField label={LONG_LABEL} field={fieldLike(true, LONG_ERROR)}>
          <Checkbox />
        </FormField>
        <FormField label={LONG_LABEL} field={fieldLike(30, LONG_ERROR)}>
          <Slider min={0} max={100} aria-label="Level" />
        </FormField>
        <FormField label={LONG_LABEL} control={pref}>
          <Input />
        </FormField>
      </Frame>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
