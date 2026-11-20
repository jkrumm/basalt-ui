import { Button } from 'basalt-ui/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from 'basalt-ui/ui/popover'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" />}>Last 7 days</PopoverTrigger>
      <PopoverContent aria-label="Date range" className="w-72">
        <p className="m-0 text-sm">Pick a range to narrow the run list.</p>
      </PopoverContent>
    </Popover>
  )
}
