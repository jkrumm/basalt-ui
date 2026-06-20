/**
 * FormsDemoPage — exercises basalt-ui/forms:
 * createForm + field + FormErrorSummary + useFormDraft with a Valibot schema.
 *
 * Demo: a project entry form (name, email, budget) with draft persistence.
 * Draft is autosaved on every value change (via onValuesChange wired to saveDraft ref),
 * restored on mount, and cleared on successful submit.
 */
import {
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { createForm, field, FormErrorSummary, useFormDraft } from 'basalt-ui/forms'
import { useRef, useState } from 'react'
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

  // saveDraft is stable across renders via the ref pattern below.
  // We hold a ref so we can pass it into createForm's onValuesChange without
  // creating a dependency cycle (form needs saveDraft, useFormDraft needs form).
  const saveDraftRef = useRef<(() => void) | null>(null)

  const form = createForm<ProjectValues>({
    initialValues: INITIAL,
    schema: ProjectSchema,
    mode: 'uncontrolled',
    // Wire autosave: calls saveDraftRef.current on every field change.
    // The ref is populated by useFormDraft after the hook runs (hooks run top-to-bottom,
    // but createForm runs on each render so the ref is always current by the time
    // onValuesChange fires in user interactions — not on the initial render call itself).
    onValuesChange: () => {
      saveDraftRef.current?.()
    },
  })

  const { hasDraft, saveDraft, clearDraft } = useFormDraft<ProjectValues>(form, {
    key: 'demo-project-form',
    version: 1,
    schema: ProjectSchema,
  })

  // Keep saveDraftRef in sync with the stable saveDraft from the hook.
  saveDraftRef.current = saveDraft

  const handleSubmit = (values: ProjectValues): void => {
    setSubmitted(values)
    clearDraft()
    form.reset()
  }

  return (
    <Stack gap="md">
      {/* Draft indicator */}
      {hasDraft && (
        <Text size="sm" c="dimmed">
          Draft restored — your unsaved work has been loaded.
        </Text>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap="sm">
          {/* Accessible error summary — renders null when form is clean */}
          <FormErrorSummary form={form} title="Fix these errors before submitting" />

          <TextInput
            {...field(form, 'name')}
            label="Project name"
            placeholder="My project"
            required
          />
          <TextInput
            {...field(form, 'email')}
            label="Contact email"
            placeholder="you@example.com"
            type="email"
            required
          />
          <NumberInput
            {...field(form, 'budget')}
            label="Budget (USD)"
            placeholder="0"
            min={0}
            decimalScale={2}
            required
          />

          <Group mt="xs">
            <Button type="submit">Submit</Button>
            {hasDraft && (
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  clearDraft()
                  form.reset()
                }}
              >
                Clear draft
              </Button>
            )}
          </Group>
        </Stack>
      </form>

      {submitted !== null && (
        <>
          <Divider />
          <Text size="sm" fw={600} c="teal">
            Submitted values (draft cleared):
          </Text>
          <Paper p="xs" radius="sm" withBorder>
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
          createForm + field + FormErrorSummary + useFormDraft (Valibot schema, draft
          restore/autosave/clear)
        </Text>
      </div>

      <Paper p="sm" radius="md" withBorder>
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

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Project entry form
          </Text>
          <ProjectForm />
        </Stack>
      </Paper>
    </Stack>
  )
}
