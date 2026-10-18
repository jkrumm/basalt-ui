/**
 * FormsDemoPage — exercises basalt-ui/forms:
 * useBasaltForm + inputProps/fieldKey with a Valibot schema, laid out through FormRow
 * (basalt-ui/controls) — law C1's third home.
 *
 * Demo: a project entry form (name, email, budget).
 */
import { Button, Divider, Group, NumberInput, Paper, Stack, Text, TextInput } from '@mantine/core'
import { FormRow } from 'basalt-ui/controls'
import { VX } from 'basalt-ui/tokens'
import { fieldKey, inputProps, useBasaltForm } from 'basalt-ui/forms'
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

  const handleSubmit = (values: ProjectValues): void => {
    setSubmitted(values)
    form.reset()
  }

  return (
    <Stack gap="md">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap="sm" data-compare="form">
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

          <Group gap="xs">
            <Button type="submit">Submit</Button>
            <Button type="button" variant="default" onClick={() => form.validate()}>
              Force validate
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            "Force validate" surfaces all errors before the first submit attempt — useful for guided
            wizards or save-and-review flows where the user hasn't touched every field.
          </Text>
        </Stack>
      </form>

      {submitted !== null && (
        <>
          <Divider />
          <Text size="sm" fw={600} c="blue">
            Submitted values:
          </Text>
          <Paper>
            <pre style={{ margin: 0, fontSize: VX.text.xs }}>
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </Paper>
        </>
      )}
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FormsDemoPage() {
  return (
    <Stack gap="md">
      {/* No in-body `<Title>` — the breadcrumb names the page; the subpath the page demos is
          stated in the lead instead (ComponentsPage's module doc has the wave's rule). */}
      <Text size="sm" c="dimmed">
        <code>./forms</code>: useBasaltForm + inputProps/fieldKey, laid out through FormRow
      </Text>

      <Paper>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Behaviour
          </Text>
          <Text size="sm">Submit with invalid values to see each field's schema error inline.</Text>
        </Stack>
      </Paper>

      <Paper>
        <ProjectForm />
      </Paper>
    </Stack>
  )
}
