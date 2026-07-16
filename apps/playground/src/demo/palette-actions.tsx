/**
 * Builds the full Spotlight action list for the playground palette — Pages (from the nav model, as
 * breadcrumb trails) plus the command bus, each decorated with a right-side kind badge so a result
 * is self-describing regardless of its group. Passed to `<BasaltOverlays projectCommands={false}
 * spotlightActions={…}>`, which then renders exactly this list (no internal command projection, so
 * nothing appears twice).
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import { Badge } from '@mantine/core'
import { closeSpotlight, runCommand, toRouteActions, toSpotlightActions } from 'basalt-ui/commands'
import { NAV_MODEL } from './nav-model'

/** Neutral kind tag (Page / Command / Setting) — no identity color, per the restraint doctrine. */
function KindBadge({ children }: { children: string }) {
  return (
    <Badge size="xs" radius="sm" variant="default" fw={500}>
      {children}
    </Badge>
  )
}

/** Assemble the palette in group order Commands → Settings → Pages. The command bus splits by kind
 *  (Appearance → Settings, everything else → Commands); pages come from the nav model as trails. */
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

  const pages = toRouteActions(NAV_MODEL, {
    onNavigate,
    group: 'Pages',
    rightSection: <KindBadge>Page</KindBadge>,
  })

  return [...commands, ...settings, ...pages]
}
