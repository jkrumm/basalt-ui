/**
 * The phone tab bar: the primary nav as a permanent bottom bar, with no mobile sidebar behind it
 * (concept decision 6). It paints a finished `PhoneModel` and owns exactly one piece of state, which
 * surface is open; every decision about which destination is a slot lives in the projector.
 *
 * A SLOT IS A DESTINATION. Tapping a link slot navigates through the item's own router anchor, so
 * reaching a page costs one tap and mounts nothing to dismiss. A surface exists only where a slot
 * holds more than one destination (More, or a section tab): see `more-surface.tsx`.
 *
 * The bar owns the one bottom safe-area inset and sits in the frame's footer row, so the scrollport
 * above it ends where the bar begins: the last pixel of a page is never under it.
 *
 * Floors (pointer coarse): bar 48, every tab at least 44, every surface row 48. The active tab shows
 * a neutral pill behind its icon, never the identity colour; an unread badge is a dot on the icon.
 */
import { useRouter } from '@tanstack/react-router'
import { useState, useSyncExternalStore } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { cn } from '../../../core/cn'
import { navAnchor } from '../../../router/nav/anchor'
import type { AnyNavItem } from '../../../router/nav/types'
import type { Account, GlobalAction, NavBadges, SettingsConfig, SidebarBlock } from '../../contract'
import { isLit } from '../../core/badges'
import type { CoreBlock } from '../../core/block-model'
import type { NavRuntime } from '../../core/nav-runtime'
import { projectMobileNav } from '../../core/mobile-projection'
import type { PhoneSlot } from '../../core/mobile-projection'
import type { BadgeMap } from '../../core/types'
import { SHELL_TEXT } from '../a11y'
import { BlockSheet, MoreSurface } from './more-surface'
import type { SurfaceSlot } from './more-surface'
import { retap } from './retap'

/**
 * The props the frame mounts the bar with.
 *
 * - `runtime`: the nav declaration and the active state; the bar never reads a router for either.
 * - `badges`: counts and dots by item id; a surface slot shows their rollup.
 * - `blocks`: a block with a phone placement is one row in the More surface that opens its own sheet.
 * - `settings`, `account`: flat rows at the end of the More surface, never a menu inside a menu.
 * - `globalActions`: accepted for the frame's contract; the header owns them on the phone.
 */
export type TabBarProps = {
  runtime: NavRuntime
  badges: NavBadges | undefined
  blocks: readonly SidebarBlock[]
  globalActions: readonly GlobalAction[]
  settings: SettingsConfig | undefined
  account: Account | undefined
}

/** A bar label longer than this clips in a 72 px slot; `NavItem.short` is the fix, not an ellipsis. */
const SHORT_MAX = 10

const TAB =
  'group/tab flex min-h-11 min-w-0 flex-1 basis-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 text-muted-foreground outline-none focus-ring data-active:text-foreground [-webkit-tap-highlight-color:transparent]'

const PILL =
  'relative inline-flex min-h-7 min-w-12 items-center justify-center rounded-ctrl px-3 py-0.5 transition-transform group-active/tab:scale-90 group-data-active/tab:bg-selected motion-reduce:transition-none'

/** The More glyph is chrome the part owns: the projector gives that slot no icon. */
function MoreGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  )
}

/** The icon, the More glyph, or the first letter when a consumer ships no icons at all. */
function Glyph({ slot }: { slot: PhoneSlot }): ReactElement {
  const Icon = slot.icon
  if (Icon !== undefined) return <Icon className="size-6" aria-hidden="true" />
  if (slot.kind !== 'link' && slot.isMore) return <MoreGlyph />
  return (
    // The letter is generated content, not text: a visible letter that the accessible name does not
    // start with is an axe `label-content-name-mismatch` on every icon-less tab.
    <span
      aria-hidden="true"
      data-letter={slot.short.slice(0, 1).toUpperCase()}
      className="inline-flex size-6 items-center justify-center font-semibold before:content-[attr(data-letter)]"
    />
  )
}

function TabFace({ slot }: { slot: PhoneSlot }): ReactElement {
  return (
    <>
      <span className={PILL}>
        <Glyph slot={slot} />
        {isLit(slot.badge) && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute end-2 top-0 size-2 rounded-full ring-2 ring-card',
              slot.badge.attention === true ? 'bg-warn' : 'bg-brand-fill',
            )}
          />
        )}
      </span>
      <p
        className={cn(
          'max-w-full overflow-clip text-micro leading-none font-medium whitespace-nowrap',
          slot.active && 'font-semibold',
        )}
      >
        {slot.short}
      </p>
    </>
  )
}

function warnLongShort(slots: readonly PhoneSlot[]): void {
  if (process.env.NODE_ENV === 'production') return
  for (const slot of slots) {
    if (slot.short.length <= SHORT_MAX) continue
    // eslint-disable-next-line no-console -- dev-only diagnostic
    console.warn(
      `[basalt] tab bar: "${slot.short}" is ${slot.short.length} characters; a tab label clips past ${SHORT_MAX}. Set \`short\` on "${slot.id}".`,
    )
  }
}

function LinkTab({ slot }: { slot: Extract<PhoneSlot, { kind: 'link' }> }): ReactElement {
  const router = useRouter()
  const Anchor = navAnchor(slot.row.item as unknown as AnyNavItem)
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    retap(slot.row, event, router.state.location.href)
  }
  return (
    // oxlint-disable-next-line react/static-components -- `navAnchor` is cached per item object: one stable component type
    <Anchor
      aria-label={slot.label}
      aria-current={slot.active ? 'page' : undefined}
      data-active={slot.active ? '' : undefined}
      className={TAB}
      onClick={onClick}
    >
      <TabFace slot={slot} />
    </Anchor>
  )
}

function SurfaceTab({
  slot,
  open,
  onToggle,
}: {
  slot: SurfaceSlot
  open: boolean
  onToggle: () => void
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={slot.label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-current={slot.active ? 'page' : undefined}
      data-active={slot.active ? '' : undefined}
      className={TAB}
      onClick={onToggle}
    >
      <TabFace slot={slot} />
    </button>
  )
}

export function TabBar({ runtime, badges, blocks, settings, account }: TabBarProps): ReactElement {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  // Keyed by slot id, never by the slot object: the model is rebuilt every render and an open
  // surface must survive that.
  const [openId, setOpenId] = useState<string | null>(null)
  const [blockId, setBlockId] = useState<string | null>(null)

  const model = projectMobileNav({
    nav: runtime.nav,
    state,
    ...(badges !== undefined && { badges: badges as BadgeMap }),
    blocks: blocks as readonly CoreBlock[],
    ...(settings !== undefined && { settings }),
    ...(account !== undefined && { account }),
  })
  warnLongShort(model.slots)

  // The blocks that raise a nested sheet, found through the projected rows so the count that picked
  // the surface and the rows that render agree.
  const sheetBlocks = model.slots.flatMap((slot) =>
    slot.kind === 'link'
      ? []
      : slot.extras.flatMap((extra) =>
          extra.kind === 'block' && extra.block.kind !== 'progress' ? [extra.block] : [],
        ),
  )

  const openBlock = (block: CoreBlock): void => {
    if (block.kind === 'progress') {
      block.onClick?.()
      return
    }
    // ONE FRAME, deliberately: the surface that is closing returns focus to the tab while the
    // nested sheet traps focus on mount. In one handler the two race and focus lands behind the
    // sheet; a frame lets the return finish before the trap starts.
    requestAnimationFrame(() => setBlockId(block.id))
  }

  return (
    <div
      data-slot="shell-footer"
      className="border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <nav
        data-slot="shell-tab-bar"
        aria-label={SHELL_TEXT.primary}
        className="flex h-12 items-stretch"
      >
        {model.slots.map((slot) =>
          slot.kind === 'link' ? (
            <LinkTab key={slot.id} slot={slot} />
          ) : (
            <SurfaceTab
              key={slot.id}
              slot={slot}
              open={openId === slot.id}
              onToggle={() => setOpenId(openId === slot.id ? null : slot.id)}
            />
          ),
        )}
      </nav>
      {model.slots.map((slot) =>
        slot.kind === 'link' ? null : (
          <MoreSurface
            key={slot.id}
            slot={slot}
            open={openId === slot.id}
            onOpenChange={(open) => setOpenId(open ? slot.id : null)}
            account={account}
            onBlock={openBlock}
          />
        ),
      )}
      {sheetBlocks.map((block) => (
        <BlockSheet
          key={block.id}
          block={block}
          contract={blocks}
          open={blockId === block.id}
          onOpenChange={(open) => setBlockId(open ? block.id : null)}
        />
      ))}
    </div>
  )
}
