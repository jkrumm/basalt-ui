/**
 * The phone nav trial (Issue 3205): which of the shell's two phone nav variants the playground
 * runs, or the shipped tab bar. The pick is remembered on the device, `?nav=a|b|default` on any
 * address sets it (so a link opens a variant on a phone), and it reaches the shell as
 * `data-phone-nav` on the document element. While a variant runs the viewport meta adds `viewport-fit=cover`,
 * so the page runs under the notch and the home indicator and the variants' insets do the work; the
 * shipped bar keeps the meta it always had.
 */
import { persisted } from 'basalt-ui'
import { ControlHome } from 'basalt-ui/controls'
import { Segmented } from 'basalt-ui/ui/segmented'
import type { ReactElement } from 'react'

export const PHONE_NAV_PICKS = [
  { value: 'default', label: 'Now', attribute: undefined, name: 'Shipped tab bar' },
  { value: 'a', label: 'A', attribute: 'tray', name: 'Section bar with a tray' },
  { value: 'b', label: 'B', attribute: 'drawer', name: 'Section bar with a short drawer' },
] as const

export type PhoneNavPick = (typeof PHONE_NAV_PICKS)[number]['value']

const isPick = (value: unknown): value is PhoneNavPick =>
  PHONE_NAV_PICKS.some((pick) => pick.value === value)

export const phoneNav = persisted<PhoneNavPick>('playground-phone-nav', {
  version: 1,
  initial: 'default',
  schema: {
    '~standard': {
      validate: (value) =>
        isPick(value) ? { value } : { issues: [{ message: 'not a phone nav pick' }] },
    },
  },
})

const PLAIN = 'width=device-width, initial-scale=1.0'

function apply(pick: PhoneNavPick): void {
  const attribute = PHONE_NAV_PICKS.find((entry) => entry.value === pick)?.attribute
  const root = document.documentElement
  if (attribute === undefined) root.removeAttribute('data-phone-nav')
  else root.setAttribute('data-phone-nav', attribute)
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', attribute === undefined ? PLAIN : `${PLAIN}, viewport-fit=cover`)
}

/** Reads `?nav=` once, then keeps the document element on the stored pick. Call before the first render. */
export function bootPhoneNav(): void {
  const param = new URLSearchParams(window.location.search).get('nav')
  if (isPick(param)) phoneNav.set(param)
  apply(phoneNav.get())
  phoneNav.subscribe(() => apply(phoneNav.get()))
}

/** The switch: the shipped bar or one of the two variants. */
export function PhoneNavSwitch({ fill = false }: { fill?: boolean }): ReactElement {
  const [pick, setPick] = phoneNav.use()
  return (
    <ControlHome home="aside">
      <Segmented
        aria-label="Phone navigation"
        fill={fill}
        value={pick}
        onValueChange={(value) => {
          if (isPick(value)) setPick(value)
        }}
        options={PHONE_NAV_PICKS.map((entry) => ({
          value: entry.value,
          label: entry.label,
          'aria-label': entry.name,
        }))}
      />
    </ControlHome>
  )
}
