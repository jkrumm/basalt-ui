/**
 * B, the short drawer: tapping a section raises a short bottom drawer with a grabber, its foot on the
 * bar, listing the section's destinations with their icon, name and badge. A tap navigates and
 * closes; a swipe down, a tap outside, the section again or Escape closes; another section swaps
 * the rows while the drawer eases to their measured height. The bar stays in view and in reach.
 */
import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../../../core/cn'
import { ControlScopeProvider } from '../../../../core/control-scope'
import { destinationRows } from '../more-surface'
import { useKeyboardUp } from './chrome-state'
import { projectionInput, useNavState } from './host'
import type { VariantProps } from './host'
import { LIST_CAP, useMeasuredHeight } from './measure'
import { barModel } from './model'
import { SAFE } from './safe'
import { SectionBar } from './section-bar'
import { PhoneSidebar } from './sidebar'

export function PhoneDrawer(props: VariantProps): ReactElement {
  const state = useNavState(props)
  const model = barModel(projectionInput(props, state), props.runtime.nav.sections)
  const [openId, setOpenId] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const keyboard = useKeyboardUp()
  const listId = useId()
  const [inner, height] = useMeasuredHeight()
  const open = openId !== null
  const close = (): void => setOpenId(null)
  const shown = model.sections.find((section) => section.id === shownId)

  return (
    <div ref={setAnchor} className="contents">
      {open && (
        <div
          aria-hidden="true"
          data-slot="shell-phone-list-scrim"
          className="fixed inset-0 z-30 bg-scrim"
          onPointerDown={(event) => {
            event.preventDefault()
            close()
          }}
        />
      )}
      <SectionBar
        model={model}
        openId={openId}
        listId={listId}
        hidden={keyboard}
        moreOpen={moreOpen}
        onSection={(section) => {
          if (openId === section.id) {
            close()
            return
          }
          setOpenId(section.id)
          setShownId(section.id)
        }}
        onMore={() => {
          close()
          setMoreOpen(!moreOpen)
        }}
      />
      {/* Not modal: the bar under it stays live, so its section slots switch or close the list.
          Taps outside are the scrim's, which spares the bar. */}
      <BaseDrawer.Root
        open={open}
        modal={false}
        disablePointerDismissal
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <ControlScopeProvider value={null}>
          <BaseDrawer.Portal>
            <BaseDrawer.Viewport
              className={cn(
                SAFE,
                'pointer-events-none fixed inset-x-0 top-0 bottom-[calc(--spacing(16)+1px+var(--phone-safe-b))] z-30 flex flex-col justify-end overflow-hidden md:hidden',
              )}
            >
              <BaseDrawer.Popup
                id={listId}
                data-slot="shell-phone-sheet"
                className={cn(
                  'pointer-events-auto flex w-full flex-col rounded-t-card bg-popover text-foreground shadow-overlay ring-1 ring-border outline-none',
                  'translate-y-[var(--drawer-swipe-movement-y,0px)] transition-transform duration-slow ease-standard',
                  'data-starting-style:translate-y-full data-ending-style:translate-y-full data-swiping:transition-none motion-reduce:transition-none',
                )}
              >
                <div aria-hidden="true" className="flex shrink-0 justify-center pt-2 pb-1">
                  <span
                    data-slot="shell-phone-grabber"
                    className="h-1 w-9 rounded-full bg-border"
                  />
                </div>
                <BaseDrawer.Title className="px-4 pb-1 text-micro font-medium text-muted-foreground">
                  {shown?.label}
                </BaseDrawer.Title>
                <div
                  style={{ height }}
                  className="overflow-hidden transition-[height] duration-base ease-standard motion-reduce:transition-none"
                >
                  <BaseDrawer.Content
                    ref={inner}
                    data-slot="shell-phone-list"
                    className={cn(LIST_CAP, 'ps-(--phone-safe-l) pe-(--phone-safe-r) pb-1')}
                  >
                    {shown === undefined ? null : destinationRows(shown.rows, 0, close)}
                  </BaseDrawer.Content>
                </div>
              </BaseDrawer.Popup>
            </BaseDrawer.Viewport>
          </BaseDrawer.Portal>
        </ControlScopeProvider>
      </BaseDrawer.Root>
      <PhoneSidebar open={moreOpen} onOpenChange={setMoreOpen} anchor={anchor} props={props} />
    </div>
  )
}
