import { Stepper } from 'basalt-ui/controls'
import { useAppForm, withForm } from 'basalt-ui/form'
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

const Basics = withForm({
  defaultValues: EMPTY,
  props: {},
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="name" validators={{ onDynamic: NAME }}>
          {(f) => (
            <f.FormField label="Environment name" description="Like qa or eu-preview." required>
              <Input autoComplete="off" spellCheck={false} />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="team">
          {(f) => (
            <f.FormField label="Owning team">
              <Select aria-label="Owning team" options={TEAMS} />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="base">
          {(f) => (
            <f.FormField label="Copy settings from">
              <Select aria-label="Copy settings from" options={ENVIRONMENTS} />
            </f.FormField>
          )}
        </form.AppField>
      </>
    )
  },
})

const Schedule = withForm({
  defaultValues: EMPTY,
  props: {},
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="window" validators={{ onDynamic: PICKED }}>
          {(f) => (
            <f.FormField label="First deploy window" required>
              <DateRangePicker aria-label="First deploy window" />
            </f.FormField>
          )}
        </form.AppField>
        <form.AppField name="strategy">
          {(f) => (
            <f.FormField label="Rollout">
              <RadioGroup options={STRATEGIES} />
            </f.FormField>
          )}
        </form.AppField>
      </>
    )
  },
})

const Review = withForm({
  defaultValues: EMPTY,
  props: {},
  render: function Render({ form }) {
    return (
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
        <form.AppField name="confirm" validators={{ onDynamic: CONFIRM }}>
          {(f) => (
            <f.FormField label="Start the first deploy in its window">
              <Checkbox />
            </f.FormField>
          )}
        </form.AppField>
      </>
    )
  },
})

/**
 * A multi-step flow: one TanStack form, one step mounted at a time, a `Stepper` over it (a done step
 * is a button back to it) and `form.Footer` as Back and Continue.
 * Continue submits the form: the mounted step's fields validate, and the submit meta says whether
 * this is the last step.
 */
export function StepsForm(): ReactElement {
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<string | null>(null)
  const form = useAppForm({
    // useAppForm checks each field on blur, every field on submit, and after a submit on every change, so a fix
    // clears its error at once.
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
    <form.AppForm>
      <Section
        title="New environment"
        summary="One TanStack form across the steps, bound through FormField."
      >
        <form.Form meta={{ step }} className="flex max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-4">
            <Stepper steps={STEPS} current={step} onStepChange={setStep} />
            <Fieldset>
              {step === 0 && <Basics form={form} />}
              {step === 1 && <Schedule form={form} />}
              {step === LAST && <Review form={form} />}
              {step === 0 ? (
                <form.Footer actions={[{ label: 'Continue', primary: true }]} />
              ) : (
                <form.Footer
                  actions={[
                    { label: 'Back', onClick: back },
                    { label: step === LAST ? 'Create environment' : 'Continue', primary: true },
                  ]}
                />
              )}
            </Fieldset>
          </div>
        </form.Form>
      </Section>
    </form.AppForm>
  )
}
