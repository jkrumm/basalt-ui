import { Textarea } from 'basalt-ui/ui/textarea'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <Textarea
        aria-label="Run notes"
        rows={3}
        defaultValue={'Felt strong on the hill.\nLegs heavy after km 12.'}
      />
      <Textarea aria-label="Group message" rows={2} placeholder="Write a note for the group" />
    </div>
  )
}
