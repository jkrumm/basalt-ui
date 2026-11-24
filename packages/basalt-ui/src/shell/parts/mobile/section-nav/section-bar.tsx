/**
 * The section bar: full width at the bottom, one slot per nav section (its icon, its name, the
 * summed badge of its items), then More. A section of one destination is a link; any other opens that
 * section's short drawer. The bar is the shell's footer row, so main ends where it begins; a focused
 * text field takes it out of the way of the keyboard.
 */
import type { ReactElement } from 'react'
import { cn } from '../../../../core/cn'
import { SHELL_TEXT } from '../../a11y'
import { SlotLink } from './host'
import type { BarModel, BarSection } from './model'
import { DestinationGlyph, IconBadge, MoreGlyph, VARIANT_TEXT, badgedLabel } from './parts'

const TAB =
  'group/tab relative flex min-h-11 min-w-0 flex-1 basis-0 touch-manipulation select-none flex-col items-center justify-center gap-1 text-muted-foreground outline-none focus-ring data-active:text-foreground data-open:text-foreground [-webkit-tap-highlight-color:transparent]'

const PILL =
  'relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-fast ease-standard group-active/tab:bg-accent group-data-active/tab:bg-selected group-data-open/tab:bg-accent motion-reduce:transition-none'

const LABEL =
  'max-w-full truncate px-1 text-micro leading-none font-medium group-data-active/tab:font-semibold'

function Face({
  glyph,
  label,
  badge,
}: {
  glyph: ReactElement
  label: string
  badge: BarSection['badge']
}) {
  return (
    <>
      <span className={PILL}>
        <span className="relative inline-flex">
          {glyph}
          <IconBadge badge={badge} />
        </span>
      </span>
      <span className={LABEL}>{label}</span>
    </>
  )
}

export type SectionBarProps = {
  model: BarModel
  /** The section whose list is open, if any. */
  openId: string | null
  /** The id of the list a section slot controls. */
  listId: string
  onSection: (section: BarSection, slot: HTMLElement) => void
  moreOpen: boolean
  onMore: () => void
  /** A text field has focus: the bar steps out of the keyboard's way. */
  hidden: boolean
  /** The bar's box, for the drawer's geometry: it ends where the bar begins. */
  hostRef?: (el: HTMLElement | null) => void
}

export function SectionBar({
  model,
  openId,
  listId,
  onSection,
  moreOpen,
  onMore,
  hidden,
  hostRef,
}: SectionBarProps): ReactElement {
  return (
    <div
      ref={hostRef}
      data-slot="shell-phone-bar-host"
      data-hidden={hidden ? '' : undefined}
      className={cn('relative z-40 flex flex-col data-hidden:hidden')}
    >
      <div className="border-t border-border bg-card pb-(--phone-safe-b) ps-(--phone-safe-l) pe-(--phone-safe-r)">
        <nav
          data-slot="shell-phone-bar"
          aria-label={SHELL_TEXT.primary}
          className="flex h-16 items-stretch px-1"
        >
          {model.sections.map((section) => {
            const face = (
              <Face
                glyph={<DestinationGlyph icon={section.icon} short={section.label} />}
                label={section.label}
                badge={section.badge}
              />
            )
            const label = badgedLabel(section.label, section.badge)
            if (section.only !== undefined) {
              return (
                <SlotLink key={section.id} row={section.only} label={label} className={TAB}>
                  {face}
                </SlotLink>
              )
            }
            const open = openId === section.id
            return (
              <button
                key={section.id}
                type="button"
                aria-label={label}
                aria-expanded={open}
                aria-controls={listId}
                data-active={section.active ? '' : undefined}
                data-open={open ? '' : undefined}
                className={TAB}
                onClick={(event) => onSection(section, event.currentTarget)}
              >
                {face}
              </button>
            )
          })}
          <button
            type="button"
            data-slot="shell-phone-more"
            aria-label={badgedLabel(VARIANT_TEXT.more, model.more.badge)}
            aria-expanded={moreOpen}
            data-active={model.more.active ? '' : undefined}
            data-open={moreOpen ? '' : undefined}
            className={TAB}
            onClick={onMore}
          >
            <Face glyph={<MoreGlyph />} label={VARIANT_TEXT.more} badge={model.more.badge} />
          </button>
        </nav>
      </div>
    </div>
  )
}
