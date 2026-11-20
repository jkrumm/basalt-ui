import { Button } from 'basalt-ui/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'basalt-ui/ui/collapsible'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Collapsible className="max-w-md">
      <CollapsibleTrigger render={<Button variant="ghost" />}>Advanced options</CollapsibleTrigger>
      <CollapsibleContent>
        <p className="m-0 text-sm">Retry failed runs three times with a 30 s backoff.</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
