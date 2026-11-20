import { Kbd } from 'basalt-ui/ui/kbd'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <p className="m-0 text-sm">
      Open the command palette with <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>, then <Kbd>Enter</Kbd> to run it.
    </p>
  )
}
