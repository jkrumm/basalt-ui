/**
 * The installed link: the one `LinkComponent` every link prop renders through. `BasaltProvider
 * link={routerDefaults().link}` installs the router's; without it (no provider, no `link`) a target
 * is a plain `<a>`. A leaf renders `<AppLink href={target}>` for a `string | NavTarget` prop and
 * never builds an anchor of its own.
 *
 * Kept apart from `provider.tsx` so a leaf reads it without the provider, and so the provider
 * chunk pays for a bare context and one function (`provider.budget.test.ts`).
 */
import { createContext, createElement, useContext } from 'react'
import type { ReactNode } from 'react'
import type { LinkComponent } from './ports'

/** A string is an anchor; a `NavTarget` has no plain form, so it renders without a destination. */
const PlainLink: LinkComponent = ({ href, ...rest }) =>
  typeof href === 'string' ? createElement('a', { href, ...rest }) : createElement('a', rest)

export const LinkContext = createContext<LinkComponent>(PlainLink)

/**
 * A link through the installed `LinkComponent`. Internal: leaves render it, apps install the link on
 * `BasaltProvider`. It reads the context and returns the element, so no component is created in a render.
 */
export function AppLink(props: Parameters<LinkComponent>[0]): ReactNode {
  return createElement(useContext(LinkContext), props)
}
