/**
 * The provider's Spotlight list: the `defineCommands` registry, then the `defineNav` destinations
 * (via `flattenNav`, skipping any id a registered `nav.<id>` command already owns), then the three dev-dock commands in dev. A snapshot rebuilt each time Spotlight
 * opens, so a command's `when()` is current. Not for use during render (`detectMac` reads `navigator`).
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import type { AnyRouter } from '@tanstack/react-router'
import { getActiveCommands, runCommandSafely } from '../commands/command-stash'
import { detectMac, formatShortcutDisplay } from '../commands/shortcut-format'
import { flattenNav, getActiveNav } from '../router-tanstack/nav-stash'
import type { FlatNavItem } from '../router-tanstack/nav-stash'
import type { BasaltDevDockTool } from '../dev-dock'

const DEV_TOOLS: ReadonlyArray<{ tool: BasaltDevDockTool; label: string }> = [
  { tool: 'router', label: 'Router devtools' },
  { tool: 'query', label: 'Query devtools' },
  { tool: 'theme', label: 'Theme lab' },
]

export function buildSpotlightActions(
  router: AnyRouter,
  openDevTool: (tool: BasaltDevDockTool) => void,
  navCommandLabel?: (item: FlatNavItem) => string,
): SpotlightActionData[] {
  const actions: SpotlightActionData[] = []
  const commands = getActiveCommands()

  for (const [id, cmd] of Object.entries(commands)) {
    if (cmd.when !== undefined && !cmd.when()) continue
    actions.push({
      id,
      label: cmd.label,
      leftSection: cmd.icon,
      keywords: [cmd.group ?? '', id].join(' ').trim(),
      ...(cmd.group !== undefined && { group: cmd.group }),
      ...(cmd.shortcut !== undefined && {
        description: formatShortcutDisplay(cmd.shortcut, detectMac()),
      }),
      onClick: () => runCommandSafely(cmd),
    })
  }

  const nav = getActiveNav()
  if (nav !== undefined) {
    for (const item of flattenNav(nav)) {
      if (item.disabled === true) continue
      // A registered `nav.<id>` command owns that destination: the consumer wins, no duplicate.
      if (`nav.${item.id}` in commands) continue
      actions.push({
        id: `nav.${item.id}`,
        label: navCommandLabel?.(item) ?? item.label,
        group: item.groupLabel,
        leftSection: item.icon,
        // `link` is the destination's own `linkOptions`, so a store-backed `search` thunk restores
        // the last selection exactly as the sidebar link does.
        onClick: () => void router.navigate(item.link as never),
      })
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    for (const { tool, label } of DEV_TOOLS) {
      actions.push({
        id: `dev.${tool}`,
        label,
        group: 'Dev',
        onClick: () => openDevTool(tool),
      })
    }
  }

  return actions
}
