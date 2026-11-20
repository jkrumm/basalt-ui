import { RefreshButton } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <RefreshButton
      scope="page"
      syncing={false}
      lastCompletedAt={Date.UTC(2026, 10, 20, 11, 58)}
      onSync={() => undefined}
    />
  )
}
