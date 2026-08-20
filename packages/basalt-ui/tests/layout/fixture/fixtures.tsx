import type { ReactElement } from 'react'
import { BasaltShell } from '../../../src/index'
import type { NavAnchor, SidebarItem, SidebarSection } from '../../../src/nav/types'
import type { FixtureSpec, ItemSpec } from './spec'

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

const toItem = (spec: ItemSpec): SidebarItem => ({
  key: spec.key,
  label: spec.label,
  icon: <Glyph />,
  href: `/${spec.key}`,
  Anchor: anchorFor(`/${spec.key}`),
  ...(spec.short !== undefined && { short: spec.short }),
  ...(spec.mobile !== undefined && { mobile: spec.mobile }),
  ...(spec.active !== undefined && { active: spec.active }),
  ...(spec.disabled !== undefined && { disabled: spec.disabled }),
  ...(spec.count !== undefined && { count: spec.count }),
  ...(spec.children !== undefined && { children: spec.children.map(toItem) }),
})

export function ShellFixture({ spec }: { spec: FixtureSpec }): ReactElement {
  const sections: SidebarSection[] = spec.sections.map((section) => ({
    label: section.label,
    items: section.items.map(toItem),
    ...(section.tab ? { mobile: { tab: true as const } } : {}),
  }))
  return (
    <BasaltShell
      brand={{ name: 'Fixture' }}
      sections={sections}
      {...(spec.nav && { mobileNav: spec.nav })}
    >
      {/* theme-allow -- a measured filler height IS the fixture's payload, not a themed size */}
      <div style={{ height: spec.bodyHeight ?? 0 }} />
      <div data-testid="content-end">end of content</div>
    </BasaltShell>
  )
}
