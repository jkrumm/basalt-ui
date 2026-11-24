/**
 * The phone nav on a phone: the section bar with its short drawer runs on every page of this
 * playground over one `defineNav`. Tap a section to raise its drawer, drag it up for the tall snap
 * (the list scrolls inside) or down to close, tap More for the sidebar. The field below raises the
 * keyboard; the cards below it give the page enough length to scroll.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import { Input } from 'basalt-ui/ui/input'
import type { ReactElement } from 'react'

/** Filler for the scroll check. */
const FILLER = Array.from({ length: 8 }, (_, index) => index + 1)

function MobileNavRoute(): ReactElement {
  return (
    <Page area="kit-mobile-nav">
      <Section
        title="Phone navigation"
        summary="One slot per section, its badge the sum of its pages. A tap raises a short drawer over the bar; a drag up grows it, a drag down shrinks and closes it. More slides the app aside and shows the sidebar."
      >
        <Card>
          <p className="text-sm text-muted-foreground">
            An app that wants the tab bar sets data-phone-nav="tabs" on the document element.
          </p>
        </Card>
      </Section>
      <Section
        title="Keyboard"
        summary="Tap the field: the bar steps out of the keyboard’s way and returns on blur."
      >
        <Input
          aria-label="Try the keyboard"
          placeholder="Tap to raise the keyboard"
          autoComplete="off"
        />
      </Section>
      <Section title="Scroll" summary="Rows to scroll: the last one ends above the bar.">
        <div className="grid gap-2">
          {FILLER.map((n) => (
            <Card key={n}>
              <p className="text-sm text-muted-foreground">Row {n} of the scroll check.</p>
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/mobile-nav')({
  staticData: { title: 'Mobile nav' },
  component: MobileNavRoute,
})
