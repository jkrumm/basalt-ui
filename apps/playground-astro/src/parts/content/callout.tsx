import { Callout } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Callout tone="warn" title="Heads up">
        <p>This plan adds more than ten percent a week; the second week is the risky one.</p>
      </Callout>
      <Callout tone="info">
        <p>Distances are in kilometres, times in minutes.</p>
      </Callout>
    </div>
  )
}
