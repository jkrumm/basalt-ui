import { useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'
import { navFor } from '../../router/nav/registry'
import { Dialog, DialogContent } from '../../ui/dialog'
import { currentArea } from './area'
import { ChordKeys } from './chord-keys'
import type { CommandSet } from './define-commands'
import { navCommands } from './nav-commands'
import { navShortcutSources, shortcutGroups } from './shortcut-rows'

/**
 * The keyboard-shortcut list `CommandPalette` renders: the same `defineCommands` set its key listener
 * binds (every command with a chord, a sequence as `g` then `n`), the nav's `Mod+1`..`Mod+9` and the
 * shell's own, grouped by the command's `group` (else its `area`). It lists what fires where focus is:
 * the global commands plus those of the `Page area` focus is in. The built-in `shell.shortcuts`
 * (`?`, never in a text field) toggles it. Internal: it is not a public export, so an app cannot
 * mount the palette and forget the list.
 */
export function ShortcutOverlay({ commands }: { commands: CommandSet }): ReactElement {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [area, setArea] = useState<string | undefined>(undefined)

  // Every opening reads the area focus is in.
  useIsomorphicLayoutEffect(() => {
    if (open) setArea(currentArea())
  }, [open])

  useEffect(() => commands.bind({ toggleShortcuts: () => setOpen((was) => !was) }), [commands])

  const nav = navFor(router)
  const navItems = useMemo(() => (nav === undefined ? [] : navCommands(nav)), [nav])
  const groups = open
    ? shortcutGroups([...commands.entries, ...navShortcutSources(navItems)], area)
    : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Keyboard shortcuts" description="Press ? to open this list.">
        <div data-slot="shortcut-overlay" className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.name} className="flex flex-col gap-1">
              <h3 className="text-micro font-medium tracking-wide text-faint uppercase">
                {group.name}
              </h3>
              <ul className="flex flex-col">
                {group.rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-1 text-sm">
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    <ChordKeys steps={row.steps} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
