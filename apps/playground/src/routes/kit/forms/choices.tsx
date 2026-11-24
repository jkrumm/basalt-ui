import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Page, Section } from 'basalt-ui/page'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from 'basalt-ui/ui/combobox'
import { CheckboxGroup } from 'basalt-ui/ui/checkbox'
import { CheckboxMatrix } from 'basalt-ui/ui/checkbox-matrix'
import type { MatrixValue } from 'basalt-ui/ui/checkbox-matrix'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Separator } from 'basalt-ui/ui/separator'
import { SwatchPicker } from 'basalt-ui/ui/swatch-picker'
import type { SwatchToken } from 'basalt-ui/ui/swatch-picker'
import { Segmented } from 'basalt-ui/ui/segmented'
import { Select } from 'basalt-ui/ui/select'
import { Switch } from 'basalt-ui/ui/switch'
import type { ReactElement, ReactNode } from 'react'
import {
  ENVIRONMENTS,
  EVENTS,
  Globe,
  LABELS,
  Link,
  Mail,
  SIZES,
  STRATEGIES,
  TIME_ZONES,
  useSpecimen,
} from './-specimen'
import type { Strategy } from './-specimen'

/** Two fields a row from `@regular`, one on a phone. */
function Pair({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid max-w-5xl gap-6 @regular:grid-cols-2">{children}</div>
}

const CHANNELS = [
  { value: 'email', label: 'Email', description: 'To the alert address.', icon: Mail },
  { value: 'webhook', label: 'Webhook', description: 'A POST to a URL you set.', icon: Link },
  {
    value: 'status',
    label: 'Status page',
    description: 'Public, on the status site.',
    icon: Globe,
  },
] as const

const BASE_IMAGES = [
  'node:22-alpine',
  'node:24-slim',
  'python:3.13-slim',
  'golang:1.24-alpine',
  'nginx:1.27-alpine',
  'postgres:17',
]

function OneOfFew(): ReactElement {
  const environment = useSpecimen<string | null>('production')
  const strategy = useSpecimen<Strategy>('rolling')
  const size = useSpecimen('m')
  const channel = useSpecimen('email')
  return (
    <Pair>
      <FormField
        label="Environment"
        description="Select: fewer than ten known values."
        field={environment}
      >
        <Select aria-label="Environment" options={ENVIRONMENTS} placeholder="Choose one" />
      </FormField>
      <FormField
        label="Instance size"
        description="Segmented: two to five short options."
        field={size}
      >
        <Segmented aria-label="Instance size" options={SIZES} />
      </FormField>
      <FormField
        label="Rollout"
        description="RadioGroup: a few options seen at once, each with its hint."
        field={strategy}
      >
        <RadioGroup aria-label="Rollout" options={STRATEGIES} />
      </FormField>
      <FormField
        label="Alert channel"
        description="Select options with a description and an icon."
        field={channel}
      >
        <Select aria-label="Alert channel" options={CHANNELS} />
      </FormField>
    </Pair>
  )
}

function Lookup(): ReactElement {
  const timeZone = useSpecimen<string | null>('Europe/Berlin')
  const image = useSpecimen('')
  return (
    <Pair>
      <FormField
        label="Time zone"
        description="Searchable: typing narrows the list."
        field={timeZone}
      >
        <Combobox items={TIME_ZONES}>
          <ComboboxInput aria-label="Time zone" placeholder="Search zones" />
          <ComboboxContent empty="No zone matches.">
            {(zone: string) => (
              <ComboboxItem key={zone} value={zone}>
                {zone}
              </ComboboxItem>
            )}
          </ComboboxContent>
        </Combobox>
      </FormField>
      <FormField
        label="Base image"
        description="Suggestions as you type; a typed image that is not listed is kept."
        field={image}
      >
        <Autocomplete items={BASE_IMAGES}>
          <AutocompleteInput aria-label="Base image" placeholder="node:22-alpine" />
          <AutocompleteContent empty="No suggestion; the typed image is kept.">
            {(base: string) => (
              <AutocompleteItem key={base} value={base}>
                {base}
              </AutocompleteItem>
            )}
          </AutocompleteContent>
        </Autocomplete>
      </FormField>
    </Pair>
  )
}

function PickSeveral(): ReactElement {
  const events = useSpecimen<string[]>(['deploy-failed', 'incident'])
  const labels = useSpecimen<string[]>(['customer-facing'])
  return (
    <Pair>
      <FormField
        label="Notify me when"
        description="CheckboxGroup: independent choices."
        field={events}
      >
        <CheckboxGroup aria-label="Notify me when" options={EVENTS} />
      </FormField>
      <FormField
        label="Labels"
        description="Pick one, or type a new one to create it."
        field={labels}
      >
        <Combobox multiple items={LABELS} onCreate={(text) => text.trim().toLowerCase()}>
          <ComboboxChips aria-label="Labels" placeholder="Add a label" />
          <ComboboxContent empty="No label matches.">
            {(label: string) => (
              <ComboboxItem key={label} value={label}>
                {label}
              </ComboboxItem>
            )}
          </ComboboxContent>
        </Combobox>
      </FormField>
    </Pair>
  )
}

const PLANS = [
  { value: 'free', label: 'Free', description: 'Up to three users', trailing: '€0 / month' },
  { value: 'pro', label: 'Pro', description: 'Team seats and audit log', trailing: '€12 / seat' },
  { value: 'scale', label: 'Scale', description: 'SSO and a support SLA', trailing: '€40 / seat' },
]

/** A density in miniature: ruled rows, further apart as the density loosens. */
function Rows({ gap }: { gap: string }): ReactElement {
  return (
    <span className={`flex h-14 w-full flex-col justify-center px-3 ${gap}`}>
      <Separator />
      <Separator />
      <Separator />
      <Separator />
    </span>
  )
}

const DENSITIES = [
  { value: 'compact', label: 'Compact', preview: <Rows gap="gap-0.5" /> },
  { value: 'normal', label: 'Normal', preview: <Rows gap="gap-1.5" /> },
  { value: 'comfortable', label: 'Comfortable', preview: <Rows gap="gap-2.5" /> },
]

function Cards(): ReactElement {
  const plan = useSpecimen('pro')
  const density = useSpecimen('normal')
  const notify = useSpecimen<string[]>(['email'])
  const unpicked = useSpecimen('', 'Choose a plan to continue.')
  return (
    <Pair>
      <FormField label="Plan" description="A line and a price under each name." field={plan}>
        <RadioGroup variant="card" aria-label="Plan" options={PLANS} />
      </FormField>
      <FormField
        label="Row density"
        description="A preview over the title, wrapping with the width."
        field={density}
      >
        <RadioGroup variant="tile" aria-label="Row density" options={DENSITIES} />
      </FormField>
      <FormField label="Notify by" description="Several at once." field={notify}>
        <CheckboxGroup
          variant="card"
          aria-label="Notify by"
          options={[
            { value: 'email', label: 'Email', description: 'A daily digest' },
            { value: 'push', label: 'Push', description: 'On your phone' },
            {
              value: 'sms',
              label: 'SMS',
              description: 'Not available on your plan',
              disabled: true,
            },
          ]}
        />
      </FormField>
      <FormField
        label="Plan, invalid"
        description="The error sits under the group."
        field={unpicked}
      >
        <RadioGroup variant="card" aria-label="Plan, invalid" options={PLANS.slice(0, 2)} />
      </FormField>
    </Pair>
  )
}

const ROLES = ['Owner', 'Admin', 'Member', 'Guest'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))
const AREAS = [
  { id: 'billing', label: 'Billing', description: 'Invoices, plans and payment methods' },
  { id: 'members', label: 'Members', description: 'Invite, remove and change roles' },
  { id: 'deploys', label: 'Deploys', description: 'Start and roll back a release' },
  { id: 'audit', label: 'Audit log' },
]

function Matrix(): ReactElement {
  const grants = useSpecimen<MatrixValue>({
    billing: ['owner'],
    members: ['owner', 'admin'],
    deploys: ['owner', 'admin', 'member'],
    audit: ['owner', 'admin'],
  })
  return (
    <div className="max-w-5xl">
      <FormField
        label="Permissions"
        description="Owners always keep every right; Guests cannot reach the audit log."
        field={grants}
      >
        <CheckboxMatrix
          aria-label="Permissions"
          rows={AREAS}
          columns={ROLES}
          rowsLabel="Area"
          rowToggles
          columnToggles
          cellState={(row, column) =>
            column.id === 'owner'
              ? 'locked'
              : row.id === 'audit' && column.id === 'guest'
                ? 'disabled'
                : undefined
          }
        />
      </FormField>
    </div>
  )
}

const STAGE_COLORS = [
  { value: 'neutral', label: 'Grey' },
  { value: 'brand', label: 'Blue' },
  { value: 'good', label: 'Green' },
  { value: 'warn', label: 'Amber' },
  { value: 'bad', label: 'Red' },
  { value: 'info', label: 'Sky' },
  { value: 'chart-1', label: 'Series 1' },
  { value: 'chart-2', label: 'Series 2' },
] as const

function Color(): ReactElement {
  const stage = useSpecimen<SwatchToken | undefined>('good')
  const label = useSpecimen<SwatchToken | undefined>('brand')
  return (
    <Pair>
      <FormField
        label="Stage color"
        description="Named palette tokens, never a free color."
        field={stage}
      >
        <SwatchPicker aria-label="Stage color" options={STAGE_COLORS} />
      </FormField>
      <FormField
        label="Label color"
        description="In a menu, for a field with little room."
        field={label}
      >
        <SwatchPicker
          aria-label="Label color"
          display="menu"
          options={STAGE_COLORS}
          className="w-fit"
        />
      </FormField>
    </Pair>
  )
}

function InstantApply(): ReactElement {
  const compact = useSpecimen(true)
  return (
    <Pair>
      <FormField
        label="Compact rows"
        description="Applies as it flips; nothing to save."
        field={compact}
      >
        <Switch />
      </FormField>
    </Pair>
  )
}

/**
 * The choice controls on a deploy's real options: its environments, sizes, rollouts, alert channels,
 * time zones, base images and labels. Each field is local state behind FormField's `FieldLike` port;
 * /kit/forms/whole binds the same controls to TanStack Form.
 */
function ChoicesRoute(): ReactElement {
  return (
    <Page area="kit-forms-choices">
      <Section
        title="One of a few"
        summary="Select, Segmented and RadioGroup; a Select option can carry a description and an icon."
      >
        <OneOfFew />
      </Section>
      <Section
        title="Search"
        summary="Combobox for a long list, Autocomplete for free text with suggestions."
      >
        <Lookup />
      </Section>
      <Section
        title="Several"
        summary="CheckboxGroup for independent choices; a multi Combobox with chips, creatable."
      >
        <PickSeveral />
      </Section>
      <Section title="Choice cards" summary="Selected by its border, never by fill alone.">
        <Cards />
      </Section>
      <Section
        title="Permission matrix"
        summary="Tab visits every cell; the arrow keys move between them."
      >
        <Matrix />
      </Section>
      <Section title="Color" summary="One color of the palette, as swatches in place or in a menu.">
        <Color />
      </Section>
      <Section
        title="Instant apply"
        summary="A Switch takes effect when it flips, so it has no save."
      >
        <InstantApply />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/forms/choices')({
  staticData: { title: 'Choices' },
  component: ChoicesRoute,
})
