/**
 * Compile-time proof of the `menu` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The names `anchor`,
 * `finalFocus` and `closeOnClick` are the contract (the removed line below).
 */
import { describe, expect, test } from 'bun:test'
import { menuContentVariants, menuItemVariants } from './menu'
import {
  requiresMenu,
  requiresMenuCheckboxItem,
  requiresMenuContent,
  requiresMenuItem,
  requiresMenuRadioGroup,
  requiresMenuSub,
} from './menu.guard'

type CalledContent = Parameters<typeof requiresMenuContent>[0]
type Accepts<P> = (c: CalledContent) => P

type WithoutAnchor = {
  side?: 'top' | 'bottom' | 'left' | 'right' | undefined
  align?: 'start' | 'center' | 'end' | undefined
  sideOffset?: number | undefined
  finalFocus?: boolean | undefined
}

// @ts-expect-error `anchor` is called but no longer accepted
export const removed: Accepts<WithoutAnchor> = requiresMenuContent

describe('menu guard', () => {
  test('the requires functions pass through and the tables resolve', () => {
    expect(requiresMenu({ open: true })).toEqual({ open: true })
    expect(requiresMenuContent({ side: 'bottom', finalFocus: false })).toEqual({
      side: 'bottom',
      finalFocus: false,
    })
    expect(requiresMenuItem({ closeOnClick: false })).toEqual({
      closeOnClick: false,
    })
    expect(requiresMenuCheckboxItem({ checked: true })).toEqual({
      checked: true,
    })
    expect(requiresMenuRadioGroup({ value: 'a' })).toEqual({ value: 'a' })
    expect(requiresMenuSub({ label: 'Move to' })).toEqual({ label: 'Move to' })
    expect(menuContentVariants()).toContain('max-h-(--available-height)')
    expect(menuItemVariants()).toContain('pointer-coarse:min-h-11')
  })
})
