import { Stepper } from 'basalt-ui/controls'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Stepper
      aria-label="Plan steps"
      steps={[{ label: 'Basics' }, { label: 'Schedule' }, { label: 'Review' }]}
      current={1}
      className="max-w-3xl"
    />
  )
}
