import { Input } from 'basalt-ui/ui/input'
import type { ReactElement } from 'react'
import { SearchIcon } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <Input aria-label="Run name" defaultValue="Riverside loop" />
      <Input aria-label="Search routes" placeholder="Search a route" start={SearchIcon} />
      <Input aria-label="Distance" defaultValue="12.4" end="km" />
    </div>
  )
}
