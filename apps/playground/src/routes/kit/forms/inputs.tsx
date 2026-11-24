import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import { Checkbox } from 'basalt-ui/ui/checkbox'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from 'basalt-ui/ui/combobox'
import { FileUpload } from 'basalt-ui/ui/file-upload'
import { Button } from 'basalt-ui/ui/button'
import { CopyButton } from 'basalt-ui/ui/copy-button'
import { ControlGroup, InputAddon, InputGroup } from 'basalt-ui/ui/control-group'
import { DatePicker } from 'basalt-ui/ui/date-picker'
import { Input } from 'basalt-ui/ui/input'
import { OneTimeCode } from 'basalt-ui/ui/one-time-code'
import { PasswordInput } from 'basalt-ui/ui/password-input'
import { QuickPicks } from 'basalt-ui/ui/quick-picks'
import { TagInput } from 'basalt-ui/ui/tag-input'
import { Segmented } from 'basalt-ui/ui/segmented'
import { NumberField } from 'basalt-ui/ui/number-field'
import { NativeSelect, Select } from 'basalt-ui/ui/select'
import { Switch } from 'basalt-ui/ui/switch'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { FieldLike } from 'basalt-ui'
import type { ReactElement } from 'react'
import { ENVIRONMENTS, Search, STATES, TEAM_VALUES, teamLabel, useSpecimen } from './-specimen'
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
      <NativeSelect options={REGIONS} />
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

const TEAM = cellsOf<string | null>({
  empty: null,
  filled: 'payments',
  invalid: null,
  error: 'Pick the team that owns it.',
})
function TeamCell({ cell }: { cell: Cell<string | null> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Combobox items={TEAM_VALUES} itemToStringLabel={teamLabel} readOnly={c.readOnly}>
        <ComboboxInput aria-label={c.label} placeholder="Search teams" />
        <ComboboxContent empty="No team matches.">
          {(team: string) => (
            <ComboboxItem key={team} value={team}>
              {teamLabel(team)}
            </ComboboxItem>
          )}
        </ComboboxContent>
      </Combobox>
    </FormField>
  )
}

const REPLICAS = cellsOf<number | null>({
  empty: null,
  filled: 4,
  invalid: null,
  error: 'Enter how many replicas to run.',
})
function ReplicasCell({ cell }: { cell: Cell<number | null> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <NumberField min={1} max={20} readOnly={c.readOnly} />
    </FormField>
  )
}

const SWITCH = cellsOf({
  empty: false,
  filled: true,
  invalid: false,
  error: 'Turn it on to go on.',
})
function SwitchCell({ cell }: { cell: Cell<boolean> }): ReactElement {
  const c = useCell(cell)
  return (
    <FormField label={c.label} field={c.field} disabled={c.disabled}>
      <Switch readOnly={c.readOnly} />
    </FormField>
  )
}

const UPLOAD_STATES = ['Rest', 'Invalid', 'Disabled'] as const
function UploadCell({ state }: { state: (typeof UPLOAD_STATES)[number] }): ReactElement {
  const field = useSpecimen<File[]>(
    [],
    state === 'Invalid' ? 'Attach a PNG or SVG under 1 MB.' : undefined,
  )
  return (
    <FormField label={state} field={field} disabled={state === 'Disabled'}>
      <FileUpload
        accept="image/png,image/svg+xml"
        maxSize={1_000_000}
        hint="PNG or SVG, up to 1 MB."
      />
    </FormField>
  )
}

/** Two fields that carry an icon or a unit, beside each other from `@regular`. */
function Affixes(): ReactElement {
  const query = useSpecimen('')
  const timeout = useSpecimen('')
  return (
    <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">
      <FormField
        label="Search the logs"
        description="A leading icon, drawn inside the field."
        field={query}
      >
        <Input autoComplete="off" placeholder="Service or message" start={Search} />
      </FormField>
      <FormField
        label="Timeout"
        description="A trailing unit, drawn inside the field."
        field={timeout}
      >
        <Input inputMode="numeric" autoComplete="off" placeholder="5000" end="ms" />
      </FormField>
    </div>
  )
}

const API_KEY = 'sk_live_4f9a2c81e07b'

/** A password with its reveal button, and a read-only key with its copy button. */
function OwnButtons(): ReactElement {
  const password = useSpecimen('')
  const key = useSpecimen(API_KEY)
  return (
    <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">
      <FormField
        label="Password"
        description="The button in the field reveals this field only."
        field={password}
      >
        <PasswordInput autoComplete="new-password" />
      </FormField>
      <FormField label="API key" description="Copied with the button at its end." field={key}>
        <Input
          readOnly
          autoComplete="off"
          end={<CopyButton value={API_KEY} label="API key" size="sm" />}
        />
      </FormField>
    </div>
  )
}

const FIELDS = [
  { value: 'service', label: 'Service' },
  { value: 'message', label: 'Message' },
]

/** Controls that make one request, and a field with addons outside its edge. */
function Groups(): ReactElement {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ControlGroup fill aria-label="Find in the logs">
        {/* oxlint-disable-next-line basalt/control-home -- FormField binds one control and cannot reach into a group; this specimen shows the group's geometry, with no value to bind */}
        <NativeSelect aria-label="Field to search" options={FIELDS} className="grow-0" />
        <Input aria-label="Search text" autoComplete="off" placeholder="Find in the logs" />
        <Button variant="primary">Search</Button>
      </ControlGroup>
      <InputGroup aria-label="Website">
        <InputAddon>https://</InputAddon>
        <Input
          aria-label="Website, without https://"
          autoComplete="url"
          placeholder="example.com"
        />
      </InputGroup>
      <InputGroup aria-label="Budget">
        <InputAddon>EUR</InputAddon>
        <Input
          aria-label="Budget in EUR"
          inputMode="decimal"
          autoComplete="off"
          placeholder="1200"
        />
        {/* oxlint-disable-next-line basalt/control-home -- FormField binds one control and cannot reach into a group; this specimen shows the group's geometry, with no value to bind */}
        <NativeSelect
          aria-label="Budget period"
          options={[
            { value: 'month', label: 'per month' },
            { value: 'year', label: 'per year' },
          ]}
        />
      </InputGroup>
    </div>
  )
}

/** One size, every control: each in its field, one height whichever control draws it. */
function SizeRow({ size }: { size: 'md' | 'sm' }): ReactElement {
  const name = useSpecimen('')
  const region = useSpecimen('eu-central')
  const environment = useSpecimen<string | null>('staging')
  const replicas = useSpecimen<number | null>(3)
  const due = useSpecimen<string | null>(null)
  const range = useSpecimen('7d')
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Button size={size}>{size === 'md' ? 'Medium' : 'Small'}</Button>
      <FormField label="Name" field={name}>
        <Input size={size} autoComplete="off" placeholder="Name" className="w-40" />
      </FormField>
      <FormField label="Region" field={region}>
        <NativeSelect size={size} options={REGIONS} className="w-44" />
      </FormField>
      <FormField label="Environment" field={environment}>
        <Select size={size} aria-label="Environment" options={ENVIRONMENTS} className="w-44" />
      </FormField>
      <FormField label="Replicas" field={replicas}>
        <NumberField size={size} className="w-32" />
      </FormField>
      <FormField label="Due" field={due}>
        <DatePicker size={size} aria-label="Due" className="w-40" />
      </FormField>
      <FormField label="Range" field={range}>
        <Segmented
          size={size}
          options={[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
          ]}
        />
      </FormField>
    </div>
  )
}

/** Every control at medium, then small. */
function Heights(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <SizeRow size="md" />
      <SizeRow size="sm" />
    </div>
  )
}

/** The cells of one control, one column on a phone and a row of five wide. */
function Cells({ children }: { children: ReactElement[] }): ReactElement {
  return <div className="grid gap-4 @regular:grid-cols-3 @wide:grid-cols-5">{children}</div>
}

/**
 * Each input control in the states the kit draws: rest, filled, invalid, disabled and read-only for
 * the field controls; file upload shows rest, invalid and disabled. Hover and focus are live on each
 * cell (point at it, tab into it); the scheme is the shell's own, so light and dark are the toggle in
 * the settings menu. Loading has no input form in the kit: only `Button` takes `loading` (/kit/forms/buttons).
 */
const DUE = [
  { value: '2026-11-22', label: 'Today' },
  { value: '2026-11-23', label: 'Tomorrow' },
  { value: '2026-11-25', label: 'In 3 days' },
  { value: '2026-11-29', label: 'Next week' },
]

const isEmail = (tag: string): string | undefined =>
  /^\S+@\S+\.\S+$/.test(tag) ? undefined : 'Not an email address'

function TagsAndCodes(): ReactElement {
  const invitees = useSpecimen<string[]>(['ana@example.com', 'lee@example'])
  const code = useSpecimen('48')
  const wrong = useSpecimen('123456', 'That code is wrong. Request a new one.')
  const due = useSpecimen('2026-11-23')
  return (
    <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">
      <FormField
        label="Invite by email"
        description="Type, or paste a list: commas, semicolons and line breaks split it."
        field={invitees}
      >
        <TagInput
          aria-label="Invite by email"
          validate={isEmail}
          inputMode="email"
          placeholder="name@company.com"
        />
      </FormField>
      <FormField
        label="Due date"
        description="The pills write the date; typing another one clears the pick."
        field={due}
      >
        <div className="flex flex-col gap-2">
          <QuickPicks
            aria-label="Due date shortcuts"
            options={DUE}
            value={due.state.value}
            onValueChange={due.handleChange}
          />
          <Input
            type="date"
            aria-label="Due date"
            value={due.state.value}
            onValueChange={due.handleChange}
          />
        </div>
      </FormField>
      <FormField
        label="Verification code"
        description="Six digits; a pasted code fills every box."
        field={code}
      >
        <OneTimeCode aria-label="Verification code" />
      </FormField>
      <FormField
        label="Verification code, wrong"
        description="Every box turns red and the message follows."
        field={wrong}
      >
        <OneTimeCode aria-label="Verification code, wrong" />
      </FormField>
    </div>
  )
}

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
      <Section title="Combobox" summary="Search, or 50 or more options; typing filters the list.">
        <Cells>
          {TEAM.map((cell) => (
            <TeamCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Number" summary="A number with steppers, formatted in the locale.">
        <Cells>
          {REPLICAS.map((cell) => (
            <ReplicasCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Switch" summary="A setting that takes effect as it flips.">
        <Cells>
          {SWITCH.map((cell) => (
            <SwitchCell key={cell.state} cell={cell} />
          ))}
        </Cells>
      </Section>
      <Section title="Affixes" summary="An icon before the value, a unit after it.">
        <Affixes />
      </Section>
      <Section
        title="Buttons in a field"
        summary="A button inside a field acts on that field only."
      >
        <OwnButtons />
      </Section>
      <Section title="Groups" summary="Controls that make one request, and addons outside a field.">
        <Groups />
      </Section>
      <Section
        title="One height"
        summary="Every control at medium, then small. Under touch a lone small button keeps 24 px drawn with a 44 px hit area; in a group it lifts to 44."
      >
        <Heights />
      </Section>
      <Section
        title="Tags, code and date shortcuts"
        summary="Chips for a list, boxes for a code, pills for a date."
      >
        <TagsAndCodes />
      </Section>
      <Section title="File upload" summary="Files from disk; the limits are in the hint.">
        <Cells>
          {UPLOAD_STATES.map((state) => (
            <UploadCell key={state} state={state} />
          ))}
        </Cells>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/inputs')({
  staticData: { title: 'Inputs and states' },
  component: InputsRoute,
})
