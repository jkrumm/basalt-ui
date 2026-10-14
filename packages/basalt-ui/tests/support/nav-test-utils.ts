/**
 * Test-only `defineNav` for suites that run WITHOUT the `Register` augmentation: the shipped
 * `defineNav` rejects such a call at compile time (V2-SPEC § 3), and these suites exercise runtime
 * behaviour only. The strict signature is proven in the playground's `nav.type-guard.tsx`.
 */
import { defineNav as strictDefineNav, getActiveNav } from '../../src/router-tanstack/nav'
import type { AnyNavGroup, NavConfig, NavTabId } from '../../src/router-tanstack/nav'

export const defineNav = strictDefineNav as unknown as <
  const G extends ReadonlyArray<AnyNavGroup>,
  const T extends ReadonlyArray<NavTabId<G>> = [],
>(
  config: NavConfig<G, T>,
) => NavConfig<G, T>

/** The nav `defineNav` last stashed, for a suite that registers its own and must put it back. */
export const savedActiveNav = (): ReturnType<typeof getActiveNav> => getActiveNav()

/** Puts back what {@link savedActiveNav} returned (`undefined` clears the stash). */
export function restoreActiveNav(saved: ReturnType<typeof getActiveNav>): void {
  strictDefineNav(saved as never)
}
