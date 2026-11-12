import { useRouter } from '@tanstack/react-router'
import { useContext, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'
import { navFor } from '../../router/nav/registry'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
} from '../../ui/combobox'
import { Dialog, DialogContent } from '../../ui/dialog'
import { Kbd } from '../../ui/kbd'
import { RailControlProvider } from '../parts/grid'
import { chordKeys, isApplePlatform, matchesChord, mayFireOn, parseChord } from './chord'
import { SHELL_PALETTE } from './define-commands'
import type { CommandSet } from './define-commands'
import { navCommands } from './nav-commands'
import { defaultRank } from './rank'
import type { PaletteItem, RankFn } from './rank'

export type CommandPaletteProps = {
  commands: CommandSet
  /** Orders and filters the rows for a query. Default: prefix, word start, substring, subsequence. */
  rank?: RankFn
  /** Controlled state, for `AppShell search={{ onOpen }}`; without it the palette keeps its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
}

/**
 * The `Page area` the focus is in. With nothing focused (right after a navigation) it is the area
 * of the page on screen, so an area command is not dead until the first click.
 */
function currentArea(): string | undefined {
  const active = document.activeElement
  if (active !== null && active !== document.body) {
    return active.closest('[data-area]')?.getAttribute('data-area') ?? undefined
  }
  const page = document.querySelector('[data-slot="shell-main"] [data-slot="page"][data-area]')
  return page?.getAttribute('data-area') ?? undefined
}

/**
 * The command palette and the app's one key listener. It lists every command of the set, every
 * `defineNav` item and the built-ins, opens on `Mod+K`, and ranks with `rank`. Escape closes only the
 * top layer: the palette, never the dialog it was opened over. Mount it once, inside `AppShell`,
 * so `shell.toggle-rail` has a rail to toggle and the nav is registered.
 *
 * It also binds every chord of the set: a command fires when its chord is pressed, `enabled()` holds
 * and focus is inside its `area` (or it has none). A chord with no modifier never fires in a text
 * field and a bare `Enter` or `Space` never fires on a focused control, so the control keeps its key.
 *
 * @useWhen the app has commands, shortcuts or a destination list worth reaching from the keyboard
 * @neverWhen the app has a handful of screens and no actions (the rail is the whole navigation)
 *
 * @example
 * <AppShell nav={NAV} brand={{ name: 'Argo' }} search={{ onOpen: () => setOpen(true) }}>
 *   <Outlet />
 *   <CommandPalette commands={COMMANDS} open={open} onOpenChange={setOpen} />
 * </AppShell>
 */
export function CommandPalette({
  commands,
  rank = defaultRank,
  open: openProp,
  onOpenChange,
  placeholder = 'Type a command or a page',
}: CommandPaletteProps): ReactElement {
  const router = useRouter()
  const rail = useContext(RailControlProvider)
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const [query, setQuery] = useState('')
  const [area, setArea] = useState<string | undefined>(undefined)
  const [listHost, setListHost] = useState<HTMLDivElement | null>(null)

  const setOpen = (next: boolean): void => {
    if (next === open) return
    setOwn(next)
    onOpenChange?.(next)
  }

  // Every opening starts clean, whoever flips `open`: the chord, a row, or a controlling parent.
  useIsomorphicLayoutEffect(() => {
    if (!open) return
    setArea(currentArea())
    setQuery('')
  }, [open])

  const nav = navFor(router)
  const navItems = useMemo(() => (nav === undefined ? [] : navCommands(nav)), [nav])

  // Every command the keyboard can reach: the set's, then the nav's.
  const runnable = useMemo<readonly PaletteItem[]>(
    () => [
      ...commands.entries,
      ...navItems.map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        group: cmd.group,
        ...(cmd.chord !== undefined && { chord: cmd.chord }),
        parsed: cmd.chord === undefined ? undefined : parseChord(cmd.chord),
        run: () => {
          void router.navigate({ ...cmd.item.link } as never)
        },
      })),
    ],
    [commands, navItems, router],
  )

  useEffect(
    () =>
      commands.bind({
        toggleRail: () => rail?.toggle(),
        togglePalette: () => setOpen(!open),
      }),
    // `setOpen` closes over `open` and the props; the binding is replaced whenever those move.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [commands, rail, open, onOpenChange, openProp],
  )

  useEffect(() => {
    const apple = isApplePlatform()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return
      const scope = currentArea()
      let hit: PaletteItem | undefined
      for (const item of runnable) {
        const { parsed } = item
        if (parsed === undefined || !matchesChord(event, parsed, apple)) continue
        // The palette owns the keyboard while it is open: only its own chord gets through.
        if (open && item.id !== SHELL_PALETTE) continue
        if (item.area !== undefined && item.area !== scope) continue
        if (item.enabled?.() === false || !mayFireOn(parsed, event.target)) continue
        // An area command beats a global one on the same chord, whichever was declared first.
        if (hit === undefined || (hit.area === undefined && item.area !== undefined)) hit = item
      }
      if (hit === undefined) return
      event.preventDefault()
      void hit.run()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runnable, open])

  // Escape closes the top layer. Capturing on the window runs before any dialog underneath sees it.
  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      event.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onOpenChange, openProp])

  const rows = useMemo<readonly PaletteItem[]>(() => {
    if (!open) return []
    const listed = runnable.filter(
      (item) =>
        item.listed !== false &&
        item.enabled?.() !== false &&
        (item.area === undefined || item.area === area),
    )
    return rank(query, listed)
  }, [open, runnable, area, rank, query])

  const choose = (item: PaletteItem): void => {
    setOpen(false)
    queueMicrotask(() => void item.run())
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Command palette">
        <div data-slot="command-palette">
          <Autocomplete
            items={rows}
            mode="none"
            inline
            open
            autoHighlight="always"
            value={query}
            onValueChange={setQuery}
            itemToStringValue={(item: PaletteItem) => item.label}
          >
            <AutocompleteInput aria-label="Search commands" placeholder={placeholder} />
            <AutocompleteContent
              empty="No match"
              container={listHost ?? undefined}
              className="max-h-80 rounded-none border-0 p-0 shadow-none"
            >
              {(item: PaletteItem) => (
                <AutocompleteItem key={item.id} value={item} onClick={() => choose(item)}>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.group !== undefined && (
                    <span className="shrink-0 text-xs text-faint">{item.group}</span>
                  )}
                  {item.parsed !== undefined && (
                    <span className="flex shrink-0 gap-1">
                      {chordKeys(item.parsed).map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  )}
                </AutocompleteItem>
              )}
            </AutocompleteContent>
          </Autocomplete>
          {/* The popup's positioner is pulled back into the flow: the palette is a list, not a dropdown. */}
          <div
            ref={setListHost}
            data-slot="command-palette-list"
            className="mt-2 [&>*>*]:static! [&>*>*]:transform-none! [&>*>*]:translate-none!"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
