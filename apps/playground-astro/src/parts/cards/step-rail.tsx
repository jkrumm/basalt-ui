import { StepRail } from 'basalt-ui/cards'
import type { ReactElement } from 'react'

const NOW = Date.UTC(2026, 10, 20, 12, 0)

export function Demo(): ReactElement {
  return (
    <div className="max-w-xl">
      <StepRail
        label="Deploy steps"
        steps={[
          { id: 'build', label: 'Build image', durationMs: 42_000, at: NOW },
          { id: 'push', label: 'Push image', durationMs: 6_500, at: NOW },
          {
            id: 'probe',
            label: 'Probe /health',
            durationMs: 800,
            at: NOW,
            tone: 'bad',
            detail: 'Timed out on /health',
          },
          { id: 'roll', label: 'Roll out to 25 %', durationMs: 18_000, at: NOW },
        ]}
      />
    </div>
  )
}
