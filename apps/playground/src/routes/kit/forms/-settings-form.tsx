import { FormSection } from 'basalt-ui/controls'
import { useAppForm } from 'basalt-ui/form'
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
  const form = useAppForm({
    // useAppForm checks each field on blur, every field on submit, and after a submit on every change, so a fix
    // clears its error at once.
    defaultValues: SAVED,
    onSubmit: async ({ value, formApi }) => {
      await later(600)
      formApi.reset(value)
    },
  })
  const guard = useUnsavedGuard(form)
  return (
    <form.AppForm>
      <form.Form className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-4">
          <FormSection
            title="General"
            description="How the workspace is named and where it lives. One TanStack form across the four sections, bound through FormField."
          >
            <form.AppField name="name" validators={{ onDynamic: NAME }}>
              {(f) => (
                <f.FormField
                  label="Workspace name"
                  description="Shown in the header and in emails."
                  required
                >
                  <Input autoComplete="organization" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="slug" validators={{ onDynamic: SLUG }}>
              {(f) => (
                <f.FormField label="URL slug" description="example.com/acme" required>
                  <Input autoComplete="off" spellCheck={false} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="logo">
              {(f) => (
                <f.FormField
                  label="Logo"
                  description="Square, shown in the header and on invoices."
                >
                  <FileUpload accept="image/png,image/svg+xml" maxSize={1_048_576} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="about">
              {(f) => (
                <f.FormField label="Description" description="Shown to new members.">
                  <Textarea rows={3} autoComplete="off" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="zone">
              {(f) => (
                <f.FormField label="Time zone" description="Schedules and digests run in it.">
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
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="environment">
              {(f) => (
                <f.FormField
                  label="Default environment"
                  description="Where a new service deploys first."
                >
                  <Select aria-label="Default environment" options={ENVIRONMENTS} />
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <FormSection title="Deploys" description="How a merge reaches production.">
            <form.AppField name="autoDeploy">
              {(f) => (
                <f.FormField
                  label="Deploy main on push"
                  description="A checkbox, not a switch: it applies when the form is saved."
                >
                  <Checkbox />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="strategy">
              {(f) => (
                <f.FormField
                  label="Rollout"
                  description="How a deploy replaces the running version."
                >
                  <RadioGroup options={STRATEGIES} />
                </f.FormField>
              )}
            </form.AppField>
            <form.Subscribe selector={(state) => state.values.strategy}>
              {(strategy) =>
                strategy === 'canary' ? (
                  <form.AppField name="canary">
                    {(f) => (
                      <f.FormField label="Canary share" description="Of traffic, before the rest.">
                        <Slider
                          min={1}
                          max={50}
                          step={1}
                          showValue
                          format={{ style: 'unit', unit: 'percent' }}
                        />
                      </f.FormField>
                    )}
                  </form.AppField>
                ) : null
              }
            </form.Subscribe>
            <form.AppField name="parallel" validators={{ onDynamic: PARALLEL }}>
              {(f) => (
                <f.FormField
                  label="Parallel deploys"
                  description="Services that roll out at once."
                  required
                >
                  <NumberField min={1} max={10} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="size">
              {(f) => (
                <f.FormField
                  label="Instance size"
                  description="For new services; each can override it."
                >
                  <Segmented options={SIZES} />
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <FormSection title="Notifications" description="Who hears about what.">
            <form.AppField name="events">
              {(f) => (
                <f.FormField label="Notify when" description="Sent to the alert address.">
                  <CheckboxGroup options={EVENTS} />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="email" validators={{ onDynamic: EMAIL }}>
              {(f) => (
                <f.FormField
                  label="Alert address"
                  description="A team list, not a person."
                  required
                >
                  <Input type="email" autoComplete="email" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="languages">
              {(f) => (
                <f.FormField label="Digest languages" description="One digest per language.">
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
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <FormSection title="Maintenance" description="When nothing ships.">
            <form.AppField name="freeze">
              {(f) => (
                <f.FormField label="Deploy freeze" description="No deploys start in this span.">
                  <DateRangePicker aria-label="Deploy freeze" />
                </f.FormField>
              )}
            </form.AppField>
            <form.AppField name="review">
              {(f) => (
                <f.FormField label="Next review" description="The owners get a reminder that day.">
                  <DatePicker aria-label="Next review" />
                </f.FormField>
              )}
            </form.AppField>
          </FormSection>
          <form.Footer
            sticky
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
        </div>
      </form.Form>
      {guard}
    </form.AppForm>
  )
}
