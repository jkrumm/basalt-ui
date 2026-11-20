import { useConnection } from 'basalt-ui/data'
import { ConnectionIndicator } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return <ConnectionIndicator connection={useConnection()} />
}
