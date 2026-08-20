/**
 * Builds the full Spotlight action list for the playground palette — Pages (from the nav
 * definition, as breadcrumb trails), the command bus, and Guides (from the article fixture), each
 * decorated with a right-side kind badge so a result is self-describing regardless of its group.
 * Passed to `<BasaltOverlays projectCommands={false} spotlightActions={…}>`, which then renders
 * exactly this list (no internal command projection, so nothing appears twice).
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import { Badge } from '@mantine/core'
import { closeSpotlight, runCommand, toRouteActions, toSpotlightActions } from 'basalt-ui/commands'
import type { RouteActionItem, RouteActionSection } from 'basalt-ui/commands'
import { toArticleActions } from 'basalt-ui/content'
import type { AnyNavItem } from 'basalt-ui/router-tanstack'
import { ARTICLES, articleHref } from './articles'
import { NAV } from './nav-model'

/**
 * `toRouteActions` reads an href-shaped nav (it is router-agnostic and only knows how to call
 * `onNavigate(href)`), while a `defineNav` destination carries the router's own link options. One
 * adapter bridges them, and it is deliberately the ONLY place the two shapes meet: `link.to` is
 * the href, and any default `search` is dropped — every route that needs one validates it with a
 * localStorage fallback, so arriving without it restores the last selection rather than breaking.
 */
function toRouteItems(items: ReadonlyArray<AnyNavItem>): RouteActionItem[] {
  return items.map((item) => ({
    label: item.label,
    href: item.link.to,
    ...(item.icon !== undefined && { icon: item.icon }),
    ...(item.disabled !== undefined && { disabled: item.disabled }),
    ...(item.children !== undefined && { children: toRouteItems(item.children) }),
  }))
}

/** The nav definition as `toRouteActions` wants it. Routes are static, so this is built once. */
const NAV_PAGES: RouteActionSection[] = NAV.groups.map((group) => ({
  label: group.label,
  ...(group.icon !== undefined && { icon: group.icon }),
  items: toRouteItems(group.items),
}))

/** Neutral kind tag (Page / Command / Setting) — no identity color, per the restraint doctrine. */
function KindBadge({ children }: { children: string }) {
  return (
    <Badge size="xs" radius="sm" variant="default" fw={500}>
      {children}
    </Badge>
  )
}

/** Assemble the palette in group order Commands → Settings → Pages → Guides. The command bus
 *  splits by kind (Appearance → Settings, everything else → Commands); pages come from the nav
 *  definition as trails; guides come from the article fixture (`ARTICLES`). */
export function buildPaletteActions(onNavigate: (href: string) => void): SpotlightActionData[] {
  const decorated = toSpotlightActions((id) => {
    closeSpotlight()
    void runCommand(id)
  }).map((action) => {
    const isSetting = action.group === 'Appearance'
    return {
      ...action,
      group: isSetting ? 'Settings' : 'Commands',
      rightSection: <KindBadge>{isSetting ? 'Setting' : 'Command'}</KindBadge>,
    }
  })
  const commands = decorated.filter((action) => action.group === 'Commands')
  const settings = decorated.filter((action) => action.group === 'Settings')

  const pages = toRouteActions(NAV_PAGES, {
    onNavigate,
    group: 'Pages',
    rightSection: <KindBadge>Page</KindBadge>,
  })

  const guides = toArticleActions(ARTICLES, {
    onNavigate,
    href: articleHref,
    group: 'Guides',
    rightSection: <KindBadge>Guide</KindBadge>,
  })

  return [...commands, ...settings, ...pages, ...guides]
}
