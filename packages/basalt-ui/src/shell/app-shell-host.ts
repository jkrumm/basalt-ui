/**
 * The shell's side of the page: the `PageHost` that `PageBar` and `PageAside` claim regions through
 * (concept sections 3.2 and 4, invariants 20, 21, 23).
 *
 * Each region is a claim store, newest owner wins, so a route change that mounts the incoming
 * page's claim before the outgoing page's cleanup runs never shows a gap or a stale node. The band
 * height is not state: it is written straight onto the shell root as `--page-bar-h`, before paint,
 * because the aside header beside the band has to land on the band's bottom edge in the same frame
 * (spike S1: a mirror that arrives a render later puts the seam 32 px off).
 *
 * Internal: `AppShell` creates one per mount and provides `host` through `PageHostContext`.
 */
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { PageHost, PageRegion } from '../core/ports'
import { createClaimStore } from '../page/core/claims'
import type { ClaimStore } from '../page/core/claims'

export const BAR_HEIGHT_VAR = '--page-bar-h'

export type ShellRegions = {
  readonly actions: ClaimStore<ReactNode>
  readonly breadcrumb: ClaimStore<ReactNode>
  readonly aside: ClaimStore<ReactNode>
  readonly title: ClaimStore<ReactNode>
}

export type ShellHost = {
  readonly host: PageHost
  readonly regions: ShellRegions
  /** The shell root: where the band height is mirrored. Attached by the root's ref callback. */
  attachRoot(el: HTMLElement | null): void
}

export function createShellHost(): ShellHost {
  const regions: ShellRegions = {
    actions: createClaimStore<ReactNode>({ policy: 'newest' }),
    breadcrumb: createClaimStore<ReactNode>({ policy: 'newest' }),
    aside: createClaimStore<ReactNode>({ policy: 'newest' }),
    title: createClaimStore<ReactNode>({ policy: 'newest' }),
  }
  let root: HTMLElement | null = null
  let height = 0

  const apply = (): void => {
    if (root === null) return
    if (height > 0) root.style.setProperty(BAR_HEIGHT_VAR, `${height}px`)
    else root.style.removeProperty(BAR_HEIGHT_VAR)
  }

  const host: PageHost = {
    claim(region: PageRegion, node: ReactNode, id: string) {
      return regions[region].claim(id, node).release
    },
    setBarHeight(px: number) {
      height = px
      apply()
    },
  }

  return {
    host,
    regions,
    attachRoot(el) {
      root = el
      apply()
    },
  }
}

/** The node the region's owner claimed, or `undefined` while it is unclaimed. */
export function useClaim(store: ClaimStore<ReactNode>): ReactNode | undefined {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().owner?.value,
    () => undefined,
  )
}
