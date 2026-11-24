/**
 * The trial variants' one entry, loaded by `phone-nav.tsx` with `lazy()`: an app that never picks
 * a variant never downloads one.
 */
import type { ReactElement } from 'react'
import type { PhoneNavVariant } from '../variant'
import { PhoneDrawer } from './drawer'
import type { VariantProps } from './host'
import { PhoneTray } from './tray'

export type { VariantProps } from './host'

export function PhoneVariant({
  variant,
  ...props
}: VariantProps & { variant: Exclude<PhoneNavVariant, 'tabs'> }): ReactElement {
  return variant === 'tray' ? <PhoneTray {...props} /> : <PhoneDrawer {...props} />
}
