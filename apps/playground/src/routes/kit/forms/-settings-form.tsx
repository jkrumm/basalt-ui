import { revalidateLogic, useForm } from '@tanstack/react-form'
import { FormField, FormFooter, FormRow } from 'basalt-ui/controls'
import { Section } from 'basalt-ui/page'
import { Checkbox, CheckboxGroup } from 'basalt-ui/ui/checkbox'
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from 'basalt-ui/ui/combobox'
import { DatePicker, DateRangePicker } from 'basalt-ui/ui/date-picker'
import type { CalendarDate } from 'basalt-ui'
import type { CalendarRange } from 'basalt-ui/ui/date-picker'
import { Fieldset } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { Radio, RadioGroup } from 'basalt-ui/ui/radio-group'
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
  STRATEGY_HINT,
  TIME_ZONES,
  languageLabel,
  later,
} from './-specimen'
import type { Strategy } from './-specimen'

const LANGUAGE_CODES = LANGUAGES.map((l) => l.value)

type Settings = {
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
 * A long settings form: four sections, one TanStack form across them and one save footer at the end.
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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Section
        title="General"
        summary="One TanStack form across the four sections, bound through FormField; saved by the footer at the end."
      >
        <Fieldset className="max-w-2xl">
          <FormRow>
            <form.Field name="name" validators={{ onDynamic: NAME }}>
              {(f) => (
                <FormField label="Workspace name" required field={f}>
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
          </FormRow>
          <form.Field name="about">
            {(f) => (
              <FormField label="Description" description="Shown to new members." field={f}>
                <Textarea rows={3} autoComplete="off" />
              </FormField>
            )}
          </form.Field>
          <FormRow>
            <form.Field name="zone">
              {(f) => (
                <FormField label="Time zone" field={f}>
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
                <FormField label="Default environment" field={f}>
                  <Select aria-label="Default environment" options={ENVIRONMENTS} />
                </FormField>
              )}
            </form.Field>
          </FormRow>
        </Fieldset>
      </Section>
      <Section title="Deploys" summary="How a merge reaches production.">
        <Fieldset className="max-w-2xl">
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
              <FormField label="Rollout" description={STRATEGY_HINT} field={f}>
                <RadioGroup>
                  {STRATEGIES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-sm">
                      <Radio value={s.value} />
                      {s.label}
                    </label>
                  ))}
                </RadioGroup>
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
                        format={{ style: 'unit', unit: 'percent' }}
                      />
                    </FormField>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
          <FormRow>
            <form.Field name="parallel" validators={{ onDynamic: PARALLEL }}>
              {(f) => (
                <FormField label="Parallel deploys" required field={f}>
                  <NumberField min={1} max={10} />
                </FormField>
              )}
            </form.Field>
            <form.Field name="size">
              {(f) => (
                <FormField label="Instance size" field={f}>
                  <Segmented options={SIZES} />
                </FormField>
              )}
            </form.Field>
          </FormRow>
        </Fieldset>
      </Section>
      <Section title="Notifications" summary="Who hears about what.">
        <Fieldset className="max-w-2xl">
          <form.Field name="events">
            {(f) => (
              <FormField label="Notify when" field={f}>
                <CheckboxGroup>
                  {EVENTS.map((e) => (
                    <label key={e.value} className="flex items-center gap-2 text-sm">
                      <Checkbox value={e.value} />
                      {e.label}
                    </label>
                  ))}
                </CheckboxGroup>
              </FormField>
            )}
          </form.Field>
          <form.Field name="email" validators={{ onDynamic: EMAIL }}>
            {(f) => (
              <FormField label="Alert address" required field={f}>
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
        </Fieldset>
      </Section>
      <Section title="Maintenance" summary="When nothing ships.">
        <Fieldset className="max-w-2xl">
          <FormRow>
            <form.Field name="freeze">
              {(f) => (
                <FormField label="Deploy freeze" field={f}>
                  <DateRangePicker aria-label="Deploy freeze" onChange={f.handleChange} />
                </FormField>
              )}
            </form.Field>
            <form.Field name="review">
              {(f) => (
                <FormField label="Next review" field={f}>
                  <DatePicker aria-label="Next review" onChange={f.handleChange} />
                </FormField>
              )}
            </form.Field>
          </FormRow>
        </Fieldset>
      </Section>
      <FormFooter
        className="max-w-2xl"
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
