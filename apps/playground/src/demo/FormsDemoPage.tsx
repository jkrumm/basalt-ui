/**
 * FormsDemoPage — exercises basalt-ui/forms:
 * useBasaltForm + inputProps/fieldKey + FormErrorSummary + useFormDraft (autosave) with a Valibot
 * schema, laid out through FormSection/FormRow/FormActions — law C1's third home.
 *
 * Demo: a project entry form (name, email, budget) with draft persistence. The draft is autosaved
 * on every value change via `useFormDraft`'s own subscription (`autosave: true`), restored on
 * mount, and cleared on successful submit.
 */
import { Divider, NumberInput, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import type { BarAction } from 'basalt-ui/controls'
import {
  FormActions,
  FormErrorSummary,
  FormRow,
  FormSection,
  fieldKey,
  inputProps,
  useBasaltForm,
  useFormDraft,
} from 'basalt-ui/forms'
import { useState } from 'react'
import * as v from 'valibot'

// ── Schema ────────────────────────────────────────────────────────────────────

const ProjectSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
  email: v.pipe(v.string(), v.email('Enter a valid email address')),
  budget: v.pipe(v.number(), v.minValue(0, 'Budget must be 0 or greater')),
})

type ProjectValues = v.InferOutput<typeof ProjectSchema>

const INITIAL: ProjectValues = { name: '', email: '', budget: 0 }

// ── Form ──────────────────────────────────────────────────────────────────────

function ProjectForm() {
  const [submitted, setSubmitted] = useState<ProjectValues | null>(null)

  const form = useBasaltForm<ProjectValues>({
    initialValues: INITIAL,
    schema: ProjectSchema,
    mode: 'uncontrolled',
  })

  const { hasDraft, clearDraft } = useFormDraft<ProjectValues>(form, {
    key: 'demo-project-form',
    version: 1,
    schema: ProjectSchema,
    autosave: true,
  })

  const handleSubmit = (values: ProjectValues): void => {
    setSubmitted(values)
    clearDraft()
    form.reset()
  }

  const actions: BarAction[] = [
    { key: 'submit', label: 'Submit', onClick: () => form.onSubmit(handleSubmit)() },
    { key: 'validate', label: 'Force validate', onClick: () => form.validate() },
    ...(hasDraft
      ? [
          {
            key: 'clear-draft',
            label: 'Clear draft',
            onClick: () => {
              clearDraft()
              form.reset()
            },
          } satisfies BarAction,
        ]
      : []),
  ]

  return (
    <Stack gap="md">
      {hasDraft && (
        <Text size="sm" c="dimmed">
          Draft restored — your unsaved work has been loaded.
        </Text>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <FormSection title="Project entry">
          <FormErrorSummary form={form} title="Fix these errors before submitting" />

          <FormRow label="Project name">
            <TextInput
              key={fieldKey(form, 'name')}
              {...inputProps(form, 'name')}
              placeholder="My project"
              required
            />
          </FormRow>
          <FormRow label="Contact email">
            <TextInput
              key={fieldKey(form, 'email')}
              {...inputProps(form, 'email')}
              placeholder="you@example.com"
              type="email"
              required
            />
          </FormRow>
          <FormRow label="Budget (USD)">
            <NumberInput
              key={fieldKey(form, 'budget')}
              {...inputProps(form, 'budget')}
              placeholder="0"
              min={0}
              decimalScale={2}
              required
            />
          </FormRow>

          <FormActions actions={actions} />
          <Text size="xs" c="dimmed">
            "Force validate" surfaces all errors before the first submit attempt — useful for guided
            wizards or save-and-review flows where the user hasn't touched every field.
          </Text>
        </FormSection>
      </form>

      {submitted !== null && (
        <>
          <Divider />
          <Text size="sm" fw={600} c="teal">
            Submitted values (draft cleared):
          </Text>
          <Paper p="xs">
            {/* theme-allow: bespoke raw JSON-dump sizing, no matching token */}
            <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(submitted, null, 2)}</pre>
          </Paper>
        </>
      )}
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FormsDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./forms adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          useBasaltForm + inputProps/fieldKey + FormErrorSummary + useFormDraft (autosave), laid out
          through FormSection/FormRow/FormActions
        </Text>
      </div>

      <Paper p="sm">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Behaviour
          </Text>
          <Text size="sm">
            Fill the form and navigate away — your draft is saved automatically on every change.
            Reload the page to see it restored. Submit to clear the draft.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm">
        <ProjectForm />
      </Paper>
    </Stack>
  )
}
