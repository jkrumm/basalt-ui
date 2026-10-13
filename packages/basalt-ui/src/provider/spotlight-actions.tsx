/**
 * The provider's Spotlight list: the `defineCommands` registry, then the `defineNav` destinations
 * (via `flattenNav`), then the three dev-dock commands in dev. A snapshot rebuilt each time Spotlight
 * opens, so a command's `when()` is current. Not for use during render (`detectMac` reads `navigator`).
 */
import type { SpotlightActionData } from '@mantine/spotlight'
import type { AnyRouter } from '@tanstack/react-router'
import { getActiveCommands } from '../commands/define-commands'
import { detectMac, formatShortcutDisplay } from '../commands/shortcut-format'
import { flattenNav, getActiveNav } from '../router-tanstack/nav'
import type { BasaltDevDockTool } from '../dev-dock'
import { runCommandSafely } from './hotkeys'

const DEV_TOOLS: ReadonlyArray<{ tool: BasaltDevDockTool; label: string }> = [
  { tool: 'router', label: 'Router devtools' },
  { tool: 'query', label: 'Query devtools' },
  { tool: 'theme', label: 'Theme lab' },
]

export function buildSpotlightActions(
  router: AnyRouter,
  openDevTool: (tool: BasaltDevDockTool) => void,
): SpotlightActionData[] {
  const actions: SpotlightActionData[] = []

  for (const [id, cmd] of Object.entries(getActiveCommands())) {
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
      actions.push({
        id: `nav.${item.id}`,
        label: item.label,
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
