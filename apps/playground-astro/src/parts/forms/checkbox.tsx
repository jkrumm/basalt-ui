import { Checkbox, CheckboxGroup } from 'basalt-ui/ui/checkbox'
import type { ReactElement } from 'react'

const CHANNELS = [
  { value: 'email', label: 'Email', description: 'One digest per week.' },
  { value: 'push', label: 'Push', description: 'When a run is synced.' },
  { value: 'sms', label: 'Text message' },
]

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <Checkbox defaultChecked aria-label="Include the run map" />
      <CheckboxGroup options={CHANNELS} defaultValue={['email']} />
    </div>
  )
}
