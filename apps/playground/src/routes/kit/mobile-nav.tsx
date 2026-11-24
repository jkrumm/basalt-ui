/**
 * The phone nav trial (Issue 3205): the two variants the owner compares on his phone, each running
 * on every page of this playground over the same `defineNav`. The switch here and in the header
 * picks one and the device remembers it; `?nav=a|b|default` on any address does the same. The
 * field below raises the keyboard; the cards below it give the page enough length to scroll.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import { Input } from 'basalt-ui/ui/input'
import type { ReactElement } from 'react'
import { PHONE_NAV_PICKS, PhoneNavSwitch, phoneNav } from '../../lib/phone-nav'

const WHAT: Record<(typeof PHONE_NAV_PICKS)[number]['value'], string> = {
  default:
    'The shipped tab bar: five fixed slots with 11 px labels, a dot for a badge, More as a sheet.',
  a: 'One slot per section, its badge the sum of its pages. A tap grows the section’s pages out of the bar, from the icon you tapped. More slides the app aside and shows the sidebar.',
  b: 'The same section bar. A tap raises a short drawer with a grabber over the bar, holding the section’s pages. More slides the app aside and shows the sidebar.',
}

/** Filler for the scroll checks: hide on scroll (B), shrink on scroll (C). */
const FILLER = Array.from({ length: 8 }, (_, index) => index + 1)

function MobileNavRoute(): ReactElement {
  const [pick] = phoneNav.use()
  const current = PHONE_NAV_PICKS.find((entry) => entry.value === pick) ?? PHONE_NAV_PICKS[0]
  return (
    <Page area="kit-mobile-nav">
      <Section title="Phone navigation" summary={`Running: ${current.name}`}>
        <PhoneNavSwitch fill />
        <div className="grid gap-2">
          {PHONE_NAV_PICKS.map((entry) => (
            <Card key={entry.value}>
              <p className="text-sm font-medium text-foreground">
                {entry.label === 'Now' ? entry.name : `${entry.label} · ${entry.name}`}
              </p>
              <p className="text-sm text-muted-foreground">{WHAT[entry.value]}</p>
            </Card>
          ))}
        </div>
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
