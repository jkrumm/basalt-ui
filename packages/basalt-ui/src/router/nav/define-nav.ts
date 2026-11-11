/**
 * `defineNav`: the one typed navigation declaration. PURE: it returns the config it was given,
 * writes no module global, registers nothing with Spotlight and imports no provider or slot.
 * Registration with a router is `registerNav` (registry.ts), done by the shell.
 *
 * There is deliberately NO compile-time cap on `mobile.tabs.length`: both a
 * `T extends … & { length: 0|1|2|3|4|5 }` constraint and a `tabs: T & MaxFive` form were
 * compile-tested; each makes the length check work but silently degrades `NavTabId` to `string`,
 * killing the far more valuable id-union validation. The cap is a runtime concern of the projector.
 */
import type {
  AnyNavItem,
  AnyNavSection,
  NavConfig,
  NavConfigInput,
  NavTabId,
  RegisteredOr,
} from './types'

/**
 * Declares the whole navigation (sections, pinned items, mobile tuning) as one typed, pure config.
 *
 * @useWhen an app declares its rail, tab bar, breadcrumb and palette destinations once, at module scope
 * @neverWhen the destinations are one-off links with no shared nav (use a plain Link)
 *
 * @example
 * ```ts
 * // src/lib/nav.ts, module scope: anchor identity keys on these objects
 * export const NAV = defineNav({
 *   sections: [
 *     {
 *       id: 'training',
 *       label: 'Training',
 *       items: [
 *         { id: 'overview', label: 'Overview', icon: Gauge, link: linkOptions({ to: '/' }), mobile: 'tab' }, // '/' is always exact
 *         {
 *           id: 'finance', label: 'Finance', short: 'Money', icon: Wallet, exact: true, mobile: 'tab',
 *           link: linkOptions({ to: '/finance' }),
 *           children: [
 *             { id: 'month', label: 'Month', link: linkOptions({ to: '/finance/$month', params: { month: 'latest' } }) },
 *           ],
 *         },
 *         {
 *           id: 'jobs', label: 'Jobs', icon: Play, link: linkOptions({ to: '/jobs' }),
 *           activeWhen: ({ pathname }) => pathname.startsWith('/runs'),
 *         },
 *       ],
 *     },
 *   ],
 *   pinned: [{ id: 'settings', label: 'Settings', icon: Cog, link: linkOptions({ to: '/settings' }), mobile: 'more' }], // rail bottom
 * })
 * ```
 */
export function defineNav<
  const S extends ReadonlyArray<AnyNavSection>,
  const P extends ReadonlyArray<AnyNavItem> = [],
  const T extends ReadonlyArray<NavTabId<{ sections: S; pinned: P }>> = [],
>(config: RegisteredOr<NavConfigInput<S, P, T>>): NavConfig<S, P, T> {
  return config as unknown as NavConfig<S, P, T>
}
