/**
 * Fixture `root` (quality-contract section 5, row `.`): what the root subpath owns, rendered with
 * `locale` and `timeZone` as props identical on both sides. It formats through `useFormat` (never
 * `navigator`), and `lang` is written by the provider's effect, so it is absent from the server HTML.
 *
 * `src/index.ts` is still the 2.x barrel while the v3 core is being wired in, so the v3 members of
 * `.` are imported from `src/core`, where they live. When the barrel re-exports them, this file
 * switches to `../../../../src` and nothing else changes.
 */
import { createFormat, useFormat } from '../../../../src/core/format'
import { BasaltProvider } from '../../../../src/core/provider'
import { IntlScope } from '../../../../src/core/provider-props'

/** 2026-01-01 23:30 UTC: already Jan 2 in Berlin, so a wrong zone shows as a different day. */
const MOMENT = new Date(Date.UTC(2026, 0, 1, 23, 30))

function Figures() {
  const f = useFormat()
  return (
    <ul data-slot="fixture">
      <li>{f.number(1234567.891)}</li>
      <li>{f.percent(0.256)}</li>
      <li>{f.money(1999.5, 'EUR')}</li>
      <li>{f.date(MOMENT, 'long')}</li>
      <li>{f.time(MOMENT)}</li>
    </ul>
  )
}

/** The same figures from the pure path a non-React model module uses. */
export function expected(options: { locale: string; timeZone: string }): string[] {
  const f = createFormat(options)
  return [
    f.number(1234567.891),
    f.percent(0.256),
    f.money(1999.5, 'EUR'),
    f.date(MOMENT, 'long'),
    f.time(MOMENT),
  ]
}

export function Page({ locale, timeZone }: { locale: string; timeZone: string }) {
  return (
    <BasaltProvider locale={locale}>
      <IntlScope locale={locale} timeZone={timeZone}>
        <Figures />
      </IntlScope>
    </BasaltProvider>
  )
}
