/**
 * Test kit for the rail parts: a memory router (the rows are real router links), the rail control
 * context and a nav runtime double. happy-dom evaluates no container query, so the tests assert the
 * DOM the container-query classes select against, never geometry (that is `tests/layout`).
 */
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { CoreNavConfig, CoreNavItem, CoreNavSection } from '../core/types'
import { RailControlProvider } from './grid'
import type { RailControl } from './grid'

export const control = (collapsed: boolean): RailControl => ({
  state: collapsed ? 'collapsed' : 'expanded',
  collapsed,
  setCollapsed: () => undefined,
  toggle: () => undefined,
})

/** A declared nav item: the `link` is what `navAnchor` reads; the object is the identity. */
export function item(id: string, label: string, extra: Partial<CoreNavItem> = {}): CoreNavItem {
  return { id, label, link: { to: `/${id}` }, ...extra } as CoreNavItem
}

export const section = (
  id: string,
  items: CoreNavItem[],
  extra: Partial<CoreNavSection> = {},
): CoreNavSection => ({ id, label: '', items, ...extra })

export const navOf = (...sections: CoreNavSection[]): CoreNavConfig => ({ sections })

/** Renders `ui` as the root route's component under a memory router, and waits for it to mount. */
export async function renderInRouter(ui: ReactElement, collapsed = false): Promise<RenderResult> {
  const root = createRootRoute({
    component: () => <RailControlProvider value={control(collapsed)}>{ui}</RailControlProvider>,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}
