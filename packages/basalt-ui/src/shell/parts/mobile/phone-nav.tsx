/**
 * The seam between the shipped tab bar and the trial variants (Issue 3205). With no variant picked
 * it renders `TabBar` with exactly the props it always had; a picked variant loads with `lazy()`,
 * so an app that never picks one pays nothing for them in the chunk it loads.
 */
import { Suspense, lazy } from 'react'
import type { ReactElement } from 'react'
import type { ShellBrand } from '../../contract'
import { TabBar } from './tab-bar'
import type { TabBarProps } from './tab-bar'
import type { PhoneNavVariant } from './variant'

const LazyVariant = lazy(async () => ({
  default: (await import('./variants/index')).PhoneVariant,
}))

export type PhoneNavProps = TabBarProps & {
  variant: PhoneNavVariant
  brand: ShellBrand
  search?: { onOpen: () => void } | undefined
}

export function PhoneNav({ variant, search, brand, ...props }: PhoneNavProps): ReactElement {
  if (variant === 'tabs') return <TabBar {...props} />
  return (
    <Suspense fallback={null}>
      <LazyVariant variant={variant} search={search} brand={brand} {...props} />
    </Suspense>
  )
}
