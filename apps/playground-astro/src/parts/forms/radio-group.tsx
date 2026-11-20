import { RadioGroup } from 'basalt-ui/ui/radio-group'
import type { ReactElement } from 'react'

const ROLLOUT = [
  { value: 'all', label: 'All runners' },
  { value: 'canary', label: 'Canary first', description: 'One runner, then the rest.' },
  { value: 'manual', label: 'Manual only' },
]

export function Demo(): ReactElement {
  return (
    <div className="max-w-sm">
      <RadioGroup aria-label="Rollout" options={ROLLOUT} defaultValue="canary" />
    </div>
  )
}
