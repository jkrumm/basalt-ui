// App code outside components/ui: never adoptable.
import type { ReactElement } from 'react'

export function StatusChip({ label }: { label: string }): ReactElement {
  return <span data-slot="status-chip">{label}</span>
}
