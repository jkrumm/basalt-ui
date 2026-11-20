import { NativeSelect } from 'basalt-ui/ui/select'
import type { ReactElement } from 'react'
import { ENVIRONMENTS } from './fixtures'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-3">
      <NativeSelect
        aria-label="Default environment"
        options={ENVIRONMENTS}
        defaultValue="staging"
      />
      <NativeSelect aria-label="Surface">
        <option value="road">Road</option>
        <option value="trail">Trail</option>
      </NativeSelect>
    </div>
  )
}
