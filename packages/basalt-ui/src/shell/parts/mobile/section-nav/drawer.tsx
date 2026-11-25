/**
 * The phone's section drawer: tapping a section raises a short bottom drawer over the bar, its foot on
 * the bar, with a grabber and the section's destinations (icon, name, badge). It rests at a short snap
 * (the whole list, at most down to the middle of the screen) and a tall one (the whole list, at most
 * 85 % of the screen): a drag up grows it, a drag down shrinks it and then closes it, and at the tall
 * snap the list scrolls inside, handing the gesture back to the drawer when it is scrolled to its top.
 * A tap navigates and closes; a tap on the dimmed page, the section again or Escape closes; another
 * section swaps the rows (a cross-fade) while the drawer eases to the new height. The bar stays in
 * view and in reach. Every move is on the kit's motion tokens and a transition, so a tap mid-motion
 * reverses it from where it is.
 */
import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { useEffect, useId, useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../../../core/cn'
import { ControlScopeProvider } from '../../../../core/control-scope'
import { MOTION_DURATION_MS } from '../../../../tokens/motion'
import { destinationRows } from '../more-surface'
import { useKeyboardUp } from './chrome-state'
import { projectionInput, useNavState } from './host'
import type { VariantProps } from './host'
import { useMeasuredHeight } from './measure'
import { barModel } from './model'
import type { BarSection } from './model'
import { SearchGlyph, VARIANT_TEXT } from './parts'
import { SAFE } from './safe'
import { SectionBar } from './section-bar'
import { PhoneSidebar } from './sidebar'
import { drawerSizes } from './snaps'

/** Which rest the reader last chose: it carries over a section switch. */
type Rest = 'short' | 'tall'

/**
 * A section's rows. When the section changes the rows that were there stay one beat on top and fade
 * out (`inert`, out of the accessibility tree) while the new ones fade in, so a switch cross-fades.
 */
function SectionRows({
  section,
  close,
  rowsRef,
}: {
  section: BarSection | undefined
  close: () => void
  rowsRef: (el: HTMLElement | null) => void
}): ReactElement {
  const [shownId, setShownId] = useState(section?.id)
  const [last, setLast] = useState(section)
  const [leaving, setLeaving] = useState<BarSection | undefined>(undefined)
  const [fading, setFading] = useState(false)
  if (section?.id !== shownId) {
    setShownId(section?.id)
    setLeaving(last)
    setFading(false)
  }
  if (section !== last) setLast(section)
  useEffect(() => {
    if (leaving === undefined) return undefined
    const frame = requestAnimationFrame(() => setFading(true))
    const done = setTimeout(() => setLeaving(undefined), MOTION_DURATION_MS.base + 50)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
  }, [leaving])
  return (
    <div className="relative">
      <div
        key={section?.id}
        ref={rowsRef}
        className={cn(
          'ps-(--phone-safe-l) pe-(--phone-safe-r) pb-1',
          leaving !== undefined && 'animate-enter-item',
        )}
      >
        {section === undefined ? null : destinationRows(section.rows, 0, close)}
      </div>
      {leaving !== undefined && (
        <div
          inert
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 ps-(--phone-safe-l) pe-(--phone-safe-r) pb-1',
            '[transition:opacity_var(--basalt-dur-base)_var(--basalt-ease)]',
            fading && 'opacity-0',
          )}
        >
          {destinationRows(leaving.rows, 0, close)}
        </div>
      )}
    </div>
  )
}

export function PhoneDrawer(props: VariantProps): ReactElement {
  const state = useNavState(props)
  const model = barModel(projectionInput(props, state), props.runtime.nav.sections)
  const [openId, setOpenId] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [rest, setRest] = useState<Rest>('short')
  const keyboard = useKeyboardUp()
  const listId = useId()
  const [barRef, bar] = useMeasuredHeight()
  const [areaRef, area] = useMeasuredHeight()
  const [headRef, head] = useMeasuredHeight()
  const [rowsRef, rows] = useMeasuredHeight()
  const open = openId !== null
  const close = (): void => setOpenId(null)
  const shown = model.sections.find((section) => section.id === shownId)
  const sizes = drawerSizes({ natural: head + rows, area, bar })
  const shortPoint = sizes === null ? null : `${sizes.short}px`
  const tallPoint = sizes === null ? null : `${sizes.tall}px`
  const atTall = sizes !== null && (!sizes.snaps || rest === 'tall')
  // The list scrolls only where the drawer stands as tall as it goes and still cannot show every row.
  const scrolls = sizes !== null && atTall && rows > sizes.tall - head + 1
  const search = props.search

  return (
    <div ref={setAnchor} className="contents">
      <SectionBar
        model={model}
        openId={openId}
        listId={listId}
        hidden={keyboard}
        moreOpen={moreOpen}
        hostRef={barRef}
        onSection={(section) => {
          if (openId === section.id) {
            close()
            return
          }
          if (openId === null) setRest('short')
          setOpenId(section.id)
          setShownId(section.id)
        }}
        onMore={() => {
          close()
          setMoreOpen(!moreOpen)
        }}
      />
      {/* Not modal: the bar under it stays live, so its section slots switch or close the drawer.
          The dimmed page behind is the backdrop's, which spares the bar (z-30 under its z-40). */}
      <BaseDrawer.Root
        open={open}
        modal={false}
        disablePointerDismissal
        // One rest at a time: a flick down from the tall snap lands on the short one, a second closes it.
        snapToSequentialPoints
        snapPoints={
          shortPoint === null || tallPoint === null
            ? undefined
            : sizes?.snaps
              ? [shortPoint, tallPoint]
              : [shortPoint]
        }
        snapPoint={shortPoint === null ? null : atTall && sizes?.snaps ? tallPoint : shortPoint}
        onSnapPointChange={(point) =>
          setRest(point === tallPoint && point !== null ? 'tall' : 'short')
        }
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <ControlScopeProvider value={null}>
          {/* Outside the portal, so it sits in the shell's stacking context: under the bar (z-40), over the page. */}
          <BaseDrawer.Backdrop
            data-slot="shell-phone-list-scrim"
            onPointerDown={(event) => {
              event.preventDefault()
              close()
            }}
            className={cn(
              'fixed inset-0 z-30 bg-scrim',
              '[transition:opacity_var(--basalt-dur-base)_var(--basalt-ease)] data-starting-style:opacity-0 data-ending-style:opacity-0',
            )}
          />
          <BaseDrawer.Portal>
            <BaseDrawer.Viewport
              ref={areaRef}
              className={cn(
                SAFE,
                'pointer-events-none fixed inset-x-0 top-0 bottom-[calc(--spacing(16)+1px+var(--phone-safe-b))] z-30 flex flex-col justify-end overflow-hidden md:hidden',
              )}
            >
              <BaseDrawer.Popup
                id={listId}
                data-slot="shell-phone-sheet"
                style={sizes === null ? undefined : { height: sizes.popup }}
                className={cn(
                  'pointer-events-auto flex w-full shrink-0 flex-col overflow-hidden rounded-t-card bg-popover text-foreground shadow-overlay ring-1 ring-border outline-none',
                  // The snap offset rests the popup at a short or tall height; a drag adds to it.
                  'translate-y-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px))]',
                  '[transition:translate_var(--basalt-spring),opacity_var(--basalt-dur-base)_var(--basalt-ease)]',
                  'data-starting-style:translate-y-full data-starting-style:opacity-0 data-ending-style:translate-y-full data-ending-style:opacity-0',
                  // A drag follows the finger; reduced motion fades in place instead of sliding.
                  'data-swiping:[transition:none] motion-reduce:[transition:opacity_var(--basalt-dur-base)_var(--basalt-ease)]',
                )}
              >
                <div ref={headRef} className="shrink-0">
                  <div aria-hidden="true" className="flex touch-none justify-center pt-2 pb-1">
                    <span
                      data-slot="shell-phone-grabber"
                      className="h-1 w-9 rounded-full bg-border"
                    />
                  </div>
                  <div
                    className={cn(
                      'flex items-center ps-4 pe-1',
                      search !== undefined && 'min-h-11',
                    )}
                  >
                    <BaseDrawer.Title className="min-w-0 flex-1 truncate py-1 text-micro font-medium text-muted-foreground">
                      {shown?.label}
                    </BaseDrawer.Title>
                    {search !== undefined && (
                      <button
                        type="button"
                        data-slot="shell-phone-search"
                        aria-label={VARIANT_TEXT.search}
                        className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-ctrl text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-ring"
                        onClick={() => {
                          close()
                          search.onOpen()
                        }}
                      >
                        <SearchGlyph />
                      </button>
                    )}
                  </div>
                </div>
                <BaseDrawer.Content
                  data-slot="shell-phone-list"
                  className={cn(
                    'min-h-0 flex-1 overscroll-contain',
                    scrolls ? 'overflow-y-auto' : 'overflow-hidden',
                  )}
                >
                  <SectionRows section={shown} close={close} rowsRef={rowsRef} />
                </BaseDrawer.Content>
              </BaseDrawer.Popup>
            </BaseDrawer.Viewport>
          </BaseDrawer.Portal>
        </ControlScopeProvider>
      </BaseDrawer.Root>
      <PhoneSidebar open={moreOpen} onOpenChange={setMoreOpen} anchor={anchor} props={props} />
    </div>
  )
}
