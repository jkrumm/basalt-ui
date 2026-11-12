/**
 * The rail: the primary nav at the left edge, one DOM for every width.
 *
 * The `<nav>` is a size container and the collapsed form is a container query on its own width
 * (`@max-[120px]`: the rail is 64 px collapsed, 240 expanded, 0 compact), so the server renders the
 * right thing and nothing flashes. `data-rail` on the root is an override the grid already turns
 * into a width; the rail never reads it. JS reads the collapse only where CSS cannot (tooltips,
 * the popover of a parent row), through `useRailControl()`.
 *
 * It projects the declared nav (`projectRail`) and paints the model: the search row, the sections,
 * the nav-placed blocks in the one scroll region, then a pinned footer of bottom blocks, pinned
 * rows, settings and the account. The blocks, settings and account are their own parts.
 */
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { Account, NavBadges, SettingsConfig, ShellBrand, SidebarBlock } from '../contract'
import type { NavRuntime } from '../core/nav-runtime'
import { projectRail } from '../core/projector'
import type { RailBlockRow } from '../core/projector'
import type { BadgeMap, CoreNavConfig } from '../core/types'
import type { CoreBlock } from '../core/block-model'
import { SHELL_TEXT } from './a11y'
import { RailAccount } from './account'
import { RailBlock } from './blocks'
import { RailRowView } from './rail-rows'
import { useSectionFolds } from './rail-folds'
import { RailSearch } from './rail-search'
import { RailSectionView } from './rail-section'
import { RailSettings } from './settings'

export type RailProps = {
  runtime: NavRuntime
  brand: ShellBrand
  badges: NavBadges | undefined
  blocks: readonly SidebarBlock[]
  settings: SettingsConfig | undefined
  account: Account | undefined
  search: { onOpen: () => void } | undefined
}

/** The first bottom progress block that asks for the ring: the settings row wears it collapsed. */
function ringOf(rows: readonly RailBlockRow[]): { value: number; label: string } | undefined {
  for (const row of rows) {
    const { block } = row
    if (block.kind === 'progress' && row.rail === 'ring') {
      return { value: block.value, label: block.label }
    }
  }
  return undefined
}

export function Rail({
  runtime,
  badges,
  blocks,
  settings,
  account,
  search,
}: RailProps): ReactElement {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const nav: CoreNavConfig = runtime.nav
  const folds = useSectionFolds(
    nav.sections.filter((section) => section.collapsible === true).map((section) => section.id),
  )
  const model = projectRail({
    nav,
    state,
    ...(badges !== undefined && { badges: badges as BadgeMap }),
    blocks: blocks as readonly CoreBlock[],
    folds,
  })
  const ring = ringOf(model.blocks.bottom)
  const hasFooter =
    model.blocks.bottom.length > 0 ||
    model.pinned.length > 0 ||
    settings !== undefined ||
    account !== undefined

  return (
    <nav
      data-slot="shell-rail"
      aria-label={SHELL_TEXT.primary}
      className="@container flex h-full min-h-0 flex-col border-e border-border"
    >
      <div
        data-slot="shell-rail-viewport"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-12px),transparent)]"
      >
        {search !== undefined && <RailSearch onOpen={search.onOpen} />}
        {model.sections.map((section, index) => (
          <RailSectionView key={section.id} section={section} first={index === 0} />
        ))}
        {model.blocks.nav.map((row) => (
          <RailBlock key={row.id} row={row} />
        ))}
      </div>
      {hasFooter && (
        <div data-slot="shell-rail-footer" className="flex flex-col gap-px px-1.5 pt-3 pb-2.5">
          {model.blocks.bottom.map((row) => (
            <RailBlock key={row.id} row={row} />
          ))}
          {model.pinned.map((row) => (
            <RailRowView key={row.id} row={row} />
          ))}
          <RailSettings settings={settings} ring={ring} />
          <RailAccount account={account} />
        </div>
      )}
    </nav>
  )
}
