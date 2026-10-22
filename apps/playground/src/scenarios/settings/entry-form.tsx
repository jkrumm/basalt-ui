/**
 * S6 part (b): the set-logging entry form (the shape of argo's workout form), on `basalt-ui/forms`
 * and `FormRow`/`FormGroup`. Sections are `FormGroup section`; the action row is a recipe here
 * (`FormActions` is not exported).
 */
import {
  Button,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core'
import { FormGroup, FormRow } from 'basalt-ui/controls'
import { fieldKey, inputProps, useBasaltForm } from 'basalt-ui/forms'
import { useSizeClass } from 'basalt-ui'
import * as v from 'valibot'
import { noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { EXERCISES, REPS_ERROR } from './settings-data'
import classes from './entry-form.module.css'

const SetSchema = v.object({
  exercise: v.pipe(v.string(), v.minLength(1, 'Pick an exercise.')),
  date: v.pipe(v.string(), v.minLength(1, 'Pick a date.')),
  weight: v.pipe(v.number(), v.minValue(0, 'Weight cannot be negative.')),
  reps: v.pipe(
    v.number(),
    v.integer(REPS_ERROR),
    v.minValue(1, REPS_ERROR),
    v.maxValue(30, REPS_ERROR),
  ),
  warmup: v.boolean(),
  notes: v.string(),
})
type SetValues = v.InferOutput<typeof SetSchema>

const INITIAL: SetValues = {
  exercise: 'Back squat',
  date: '2026-10-22',
  weight: 100,
  reps: 0,
  warmup: false,
  notes: '',
}

function EntryActions() {
  const compact = useSizeClass() === 'compact'
  return (
    <div className={classes.actions} {...(compact && { 'data-sticky': '' })}>
      <Button variant="default" onClick={noop}>
        Cancel
      </Button>
      <Button type="submit">Save set</Button>
    </div>
  )
}

function EntryFormFields() {
  const form = useBasaltForm<SetValues>({
    initialValues: INITIAL,
    schema: SetSchema,
    initialErrors: { reps: REPS_ERROR },
  })
  return (
    <form onSubmit={form.onSubmit(noop)} noValidate>
      <FormGroup label="Set" section>
        <FormRow label="Exercise" htmlFor="set-exercise" required>
          <Select
            id="set-exercise"
            data={EXERCISES}
            allowDeselect={false}
            key={fieldKey(form, 'exercise')}
            {...inputProps(form, 'exercise')}
          />
        </FormRow>
        <FormRow label="Date" htmlFor="set-date" required>
          <TextInput
            id="set-date"
            type="date"
            key={fieldKey(form, 'date')}
            {...inputProps(form, 'date')}
          />
        </FormRow>
      </FormGroup>
      <FormGroup label="Load" section>
        <FormRow label="Weight" htmlFor="set-weight" hint="The bar and plates, in kg.">
          <NumberInput
            id="set-weight"
            size="ctl"
            suffix=" kg"
            min={0}
            step={2.5}
            decimalScale={1}
            inputMode="decimal"
            key={fieldKey(form, 'weight')}
            {...inputProps(form, 'weight')}
          />
        </FormRow>
        <FormRow label="Reps" htmlFor="set-reps" required>
          <NumberInput
            id="set-reps"
            size="ctl"
            min={1}
            max={30}
            inputMode="numeric"
            key={fieldKey(form, 'reps')}
            {...inputProps(form, 'reps')}
          />
        </FormRow>
      </FormGroup>
      <FormGroup label="Notes" section>
        <FormRow
          label="Warm-up set"
          htmlFor="set-warmup"
          hint="Warm-ups stay out of the volume total."
        >
          <Switch
            id="set-warmup"
            aria-label="Warm-up set"
            key={fieldKey(form, 'warmup')}
            {...inputProps(form, 'warmup', { type: 'checkbox' })}
          />
        </FormRow>
        <FormRow label="Notes" htmlFor="set-notes">
          <Textarea
            id="set-notes"
            autosize
            minRows={3}
            key={fieldKey(form, 'notes')}
            {...inputProps(form, 'notes')}
          />
        </FormRow>
      </FormGroup>
      <EntryActions />
    </form>
  )
}

/** Row heights per section: the notes field is the one tall control. */
const SKELETON_ROWS = [
  [32, 32],
  [32, 32],
  [32, 76],
]

/** The form's own shape in grey: a title and its rows per section. */
function EntrySkeleton() {
  return (
    <Stack gap="xl" aria-busy="true">
      {SKELETON_ROWS.map((heights, s) => (
        <Stack key={s} gap="md">
          <Skeleton height={16} width={80} radius="sm" />
          {heights.map((h, i) => (
            <Skeleton key={i} height={h} radius="md" />
          ))}
        </Stack>
      ))}
    </Stack>
  )
}

export function EntryForm({ shotState }: ScenarioProps) {
  return shotState === 'loading' ? <EntrySkeleton /> : <EntryFormFields />
}
