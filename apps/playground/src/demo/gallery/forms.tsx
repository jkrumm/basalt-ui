import { Button, Group, NumberInput, Paper, Stack, Text, TextInput } from '@mantine/core'
import { Section } from 'basalt-ui'
import { FormRow } from '../../legacy-form-layout'
import { fieldKey, inputProps, useBasaltForm } from 'basalt-ui/forms'
import { VX } from 'basalt-ui/tokens'
import { useState } from 'react'
import * as v from 'valibot'

const ProjectSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters')),
  email: v.pipe(v.string(), v.email('Enter a valid email address')),
  budget: v.pipe(v.number(), v.minValue(0, 'Budget must be 0 or greater')),
})

type ProjectValues = v.InferOutput<typeof ProjectSchema>

export function FormsSection() {
  const [submitted, setSubmitted] = useState<ProjectValues | null>(null)
  const form = useBasaltForm<ProjectValues>({
    initialValues: { name: '', email: '', budget: 0 },
    schema: ProjectSchema,
    mode: 'uncontrolled',
  })

  const handleSubmit = (values: ProjectValues): void => {
    setSubmitted(values)
    form.reset()
  }

  return (
    <Section title="Form" subtitle="useBasaltForm with a Valibot schema, laid out through FormRow">
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
          {submitted !== null && (
            <Paper>
              <Text size="sm" fw={600}>
                Submitted values
              </Text>
              <pre style={{ margin: 0, fontSize: VX.text.xs }}>
                {JSON.stringify(submitted, null, 2)}
              </pre>
            </Paper>
          )}
        </Stack>
      </form>
    </Section>
  )
}
