import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import { Checkbox } from 'basalt-ui/ui/checkbox'
import { Input } from 'basalt-ui/ui/input'
import { NativeSelect, Select } from 'basalt-ui/ui/select'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { FieldLike } from 'basalt-ui/core/ports'
import type { ReactElement } from 'react'
import { ENVIRONMENTS, STATES, useSpecimen } from './-specimen'
import type { State } from './-specimen'

/** One cell: its state, the value it starts with and, for the invalid cell, the message. */
type Cell<T> = { state: State; value: T; error?: string }

/** The five cells of a control: empty at rest, the filled value in the three that show one. */
function cellsOf<T>(o: { empty: T; filled: T; invalid: T; error: string }): Cell<T>[] {
  return STATES.map((state) => {
    if (state === 'Rest') return { state, value: o.empty }
    if (state === 'Invalid') return { state, value: o.invalid, error: o.error }
    return { state, value: o.filled }
  })
}

/** What a cell hands its `FormField` and its control; the field names the control by its state, inside the section's region. */
function useCell<T>(cell: Cell<T>): {
  field: FieldLike<T>
  label: State
  disabled: boolean
  readOnly: boolean
} {
  return {
    field: useSpecimen(cell.value, cell.error),
    label: cell.state,
    disabled: cell.state === 'Disabled',
    readOnly: cell.state === 'Read-only',
  }
}

const EMAIL = cellsOf({
  empty: '',
  filled: 'ada@example.com',
  invalid: 'ada@example',
  error: 'Enter a full address, like ada@example.com.',
})
function EmailCell({ cell }: { cell: Cell<string> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Input
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        readOnly={c.readOnly}
      />
    </FormField>
  )
}

const NOTE = cellsOf({
  empty: '',
  filled: 'Rolled back at 14:02 after the error rate passed 2%.',
  invalid: 'x'.repeat(12),
  error: 'Write at least 20 characters, so the next reader knows why.',
})
function NoteCell({ cell }: { cell: Cell<string> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Textarea rows={3} autoComplete="off" placeholder="What happened?" readOnly={c.readOnly} />
    </FormField>
  )
}

const ENVIRONMENT = cellsOf<string | null>({
  empty: null,
  filled: 'staging',
  invalid: null,
  error: 'Pick the environment to deploy to.',
})
function EnvironmentCell({ cell }: { cell: Cell<string | null> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Select
        aria-label={c.label}
        options={ENVIRONMENTS}
        placeholder="Choose one"
        readOnly={c.readOnly}
      />
    </FormField>
  )
}

const REGION = cellsOf({
  empty: '',
  filled: 'eu-central',
  invalid: '',
  error: 'Pick a region.',
})
const REGIONS = [
  { value: '', label: 'Choose a region' },
  { value: 'eu-central', label: 'EU central' },
  { value: 'us-east', label: 'US east' },
  { value: 'ap-south', label: 'AP south' },
]
function RegionCell({ cell }: { cell: Cell<string> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <NativeSelect
        options={REGIONS}
        onChange={(event) => {
          c.field.handleChange(event.target.value)
        }}
      />
    </FormField>
  )
}

const TERMS = cellsOf({
  empty: false,
  filled: true,
  invalid: false,
  error: 'Accept the terms to go on.',
})
function TermsCell({ cell }: { cell: Cell<boolean> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Checkbox readOnly={c.readOnly} />
    </FormField>
  )
}

/** The cells of one control, one column on a phone and a row of five wide. */
function Cells({ children }: { children: ReactElement[] }): ReactElement {
  return <div className="grid gap-4 @regular:grid-cols-3 @wide:grid-cols-5">{children}</div>
}

/**
 * Every input control in every state the kit draws: rest, filled, invalid, disabled and read-only.
 * Hover and focus are live on each cell (point at it, tab into it); the scheme is the shell's own,
 * so light and dark are the toggle in the settings menu. Loading has no input form in the kit:
 * only `Button` takes `loading` (/kit/forms/buttons). The parts the quality matrix fails at rest are
 * held back and listed (docs/v3/verdicts/showcase-gaps.md, Forms).
 */
function InputsRoute(): ReactElement {
  return (
    <Page area="kit-forms-inputs">
      <Section title="Long text" summary="Textarea, growing from three lines.">
        <Cells>
          {NOTE.map((cell) => (
            <NoteCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section
        title="Text"
        summary="Input with an email token. Hover and focus are live on every cell."
      >
        <Cells>
          {EMAIL.map((cell) => (
            <EmailCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Select" summary="Fewer than ten known values.">
        <Cells>
          {ENVIRONMENT.map((cell) => (
            <EnvironmentCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Native select" summary="The platform picker, for a phone or a table row.">
        <Cells>
          {REGION.map((cell) => (
            <RegionCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Checkbox" summary="A yes or no submitted with the form.">
        <Cells>
          {TERMS.map((cell) => (
            <TermsCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Held back" summary="Parts the quality matrix fails at rest on a page.">
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          Combobox, NumberField and Switch are not drawn here: the matrix finds no focus ring on the
          Combobox and NumberField inputs, a Combobox input under the 24 px hit floor, and a Switch
          frame that vanishes under forced colours. Each is a row in the Forms list of
          docs/v3/verdicts/showcase-gaps.md; the whole forms (/kit/forms/whole) still use them in
          the dialog and the settings form.
        </p>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/inputs')({
  staticData: { title: 'Inputs and states' },
  component: InputsRoute,
})
