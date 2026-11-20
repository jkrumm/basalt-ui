import { CountBadge, DeltaBadge, Lozenge } from 'basalt-ui/ui/badge'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Lozenge tone="good">Ready</Lozenge>
      <Lozenge tone="warn">Overdue</Lozenge>
      <Lozenge>Draft</Lozenge>
      <CountBadge count={3} />
      <CountBadge count={128} max={99} attention />
      <DeltaBadge value="+12%" polarity="up-good" label="vs last week" />
      <DeltaBadge value="-4" polarity="up-bad" />
    </div>
  )
}
