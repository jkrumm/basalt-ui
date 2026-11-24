import { useRouter } from '@tanstack/react-router'
import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react'
import { requestMainFocus } from '../../common/focus'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'
import { navFor } from '../../router/nav/registry'
import { Autocomplete, AutocompleteInput } from '../../ui/combobox'
import { useSizeClass } from '../../page/use-size-class'
import { Lozenge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent } from '../../ui/dialog'
import { useSheetPresent } from '../../ui/overlay-presenter'
import type { OverlayPresent } from '../../ui/overlay-presenter'
import { OptionListBody, useListHighlight, useOptionList } from '../../core/list/engine'
import type { ListGroup, ListItems, ListOption } from '../../core/list/options'
import { PopupFrame } from '../../core/list/popup'
import { RailControlProvider } from '../parts/grid'
import { usePhoneNav } from '../parts/mobile/variant'
import { currentArea } from './area'
import { useChordBindings } from './bindings'
import { isApplePlatform, parseChordSequence } from './chord'
import { ChordKeys } from './chord-keys'
import { SHELL_PALETTE } from './define-commands'
import type { CommandSet } from './define-commands'
import { navCommands } from './nav-commands'
import { openResult, rememberRecent, useSourceRows } from './palette-sources'
import type { PaletteResult, PaletteResultAction, PaletteSource } from './palette-sources'
import { defaultRank } from './rank'
import type { PaletteItem, RankFn } from './rank'
import { ShortcutOverlay } from './shortcut-overlay'

/** The palette as a bottom sheet, loaded only when the section bar opens it on a phone. */
const LazyPaletteSheet = lazy(async () => ({
  default: (await import('./palette-sheet')).PaletteSheet,
}))

const NO_SOURCES: readonly PaletteSource[] = []

/** A source row's result with the source it came from. */
type SourceHit = { source: PaletteSource; result: PaletteResult }

export type CommandPaletteProps = {
  commands: CommandSet
  /** Orders and filters the rows for a query. Default: prefix, word start, substring, subsequence. */
  rank?: RankFn
  /** Controlled state, for `AppShell search={{ onOpen }}`; without it the palette keeps its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  /**
   * How it opens: `auto` is a full-height sheet with the field on top on a phone (compact width,
   * coarse pointer) and the centred dialog elsewhere; `popup` and `sheet` force one.
   */
  present?: OverlayPresent
  /**
   * Record search beside the commands: one group per source, after the command and nav groups, in
   * this order and headed by the source's `label`. See `PaletteSource`.
   */
  sources?: readonly PaletteSource[]
}

/**
 * The command palette and the app's one key listener. It lists every command of the set, every
 * `defineNav` item and the built-ins, opens on `Mod+K`, and ranks with `rank`. Escape closes only the
 * top layer: the palette, never the dialog it was opened over. Mount it once, inside `AppShell`,
 * so `shell.toggle-rail` has a rail to toggle and the nav is registered. It is the app's one
 * palette: while an `AppShell` is mounted, `BasaltProvider` mounts no Spotlight of its own. Hand
 * the shell's search row the same open state (`search={{ onOpen }}`, as in the example).
 *
 * It also binds every chord of the set: a command fires when its chord is pressed, `enabled()` holds
 * and focus is inside its `area` (or it has none). A chord with no modifier never fires in a text
 * field and a bare `Enter` or `Space` never fires on a focused control, so the control keeps its key.
 * A chord may be a sequence (`g n`): each step must follow the last within a second.
 *
 * `?` (outside a text field) opens the keyboard-shortcut list, drawn from this same `commands` set,
 * the nav's `Mod+1`..`Mod+9` and the shell's own chords, grouped by the command's `group` (else its
 * `area`) and limited to what fires where focus is; a sequence reads `g` then `n`. It is part of the
 * palette, so no chord can be declared and missing from it, and `?` is reserved like `Mod+K`.
 *
 * `sources` add record search to the same list. While the query is empty each source shows the
 * results opened from it last (its recents, kept per source id); a typed query is sent to every
 * source's `search` after 150 ms of rest, and a newer query or closing aborts the older call through
 * its `signal`. A source's rows keep the order it returned. Choosing a result (Enter or a click)
 * closes the palette, records the recent and opens its `to`. A result's `actions` draw as small
 * trailing buttons, and `Mod+Enter` runs the first action of the highlighted row.
 *
 * @useWhen the app has commands, shortcuts or a destination list worth reaching from the keyboard
 * @neverWhen the app has a handful of screens and no actions (the rail is the whole navigation)
 *
 * @example
 * <AppShell nav={NAV} brand={{ name: 'Argo' }} search={{ onOpen: () => setOpen(true) }}>
 *   <Outlet />
 *   <CommandPalette commands={COMMANDS} open={open} onOpenChange={setOpen} sources={[SUPPLIERS]} />
 * </AppShell>
 *
 * @example
 * const SUPPLIERS: PaletteSource = {
 *   id: 'suppliers',
 *   label: 'Suppliers',
 *   search: async (query, signal) => {
 *     const found = await findSuppliers(query, { signal })
 *     return found.map((s) => ({ id: s.id, title: s.name, kind: 'Supplier', detail: s.city, to: `/suppliers/${s.id}` }))
 *   },
 * }
 */
export function CommandPalette({
  commands,
  rank = defaultRank,
  open: openProp,
  onOpenChange,
  placeholder = 'Type a command or a page',
  present,
  sources = NO_SOURCES,
}: CommandPaletteProps): ReactElement {
  const router = useRouter()
  const rail = useContext(RailControlProvider)
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const [query, setQuery] = useState('')
  const [area, setArea] = useState<string | undefined>(undefined)
  const [listHost, setListHost] = useState<HTMLDivElement | null>(null)
  const [recentsVersion, setRecentsVersion] = useState(0)
  const highlighted = useRef<unknown>(undefined)

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
        steps: cmd.chord === undefined ? [] : parseChordSequence(cmd.chord),
        run: () => {
          requestMainFocus()
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

  // The palette owns the keyboard while it is open: only its own chord gets through.
  useChordBindings(runnable, (item) => !open || item.id === SHELL_PALETTE)

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

  const chooseResult = ({ source, result }: SourceHit): void => {
    rememberRecent(router, source, result)
    setRecentsVersion((version) => version + 1)
    setOpen(false)
    queueMicrotask(() => {
      requestMainFocus()
      openResult(router, result.to)
    })
  }

  const runAction = (action: PaletteResultAction): void => {
    setOpen(false)
    queueMicrotask(() => void action.run())
  }

  // Mod+Enter runs the first action of the highlighted result, before Base UI reads it as a choice.
  const onKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' || !(isApplePlatform() ? event.metaKey : event.ctrlKey)) return
    const hit = resultByValue.get(String(highlighted.current))
    const action = hit?.result.actions?.[0]
    if (action === undefined) return
    event.preventDefault()
    event.stopPropagation()
    runAction(action)
  }

  const byId = new Map(rows.map((item) => [item.id, item]))
  const sourceRows = useSourceRows(sources, query, open, recentsVersion)
  const resultByValue = new Map<string, SourceHit>()
  const sourceGroups: ListGroup<string>[] = []
  for (const { source, results } of sourceRows) {
    const options = results.map((result): ListOption<string> => {
      const value = `source:${source.id}:${result.id}`
      resultByValue.set(value, { source, result })
      return {
        value,
        label: result.title,
        ...(result.detail !== undefined && { description: result.detail }),
        ...(result.icon !== undefined && { icon: result.icon }),
      }
    })
    if (options.length > 0) sourceGroups.push({ label: source.label, options })
  }
  const list = useOptionList({ source: [...toListItems(rows), ...sourceGroups], query: '', open })
  const highlight = useListHighlight()
  const phoneNav = usePhoneNav()
  const sizeClass = useSizeClass()
  const sheetPresent = useSheetPresent(present)
  // `present="popup"` keeps the dialog even under a trial phone nav
  const phoneSheet =
    present !== 'popup' && (sheetPresent || (phoneNav !== 'tabs' && sizeClass === 'compact'))

  const body = (
    <div data-slot="command-palette" onKeyDownCapture={onKeyDownCapture}>
      <Autocomplete
        items={list.values as readonly string[]}
        mode="none"
        inline
        open
        autoHighlight="always"
        value={query}
        onValueChange={setQuery}
        itemToStringValue={list.textOf}
        onItemHighlighted={(value) => {
          highlighted.current = value
        }}
      >
        <AutocompleteInput aria-label="Search commands" placeholder={placeholder} />
        <PopupFrame
          kind="autocomplete"
          slot="autocomplete-content"
          className="relative max-h-80 overflow-y-auto outline-none"
          container={listHost ?? undefined}
        >
          <OptionListBody
            list={list}
            size="lg"
            kind="autocomplete"
            highlight={highlight}
            virtual={undefined}
            checked={false}
            trailing={(option) => {
              const hit = resultByValue.get(option.value)
              if (hit !== undefined)
                return <ResultTrailing result={hit.result} onAction={runAction} />
              const steps = byId.get(option.value)?.steps ?? []
              return steps.length > 0 ? <ChordKeys steps={steps} /> : null
            }}
            onRowClick={(option) => {
              const hit = resultByValue.get(option.value)
              if (hit !== undefined) return chooseResult(hit)
              const item = byId.get(option.value)
              if (item !== undefined) choose(item)
            }}
          />
        </PopupFrame>
      </Autocomplete>
      {/* The popup's positioner is pulled back into the flow: the palette is a list, not a dropdown. */}
      <div
        ref={setListHost}
        data-slot="command-palette-list"
        className="mt-2 [&>*>*]:static! [&>*>*]:transform-none! [&>*>*]:translate-none!"
      />
    </div>
  )

  // The section bar opens search as a bottom sheet on a phone: the input sits at its
  // top, above the keyboard, and the rows scroll under it.
  if (phoneSheet) {
    return (
      <>
        <ShortcutOverlay commands={commands} />
        <Suspense fallback={null}>
          <LazyPaletteSheet open={open} onOpenChange={setOpen}>
            {body}
          </LazyPaletteSheet>
        </Suspense>
      </>
    )
  }

  return (
    <>
      <ShortcutOverlay commands={commands} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Command palette">{body}</DialogContent>
      </Dialog>
    </>
  )
}

/** A result row's end: its kind as a chip, then one small ghost button per action. */
function ResultTrailing({
  result,
  onAction,
}: {
  result: PaletteResult
  onAction: (action: PaletteResultAction) => void
}): ReactElement | null {
  const { kind, actions } = result
  if (kind === undefined && (actions === undefined || actions.length === 0)) return null
  return (
    <>
      {kind !== undefined && <Lozenge>{kind}</Lozenge>}
      {actions?.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="sm"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onAction(action)
          }}
        >
          {action.label}
        </Button>
      ))}
    </>
  )
}

/**
 * The palette's ranked rows as list items: one group per `group`, placed where the rank first
 * reaches it, so the best match's group leads; rows with no group form one loose run the same way.
 */
function toListItems(rows: readonly PaletteItem[]): ListItems<string> {
  const runs = new Map<string | undefined, ListOption<string>[]>()
  for (const item of rows) {
    const option: ListOption<string> = {
      value: item.id,
      label: item.label,
      ...(item.icon !== undefined && { icon: item.icon }),
      ...(item.keywords !== undefined && { keywords: item.keywords }),
    }
    const run = runs.get(item.group)
    if (run === undefined) runs.set(item.group, [option])
    else run.push(option)
  }
  return [...runs].flatMap(([label, options]): ListItems<string> =>
    label === undefined ? options : [{ label, options } satisfies ListGroup<string>],
  )
}
