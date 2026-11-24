/**
 * What the section bar's parts share: their props (the tab bar's plus the shell's brand and search, which
 * the rail behind More draws), the projection input read from the runtime, and the link a one-item
 * section slot renders.
 */
import { useRouter } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { navAnchor } from '../../../../router/nav/anchor'
import type { ShellBrand } from '../../../contract'
import type { PhoneProjectionInput, PhoneRow } from '../../../core/mobile-projection'
import type { NavState } from '../../../core/nav-runtime'
import type { BadgeMap } from '../../../core/types'
import { retap } from '../retap'
import type { TabBarProps } from '../tab-bar'

export type VariantProps = TabBarProps & {
  brand: ShellBrand
  /** The shell's search: the rail behind More draws its search row from it. */
  search?: { onOpen: () => void } | undefined
}

export function useNavState(props: VariantProps): NavState {
  return useSyncExternalStore(
    props.runtime.subscribe,
    props.runtime.getState,
    props.runtime.getState,
  )
}

export function projectionInput(props: VariantProps, state: NavState): PhoneProjectionInput {
  return {
    nav: props.runtime.nav,
    state,
    ...(props.badges !== undefined && { badges: props.badges as BadgeMap }),
  }
}

/** A destination slot: the item's own router anchor, with the retap law of the tab bar. */
export function SlotLink({
  row,
  label,
  className,
  children,
}: {
  row: PhoneRow
  label: string
  className: string
  children: ReactNode
}): ReactElement {
  const router = useRouter()
  const Anchor = navAnchor(row.item)
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    retap(row, event, router.state.location.href)
  }
  return (
    // oxlint-disable-next-line react/static-components -- `navAnchor` is cached per item object: one stable component type
    <Anchor
      aria-label={label}
      aria-current={row.active ? 'page' : undefined}
      data-active={row.active ? '' : undefined}
      className={className}
      onClick={onClick}
    >
      {children}
    </Anchor>
  )
}
