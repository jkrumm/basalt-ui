import { EmptyState } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <EmptyState
      title="No runs yet"
      cause="Start one from the CLI."
      action={{ label: 'Open docs', href: '/docs' }}
    />
  )
}
