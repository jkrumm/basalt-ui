/**
 * The seam between the two phone navs: the section bar with its short drawer (the default) and the
 * tab bar an app opts into with `data-phone-nav="tabs"` on `<html>`.
 */
import type { ReactElement } from 'react'
import type { ShellBrand } from '../../contract'
import { PhoneDrawer } from './section-nav/drawer'
import { TabBar } from './tab-bar'
import type { TabBarProps } from './tab-bar'
import type { PhoneNavVariant } from './variant'

export type PhoneNavProps = TabBarProps & {
  variant: PhoneNavVariant
  brand: ShellBrand
  search?: { onOpen: () => void } | undefined
}

export function PhoneNav({ variant, search, brand, ...props }: PhoneNavProps): ReactElement {
  if (variant === 'tabs') return <TabBar {...props} />
  return <PhoneDrawer search={search} brand={brand} {...props} />
}
