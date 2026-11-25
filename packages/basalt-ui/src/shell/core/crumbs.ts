/**
 * The breadcrumb trail as data: pure, no router, no React. The shell feeds it the flattened nav, the
 * active item, the pathname, the matched routes that carry a `staticData.title` and the page's own
 * claim (its `PageBar` `title` and `parent`); the header part draws the result.
 *
 * Order: the nav section (text: a section is no route), the active item's ancestors in the nav's
 * children tree, then every strict path prefix of the pathname that a nav item or a matched route
 * names, shallowest first, then the page's `parent`, then the leaf. An ancestor is a link; the leaf
 * is the page on screen and is not. A label already in the trail is not repeated, and a `parent`
 * whose path an ancestor already links to takes that ancestor's place: the page names its own way
 * up. The leaf is the page's `title` when it
 * claimed one (a record route ends on its record's name), else the nav label. A compact screen keeps
 * the nearest ancestor and the leaf: the rest is a tab away there.
 */
import type { NavTarget } from '../../core/ports'

/** A nav item as the trail reads it: the router's `FlatNavEntry` fits, structurally. */
export type CrumbNavItem = {
  readonly id: string
  readonly label: string
  readonly link: { readonly to: string; readonly params?: unknown }
}

export type CrumbNavEntry = {
  readonly item: CrumbNavItem
  readonly ancestors: readonly CrumbNavItem[]
  readonly section: string | undefined
}

/** A matched route that names itself: its concrete pathname and its `staticData.title`. */
export type CrumbRoute = { readonly pathname: string; readonly title: string }

/** What the page claimed through its `PageBar`. */
export type CrumbClaim = {
  readonly title: string
  readonly parent?: { readonly label: string; readonly href: string | NavTarget } | undefined
}

export type CrumbAncestor =
  | { readonly kind: 'nav'; readonly label: string; readonly item: CrumbNavItem }
  | { readonly kind: 'href'; readonly label: string; readonly href: string | NavTarget }

export type CrumbTrail = {
  readonly section: string | undefined
  readonly ancestors: readonly CrumbAncestor[]
  readonly leaf: string | undefined
}

export type CrumbInput = {
  readonly entries: readonly CrumbNavEntry[]
  readonly activeId: string | undefined
  /** The pathname, each segment decoded (`decodePath`), as every path here is compared. */
  readonly pathname: string
  /** The decoded path a nav item links to against the pathname (`navItemPath`): the router's matcher. */
  readonly pathOf: (item: CrumbNavItem) => string | undefined
  readonly routes: readonly CrumbRoute[]
  readonly claim: CrumbClaim | undefined
  /** The leaf without a claim: the nav label, or `Not found`. */
  readonly fallbackLabel: string | undefined
  readonly compact: boolean
  /** No route matched: the trail is the leaf alone. */
  readonly missing: boolean
}

const segmentsOf = (path: string): string[] => path.split('/').filter(Boolean)

const normalize = (path: string): string => `/${segmentsOf(path).join('/')}`

export function buildCrumbs(input: CrumbInput): CrumbTrail {
  const leaf = input.missing ? input.fallbackLabel : (input.claim?.title ?? input.fallbackLabel)
  if (input.missing) return { section: undefined, ancestors: [], leaf }

  const active = input.entries.find((entry) => entry.item.id === input.activeId)
  const ancestors: CrumbAncestor[] = []
  // The path each ancestor links to, where it is known: a `NavTarget` keeps its path to itself.
  const paths: (string | undefined)[] = []
  const pathOf = (crumb: CrumbAncestor): string | undefined =>
    crumb.kind === 'nav'
      ? input.pathOf(crumb.item)
      : typeof crumb.href === 'string'
        ? normalize(crumb.href.split(/[?#]/)[0]!)
        : undefined
  const push = (crumb: CrumbAncestor): void => {
    if (crumb.label === leaf || ancestors.some((a) => a.label === crumb.label)) return
    ancestors.push(crumb)
    paths.push(pathOf(crumb))
  }

  for (const item of active?.ancestors ?? []) push({ kind: 'nav', label: item.label, item })

  const path = segmentsOf(input.pathname)
  for (let depth = 1; depth < path.length; depth += 1) {
    const prefix = `/${path.slice(0, depth).join('/')}`
    const navHit = input.entries.find((entry) => input.pathOf(entry.item) === prefix)
    if (navHit !== undefined) {
      push({ kind: 'nav', label: navHit.item.label, item: navHit.item })
      continue
    }
    const route = input.routes.find((r) => normalize(r.pathname) === prefix)
    // The prefix is decoded for comparison; the link encodes each segment again, so a `?` or `#` in
    // one stays part of the path.
    const href = `/${path.slice(0, depth).map(encodeURIComponent).join('/')}`
    if (route !== undefined) push({ kind: 'href', label: route.title, href })
  }

  const parent = input.claim?.parent
  if (parent !== undefined) {
    const crumb: CrumbAncestor = { kind: 'href', label: parent.label, href: parent.href }
    const path = pathOf(crumb)
    const same = path === undefined ? -1 : paths.indexOf(path)
    if (same !== -1) ancestors[same] = crumb
    else push(crumb)
  }

  if (input.compact) return { section: undefined, ancestors: ancestors.slice(-1), leaf }
  return { section: active?.section, ancestors, leaf }
}
