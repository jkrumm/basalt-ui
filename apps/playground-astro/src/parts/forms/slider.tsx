import { Slider } from 'basalt-ui/ui/slider'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-6">
      <Slider
        aria-label="Target pace"
        defaultValue={5.5}
        min={4}
        max={8}
        step={0.1}
        format={{ maximumFractionDigits: 1 }}
        showValue
      />
      <Slider
        thumbLabels={['Minimum pace', 'Maximum pace']}
        defaultValue={[5, 6]}
        min={4}
        max={8}
        step={0.1}
        format={{ maximumFractionDigits: 1 }}
        showValue
      />
    </div>
  )
}
