import { revalidateLogic, useForm } from '@tanstack/react-form'
import { FormField, FormFooter, Stepper } from 'basalt-ui/controls'
import { Facts, Section } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Checkbox } from 'basalt-ui/ui/checkbox'
import { DateRangePicker } from 'basalt-ui/ui/date-picker'
import type { CalendarRange } from 'basalt-ui/ui/date-picker'
import { Fieldset } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { RadioGroup } from 'basalt-ui/ui/radio-group'
import { Select } from 'basalt-ui/ui/select'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { ENVIRONMENTS, STRATEGIES, TEAMS, later } from './-specimen'
import type { Strategy } from './-specimen'

const STEPS = [
  { label: 'Basics', description: 'Name and owner' },
  { label: 'Schedule', description: 'Window and rollout' },
  { label: 'Review', description: 'Check and create' },
] as const
const LAST = STEPS.length - 1

type Values = {
  name: string
  team: string
  base: string | null
  window: CalendarRange | null
  strategy: Strategy
  confirm: boolean
}

const EMPTY: Values = {
  name: '',
  team: 'platform',
  base: 'staging',
  window: null,
  strategy: 'rolling',
  confirm: false,
}

const NAME = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,30}$/, 'Use 2 to 31 lowercase letters, digits or dashes.')
const PICKED = ({ value }: { value: CalendarRange | null }): string | undefined =>
  value === null ? 'Pick the first and the last day.' : undefined
const CONFIRM = z.literal(true, 'Confirm to create the environment.')

const labelOf = (list: readonly { value: string; label: string }[], value: string | null): string =>
  list.find((o) => o.value === value)?.label ?? 'None'

/**
 * A multi-step flow: one TanStack form, one step mounted at a time, a `Stepper` over it (a done step
 * is a button back to it) and `FormFooter` as Back and Continue.
 * Continue submits the form: the mounted step's fields validate, and the submit meta says whether
 * this is the last step.
 */
export function StepsForm(): ReactElement {
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<string | null>(null)
  const form = useForm({
    // Each field checks on blur, every field on submit, and after a submit on every change, so a fix clears its error
    // and re-enables the primary at once.
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    defaultValues: EMPTY,
    onSubmitMeta: { step: 0 },
    onSubmit: async ({ value, meta }) => {
      if (meta.step < LAST) {
        setStep(meta.step + 1)
        return
      }
      await later(600)
      setCreated(value.name)
    },
  })
  const back = (): void => {
    setStep((s) => Math.max(0, s - 1))
  }
  if (created !== null) {
    return (
      <Section title="Environment created" summary="The flow ends on what it made.">
        <div className="flex flex-col items-start gap-4">
          <p className="m-0 text-sm">{created} is ready. Its first deploy starts in its window.</p>
          <Button
            onClick={() => {
              form.reset()
              setStep(0)
              setCreated(null)
            }}
          >
            Create another
          </Button>
        </div>
      </Section>
    )
  }
  return (
    <Section
      title="New environment"
      summary="One TanStack form across the steps, bound through FormField."
    >
      <form
        noValidate
        className="flex max-w-xl flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit({ step })
        }}
      >
        <Stepper steps={STEPS} current={step} onStepChange={setStep} />
        <Fieldset>
          {step === 0 && (
            <>
              <form.Field name="name" validators={{ onDynamic: NAME }}>
                {(f) => (
                  <FormField
                    label="Environment name"
                    description="Like qa or eu-preview."
                    required
                    field={f}
                  >
                    <Input autoComplete="off" spellCheck={false} />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="team">
                {(f) => (
                  <FormField label="Owning team" field={f}>
                    <Select aria-label="Owning team" options={TEAMS} />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="base">
                {(f) => (
                  <FormField label="Copy settings from" field={f}>
                    <Select aria-label="Copy settings from" options={ENVIRONMENTS} />
                  </FormField>
                )}
              </form.Field>
            </>
          )}
          {step === 1 && (
            <>
              <form.Field name="window" validators={{ onDynamic: PICKED }}>
                {(f) => (
                  <FormField label="First deploy window" required field={f}>
                    <DateRangePicker aria-label="First deploy window" />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="strategy">
                {(f) => (
                  <FormField label="Rollout" field={f}>
                    <RadioGroup options={STRATEGIES} />
                  </FormField>
                )}
              </form.Field>
            </>
          )}
          {step === LAST && (
            <>
              <form.Subscribe selector={(state) => state.values}>
                {(v) => (
                  <Facts
                    rows={[
                      { label: 'Name', value: v.name },
                      { label: 'Team', value: labelOf(TEAMS, v.team) },
                      { label: 'Copied from', value: labelOf(ENVIRONMENTS, v.base) },
                      {
                        label: 'Window',
                        value: v.window === null ? 'None' : `${v.window.from} to ${v.window.to}`,
                      },
                      { label: 'Rollout', value: labelOf(STRATEGIES, v.strategy) },
                    ]}
                  />
                )}
              </form.Subscribe>
              <form.Field name="confirm" validators={{ onDynamic: CONFIRM }}>
                {(f) => (
                  <FormField label="Start the first deploy in its window" field={f}>
                    <Checkbox />
                  </FormField>
                )}
              </form.Field>
            </>
          )}
          {step === 0 ? (
            <FormFooter form={form} actions={[{ label: 'Continue', primary: true }]} />
          ) : (
            <FormFooter
              form={form}
              actions={[
                { label: 'Back', onClick: back },
                { label: step === LAST ? 'Create environment' : 'Continue', primary: true },
              ]}
            />
          )}
        </Fieldset>
      </form>
    </Section>
  )
}
