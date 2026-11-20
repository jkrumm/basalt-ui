import { Field, Fieldset, FieldsetLegend, Form } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Form className="max-w-sm">
      <Fieldset>
        <FieldsetLegend>Runner</FieldsetLegend>
        <Field label="Name" description="Shown on the run list.">
          <Input defaultValue="Maya Lind" />
        </Field>
        <Field label="Email" error="Enter an address with an @.">
          <Input defaultValue="maya.lind" aria-invalid />
        </Field>
      </Fieldset>
    </Form>
  )
}
