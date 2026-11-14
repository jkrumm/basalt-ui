// A select under FormField: in a home, clean.
import { FormField } from 'basalt-ui/forms'
import { Select } from 'basalt-ui/ui/select'

export function Unit() {
  return (
    <FormField label="Unit">
      <Select value="kg" />
    </FormField>
  )
}
