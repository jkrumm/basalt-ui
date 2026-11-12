/**
 * The phone tab bar: the primary nav at the bottom edge. A placeholder landmark until
 * v3-shell-i6-tabbar replaces this file with the projected tabs and the More surface; the frame
 * already mounts it from `mounts.tsx` with the props below, so that Issue touches only this tree.
 */
import type { ReactElement } from 'react'
import type { Account, GlobalAction, NavBadges, SettingsConfig, SidebarBlock } from '../../contract'
import type { NavRuntime } from '../../core/nav-runtime'
import { SHELL_TEXT } from '../a11y'

export type TabBarProps = {
  runtime: NavRuntime
  badges: NavBadges | undefined
  blocks: readonly SidebarBlock[]
  globalActions: readonly GlobalAction[]
  settings: SettingsConfig | undefined
  account: Account | undefined
}

export function TabBar(_props: TabBarProps): ReactElement {
  return <nav data-slot="shell-tab-bar" aria-label={SHELL_TEXT.primary} />
}
