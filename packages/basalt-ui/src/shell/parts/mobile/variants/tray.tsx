/**
 * A, the tray: tapping a section grows its short list out of the bar, attached to it, from the
 * tapped icon (the owner's dock reference, without the floating pill). Each row is a destination
 * with its icon, name and badge; a tap navigates and closes. A tap outside, on the section again or
 * Escape closes; another section swaps the rows while the tray eases to their measured height.
 */
import { useEffect, useId, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../../../../core/cn'
import { destinationRows } from '../more-surface'
import { useKeyboardUp } from './chrome-state'
import { projectionInput, useNavState } from './host'
import type { VariantProps } from './host'
import { LIST_CAP, useMeasuredHeight } from './measure'
import { barModel } from './model'
import { SectionBar } from './section-bar'
import { PhoneSidebar } from './sidebar'

export function PhoneTray(props: VariantProps): ReactElement {
  const state = useNavState(props)
  const model = barModel(projectionInput(props, state), props.runtime.nav.sections)
  const [openId, setOpenId] = useState<string | null>(null)
  // What the tray shows: kept while it closes, so it shrinks over the rows it held.
  const [shownId, setShownId] = useState<string | null>(null)
  // The tapped icon's centre: the tray grows out of it.
  const [origin, setOrigin] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const keyboard = useKeyboardUp()
  const listId = useId()
  const [inner, height] = useMeasuredHeight()
  const open = openId !== null
  const close = (): void => setOpenId(null)
  const shown = model.sections.find((section) => section.id === shownId)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const style: CSSProperties = { height: open ? height : 0, transformOrigin: `${origin}px 100%` }

  return (
    <div ref={setAnchor} className="contents">
      {open && (
        <div
          aria-hidden="true"
          data-slot="shell-phone-list-scrim"
          className="fixed inset-0 z-30"
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
        onSection={(section, slot) => {
          if (openId === section.id) {
            close()
            return
          }
          const box = slot.getBoundingClientRect()
          setOrigin(box.left + box.width / 2)
          setOpenId(section.id)
          setShownId(section.id)
        }}
        onMore={() => {
          close()
          setMoreOpen(!moreOpen)
        }}
      >
        <section
          id={listId}
          aria-label={shown?.label}
          data-slot="shell-phone-tray"
          data-open={open ? '' : undefined}
          inert={!open}
          style={style}
          className={cn(
            'overflow-hidden rounded-t-card border-t border-border bg-card text-foreground shadow-overlay',
            'scale-75 opacity-0 data-open:scale-100 data-open:opacity-100',
            '[transition-property:height,scale,opacity] duration-base ease-standard motion-reduce:transition-none',
          )}
        >
          <div
            ref={inner}
            data-slot="shell-phone-list"
            className={cn(LIST_CAP, 'ps-(--phone-safe-l) pe-(--phone-safe-r) py-1')}
          >
            {shown === undefined ? null : destinationRows(shown.rows, 0, close)}
          </div>
        </section>
      </SectionBar>
      <PhoneSidebar open={moreOpen} onOpenChange={setMoreOpen} anchor={anchor} props={props} />
    </div>
  )
}
