import { SaveBar } from 'basalt-ui/composite'
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function App(): ReactElement {
  return (
    <main>
      <Button variant="ghost">Refresh</Button>
      <SaveBar label="Save" />
    </main>
  )
}
