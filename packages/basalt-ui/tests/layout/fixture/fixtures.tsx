import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { BasaltDataTable } from '../../../src/data'
import type { ColumnDef } from '../../../src/data'
import { BasaltShell, PageAside, PageBar } from '../../../src/index'
import type { NavAnchor, SidebarItem, SidebarSection } from '../../../src/nav/types'
import type { AsideSpec, FixtureSpec, ItemSpec, TableSpec } from './spec'

/** A consumer-sized (18px) glyph — the bar normalizes it to `--vx-space-mobile-nav-icon-size` in
 *  CSS, which is part of what the geometry assertions cover. */
function Glyph(): ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={8} fill="currentColor" />
    </svg>
  )
}

/**
 * Stands in for the consumer's router `Link`, and is built PER PATH because that is what a real
 * one is: `BasaltShell` passes an `Anchor` only chrome props (className, aria-*, onClick) and
 * never the item's `href` — the router seam assumes the Link closes over its own destination.
 * Memoized so the component identity survives a remount and React does not tear the tree down.
 *
 * VERIFIED THE HARD WAY: a version that spread `props` and read `props.href` recorded `""` on
 * every tap, because that href never arrives. Invariant 3 would have passed vacuously.
 *
 * The handler composes the caller's FIRST and returns early when `defaultPrevented`, verbatim
 * @tanstack/react-router semantics — which is what the "re-tap the active slot scrolls instead of
 * navigating" rule depends on. Recording the path is what lets a test assert the tap REACHED the
 * page as well as raised nothing.
 */
const anchors = new Map<string, NavAnchor>()

function anchorFor(path: string): NavAnchor {
  const cached = anchors.get(path)
  if (cached) return cached
  const Anchor: NavAnchor = (props) => (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the shell supplies children and keyboard semantics through `props`; oxlint cannot see them through the spread
    <a
      {...props}
      href={path}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        window.basaltNavigations.push(path)
      }}
    />
  )
  anchors.set(path, Anchor)
  return Anchor
}

const toItem = (spec: ItemSpec, icons: boolean): SidebarItem => ({
  key: spec.key,
  label: spec.label,
  // `icon` is a REQUIRED field carrying a `ReactNode`, so an icon-less consumer passes
  // `undefined` — exactly what `useNav` produces for an item that omits it (image-share's real
  // shape). Dropping the key entirely would not type-check and is not the configuration.
  icon: icons ? <Glyph /> : undefined,
  href: `/${spec.key}`,
  Anchor: anchorFor(`/${spec.key}`),
  ...(spec.short !== undefined && { short: spec.short }),
  ...(spec.mobile !== undefined && { mobile: spec.mobile }),
  ...(spec.active !== undefined && { active: spec.active }),
  ...(spec.disabled !== undefined && { disabled: spec.disabled }),
  ...(spec.count !== undefined && { count: spec.count }),
  ...(spec.children !== undefined && {
    children: spec.children.map((child) => toItem(child, icons)),
  }),
})

// ── The data table ────────────────────────────────────────────────────────────────────────────

type TableRow = { id: number; name: string; value: number }

/** Two plain accessor columns — the invariant is the header's POSITION, not what a cell renders. */
const TABLE_COLUMNS: ColumnDef<TableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'value', header: 'Value' },
]

const tableRows = (n: number): TableRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i + 1}`, value: i * 3 }))

/**
 * The REAL `BasaltDataTable`, mounted with the props a consumer pairs on a scrolling body. The
 * page-level `stickyHeaderOffset` is passed on purpose: it is the prop that used to reach Mantine
 * and park the `<thead>` mid-body.
 */
function TableFixture({ spec }: { spec: TableSpec }): ReactElement {
  return (
    <BasaltDataTable
      data={tableRows(spec.rows)}
      columns={TABLE_COLUMNS}
      stickyHeader
      {...(spec.maxHeight !== undefined && { maxHeight: spec.maxHeight })}
      {...(spec.minWidth !== undefined && { minWidth: spec.minWidth })}
      {...(spec.stickyHeaderOffset !== undefined && {
        stickyHeaderOffset: spec.stickyHeaderOffset,
      })}
    />
  )
}

// ── The aside ─────────────────────────────────────────────────────────────────────────────────

/**
 * Called by the fixture host before every mount, so each `remount(spec)` counts from zero.
 *
 * The counters live on `window`, not in module state, because a test has to read them while
 * NOTHING is mounted — the phone projection renders no node at all until its sheet is opened, and
 * "the children were never mounted before that" is half the invariant.
 */
export function resetAsideMounts(): void {
  window.basaltAsideMounts = { total: 0, live: 0 }
}

/**
 * The aside's payload, counting its own mounts.
 *
 * `live` is how many instances exist RIGHT NOW: a CSS-only responsive twin — the shape law C9
 * mandates for every other control — would render this component in both halves and `live` would
 * be 2, with every bound control beside it subscribed to its field twice. `total` is the
 * page-lifetime ordinal, so a projection that tears the subtree down and rebuilds it reads 2 even
 * though `live` never left 1. `data-mounts` mirrors the ordinal onto the node itself, so a failure
 * says which of the two shapes it was without a second query.
 */
function AsideProbe(): ReactElement {
  const [mounts, setMounts] = useState(0)
  useEffect(() => {
    const counts = window.basaltAsideMounts
    counts.total += 1
    counts.live += 1
    setMounts(counts.total)
    return () => {
      counts.live -= 1
    }
  }, [])
  return (
    <div data-testid="aside-probe" data-mounts={mounts}>
      Composition
    </div>
  )
}

/**
 * A row-2 payload, so `PageBar` publishes the `panelHost` claim the phone projection hangs its
 * `Panel` pill off. Deliberately NOT a bound control: this fixture measures where the aside goes,
 * and a store would put a second stateful thing in the tree that the mount count would then have
 * to account for.
 */
function AsideBar(): ReactElement {
  return <PageBar filters={<span data-testid="bar-filters">Filters</span>} />
}

function AsideFixture({ spec }: { spec: AsideSpec }): ReactElement {
  return (
    <PageAside title={spec.title}>
      <AsideProbe />
    </PageAside>
  )
}

export function ShellFixture({ spec }: { spec: FixtureSpec }): ReactElement {
  const icons = spec.icons ?? true
  const sections: SidebarSection[] = spec.sections.map((section) => ({
    label: section.label,
    items: section.items.map((item) => toItem(item, icons)),
    ...(section.tab ? { mobile: { tab: true as const } } : {}),
  }))
  return (
    <BasaltShell
      brand={{ name: 'Fixture' }}
      sections={sections}
      {...(spec.nav && { mobileNav: spec.nav })}
    >
      {spec.aside && <AsideBar />}
      {spec.table && <TableFixture spec={spec.table} />}
      {/* theme-allow -- a measured filler height IS the fixture's payload, not a themed size */}
      <div style={{ height: spec.bodyHeight ?? 0 }} />
      <div data-testid="content-end">end of content</div>
      {/* Written AFTER the main column on purpose — that is the order the in-flow mobile form
          inherits, and the order a consumer page uses. */}
      {spec.aside && <AsideFixture spec={spec.aside} />}
    </BasaltShell>
  )
}
