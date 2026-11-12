/**
 * The rail: the primary nav at the left edge. A placeholder landmark until v3-shell-i5b-rail
 * replaces this file with the projected rows, blocks, account and settings; the frame already
 * mounts it from `mounts.tsx` with the props below, so that Issue touches only this file.
 */
import type { ReactElement } from 'react'
import type { Account, NavBadges, SettingsConfig, ShellBrand, SidebarBlock } from '../contract'
import type { NavRuntime } from '../core/nav-runtime'
import { SHELL_TEXT } from './a11y'

export type RailProps = {
  runtime: NavRuntime
  brand: ShellBrand
  badges: NavBadges | undefined
  blocks: readonly SidebarBlock[]
  settings: SettingsConfig | undefined
  account: Account | undefined
  search: { onOpen: () => void } | undefined
}

export function Rail(_props: RailProps): ReactElement {
  return (
    <nav
      data-slot="shell-rail"
      aria-label={SHELL_TEXT.primary}
      className="h-full border-e border-border"
    />
  )
}
