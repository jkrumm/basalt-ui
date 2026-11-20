import { Skeleton, Spinner } from 'basalt-ui/ui/skeleton'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div aria-busy="true" className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading runs
      </p>
    </div>
  )
}
