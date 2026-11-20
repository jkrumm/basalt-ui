import { BasaltProvider } from 'basalt-ui/router'
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <BasaltProvider locale="en">
      <Button variant="primary">Save run</Button>
    </BasaltProvider>
  )
}
