import type { ReactNode } from 'react'
import { ViewTabs } from '../controls/view-tabs'
import type { PageTabs } from './contract'

/** True when `tabs` draws nothing: unset, or a slot with no controls. A handle always draws. */
export function isEmptyTabs<K extends string>(tabs: PageTabs<K> | undefined): boolean {
  return tabs === undefined || ('kind' in tabs && tabs.count === 0)
}

/** The node a `PageBar` or `Section` puts in its tabs home: the slot's own, or a `ViewTabs` on the handle. */
export function renderTabs<K extends string>(tabs: PageTabs<K> | undefined): ReactNode {
  if (tabs === undefined) return null
  if ('kind' in tabs) return tabs.render()
  // oxlint-disable-next-line basalt/bound-control-outside-home -- this is the tabs home: the one place `PageBar.tabs` and `Section.tabs` draw their ViewTabs
  return <ViewTabs handle={tabs.handle} label={tabs.label} />
}
