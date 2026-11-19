import { revalidateLogic, useForm } from '@tanstack/react-form'
import { FormField, FormFooter, FormSection } from 'basalt-ui/controls'
import { Checkbox, CheckboxGroup } from 'basalt-ui/ui/checkbox'
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from 'basalt-ui/ui/combobox'
import { DatePicker, DateRangePicker } from 'basalt-ui/ui/date-picker'
import { FileUpload } from 'basalt-ui/ui/file-upload'
import type { CalendarDate, CalendarRange } from 'basalt-ui/ui/date-picker'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Segmented } from 'basalt-ui/ui/segmented'
import { Select } from 'basalt-ui/ui/select'
import { Slider } from 'basalt-ui/ui/slider'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { useUnsavedGuard } from '../../../recipes/form-guard'
import {
  ENVIRONMENTS,
  EVENTS,
  LANGUAGES,
  SIZES,
  STRATEGIES,
  TIME_ZONES,
  languageLabel,
  later,
} from './-specimen'
import type { Strategy } from './-specimen'

const LANGUAGE_CODES = LANGUAGES.map((l) => l.value)

type Settings = {
  logo: File[]
  name: string
  slug: string
  about: string
  zone: string | null
  environment: string | null
  autoDeploy: boolean
  strategy: Strategy
  canary: number
  parallel: number | null
  size: string
  events: string[]
  email: string
  languages: string[]
  freeze: CalendarRange | null
  review: CalendarDate | null
}

const SAVED: Settings = {
  logo: [],
  name: 'Acme platform',
  slug: 'acme',
  about: 'The services behind checkout, search and the ledger.',
  zone: 'Europe/Berlin',
  environment: 'production',
  autoDeploy: true,
  strategy: 'rolling',
  canary: 5,
  parallel: 2,
  size: 'm',
  events: ['deploy-failed', 'incident'],
  email: 'oncall@example.com',
  languages: ['en', 'de'],
  freeze: { from: '2026-12-21', to: '2027-01-04' },
  review: '2027-01-15',
}

const NAME = z.string().min(2, 'Use at least 2 characters.')
const SLUG = z
  .string()
  .regex(/^[a-z0-9-]{2,32}$/, 'Use 2 to 32 lowercase letters, digits or dashes.')
const EMAIL = z.email('Enter an address, like oncall@example.com.')
const PARALLEL = z.number('Enter a number.').int().min(1, 'At least 1.').max(10, 'At most 10.')

/**
 * A long settings form: four `FormSection`s of settings rows, one TanStack form across them and one
 * sticky save footer that says when something is unsaved.
 * Leaving with unsaved changes asks first (`useUnsavedGuard`, the playground's form-guard recipe).
 */
export function SettingsForm(): ReactElement {
  const form = useForm({
    // Each field checks on blur, every field on submit, and after a submit on every change, so a fix clears its error
    // and re-enables the primary at once.
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    defaultValues: SAVED,
    onSubmit: async ({ value, formApi }) => {
      await later(600)
      formApi.reset(value)
    },
  })
  const guard = useUnsavedGuard(form)
  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FormSection
        title="General"
        description="How the workspace is named and where it lives. One TanStack form across the four sections, bound through FormField."
      >
        <form.Field name="name" validators={{ onDynamic: NAME }}>
          {(f) => (
            <FormField
              label="Workspace name"
              description="Shown in the header and in emails."
              required
              field={f}
            >
              <Input autoComplete="organization" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="slug" validators={{ onDynamic: SLUG }}>
          {(f) => (
            <FormField label="URL slug" description="example.com/acme" required field={f}>
              <Input autoComplete="off" spellCheck={false} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="logo">
          {(f) => (
            <FormField
              label="Logo"
              description="Square, shown in the header and on invoices."
              field={f}
            >
              <FileUpload accept="image/png,image/svg+xml" maxSize={1_048_576} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="about">
          {(f) => (
            <FormField label="Description" description="Shown to new members." field={f}>
              <Textarea rows={3} autoComplete="off" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="zone">
          {(f) => (
            <FormField label="Time zone" description="Schedules and digests run in it." field={f}>
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
          )}
        </form.Field>
        <form.Field name="environment">
          {(f) => (
            <FormField
              label="Default environment"
              description="Where a new service deploys first."
              field={f}
            >
              <Select aria-label="Default environment" options={ENVIRONMENTS} />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      <FormSection title="Deploys" description="How a merge reaches production.">
        <form.Field name="autoDeploy">
          {(f) => (
            <FormField
              label="Deploy main on push"
              description="A checkbox, not a switch: it applies when the form is saved."
              field={f}
            >
              <Checkbox />
            </FormField>
          )}
        </form.Field>
        <form.Field name="strategy">
          {(f) => (
            <FormField
              label="Rollout"
              description="How a deploy replaces the running version."
              field={f}
            >
              <RadioGroup options={STRATEGIES} />
            </FormField>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.strategy}>
          {(strategy) =>
            strategy === 'canary' ? (
              <form.Field name="canary">
                {(f) => (
                  <FormField
                    label="Canary share"
                    description="Of traffic, before the rest."
                    field={f}
                  >
                    <Slider
                      min={1}
                      max={50}
                      step={1}
                      showValue
                      format={{ style: 'unit', unit: 'percent' }}
                    />
                  </FormField>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>
        <form.Field name="parallel" validators={{ onDynamic: PARALLEL }}>
          {(f) => (
            <FormField
              label="Parallel deploys"
              description="Services that roll out at once."
              required
              field={f}
            >
              <NumberField min={1} max={10} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="size">
          {(f) => (
            <FormField
              label="Instance size"
              description="For new services; each can override it."
              field={f}
            >
              <Segmented options={SIZES} />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      <FormSection title="Notifications" description="Who hears about what.">
        <form.Field name="events">
          {(f) => (
            <FormField label="Notify when" description="Sent to the alert address." field={f}>
              <CheckboxGroup options={EVENTS} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="email" validators={{ onDynamic: EMAIL }}>
          {(f) => (
            <FormField
              label="Alert address"
              description="A team list, not a person."
              required
              field={f}
            >
              <Input type="email" autoComplete="email" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="languages">
          {(f) => (
            <FormField label="Digest languages" description="One digest per language." field={f}>
              <Combobox multiple items={LANGUAGE_CODES} itemToStringLabel={languageLabel}>
                <ComboboxChips
                  aria-label="Digest languages"
                  placeholder="Add a language"
                  itemToLabel={languageLabel}
                />
                <ComboboxContent empty="No language matches.">
                  {(code: string) => (
                    <ComboboxItem key={code} value={code}>
                      {languageLabel(code)}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </FormField>
          )}
        </form.Field>
      </FormSection>
      <FormSection title="Maintenance" description="When nothing ships.">
        <form.Field name="freeze">
          {(f) => (
            <FormField label="Deploy freeze" description="No deploys start in this span." field={f}>
              <DateRangePicker aria-label="Deploy freeze" />
            </FormField>
          )}
        </form.Field>
        <form.Field name="review">
          {(f) => (
            <FormField
              label="Next review"
              description="The owners get a reminder that day."
              field={f}
            >
              <DatePicker aria-label="Next review" />
            </FormField>
          )}
        </form.Field>
      </FormSection>
      <FormFooter
        sticky
        form={form}
        actions={[
          {
            label: 'Discard changes',
            onClick: () => {
              form.reset()
            },
          },
          { label: 'Save settings', primary: true },
        ]}
      />
      {guard}
    </form>
  )
}
