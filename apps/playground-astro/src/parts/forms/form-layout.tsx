import { FormField, FormFooter, FormRow, FormSection } from 'basalt-ui/controls'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'
import { staticField, staticForm } from './fixtures'

const title = staticField('Morning loop')
const distance = staticField(12.4)
const pace = staticField('5:40')
const notes = staticField('Felt strong on the hill.')
const form = staticForm({
  title: 'Morning loop',
  distance: 12.4,
  pace: '5:40',
  notes: 'Felt strong on the hill.',
})

export function Demo(): ReactElement {
  return (
    <FormSection
      title="Run"
      description="What the run is called and how far it went."
      footer={
        <FormFooter form={form} actions={[{ label: 'Cancel' }, { label: 'Save', primary: true }]} />
      }
      className="max-w-3xl"
    >
      <FormField label="Title" required field={title}>
        <Input />
      </FormField>
      <FormRow legend="Split">
        <FormField label="Distance (km)" field={distance}>
          <NumberField locale="de-DE" />
        </FormField>
        <FormField label="Pace" field={pace}>
          <Input />
        </FormField>
      </FormRow>
      <FormField label="Notes" description="Shown on the run." field={notes}>
        <Textarea />
      </FormField>
    </FormSection>
  )
}
