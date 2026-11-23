import { BarList, type Phase } from 'basalt-ui/cards'
import { ChartCard, chartLabels, useChartFocus, type ChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import type { CSSProperties } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { TAX_YEAR, bookingsFor } from './fixture'
import {
  TAG_LABEL,
  TAG_ORDER,
  splitOf,
  totalOf,
  untaggedMerchants,
  type TagKey,
  type Merchant,
  type Split,
} from './model'

/** One blue for untagged in the bar and the list: the brand token, as a pair the list's series takes. */
const UNTAGGED = { light: BASALT.brand, dark: BASALT.brand }

const PART_COLOR: Record<TagKey, string> = {
  business: BASALT.ink,
  home: BASALT.inkMuted,
  donation: BASALT.inkFaint,
  none: BASALT.brand,
}

const PART_TEXT: Record<TagKey, string> = {
  business: BASALT.canvas,
  home: BASALT.canvas,
  donation: BASALT.ink,
  none: BASALT.canvas,
}

/** The track's width in px at the narrowest card (390): a segment names itself only where its label fits. */
const TRACK_PX = 320

const noop = (): void => {}

/** The split bar and the rows under it: one split, so the bar and the rows never disagree. */
function SplitView({
  split,
  tagFocus,
  money,
  percent,
}: {
  split: Split
  tagFocus: ChartFocus<TagKey>
  money: (n: number) => string
  percent: (f: number) => string
}) {
  const total = totalOf(split)
  const label = (key: TagKey): string => {
    const share = split[key] / total
    const named = key === 'none' ? `${percent(share)} untagged` : percent(share)
    const box = { width: share * TRACK_PX }
    const opts = { size: BASALT.text.xs, pad: 4 }
    if (chartLabels.fits(named, box, opts)) return named
    return chartLabels.fits(percent(share), box, opts) ? percent(share) : ''
  }
  return (
    <div className="flex flex-col gap-3">
      <div
        {...tagFocus.target}
        aria-label="Spending by tax tag"
        className="flex h-10 overflow-hidden rounded-chip"
      >
        {TAG_ORDER.map((key, i) => (
          <div
            key={key}
            {...tagFocus.item(i)}
            className="flex w-(--share) items-center justify-center overflow-hidden bg-(--part) text-xs text-(--on) tabular-nums"
            style={
              {
                '--share': `${total === 0 ? 0 : (split[key] / total) * 100}%`,
                '--part': PART_COLOR[key],
                '--on': PART_TEXT[key],
              } as CSSProperties
            }
          >
            {total === 0 ? null : label(key)}
          </div>
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm tabular-nums">
        {TAG_ORDER.map((key, i) => (
          <li
            key={key}
            {...tagFocus.item(i)}
            className="flex items-center gap-2 rounded-chip data-focused:bg-selected"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-(--part)"
              style={{ '--part': PART_COLOR[key] } as CSSProperties}
            />
            <span className="flex-1 truncate">{TAG_LABEL[key]}</span>
            <span>{split[key] === 0 ? 'none booked' : money(split[key])}</span>
          </li>
        ))}
      </ul>
      {tagFocus.live}
    </div>
  )
}

export function ExprN29Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const money = (n: number) => fmt.money(n, 'EUR', { maximumFractionDigits: 0 })
  const percent = (f: number) => fmt.percent(f, { maximumFractionDigits: 0 })

  const rows = shotState === 'empty' ? [] : bookingsFor(fixture)
  const merchants: readonly Merchant[] = untaggedMerchants(rows)
  const focus = useChartFocus(merchants, {
    announce: (m) =>
      `${m.name}: ${money(m.untagged)} untagged in ${m.untaggedBookings} of ${m.bookings} bookings, ${money(m.total - m.untagged)} tagged`,
  })

  const phase: Phase | undefined =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop }
        : undefined
  const ready = phase === undefined && rows.length > 0

  const year = splitOf(rows)
  const shown = focus.readout(year, (m) => m.split)
  const tagged = totalOf(shown) - shown.none
  const share = totalOf(shown) === 0 ? 0 : tagged / totalOf(shown)
  const whole = totalOf(shown)
  const tagFocus = useChartFocus(TAG_ORDER, {
    announce: (key) =>
      `${TAG_LABEL[key]}: ${shown[key] === 0 ? 'none booked' : money(shown[key])}, ${whole === 0 ? '0%' : percent(shown[key] / whole)}`,
  })
  const subject = focus.datum === null ? 'spent' : `at ${focus.datum.name}`
  const untaggedCount = rows.filter((b) => b.tag === null).length

  return (
    <Page>
      <PageBar title={`Tax year ${TAX_YEAR}: what is tagged`} />
      <div className="@container">
        <div className="grid items-start gap-3 @wide:grid-cols-2">
          <ChartCard
            title="Spending tagged for tax"
            subtitle={ready ? `${rows.length} bookings` : undefined}
            phase={phase}
            empty={
              rows.length === 0
                ? {
                    cause: `No bookings for ${TAX_YEAR} yet. Import a bank export to see what is tagged.`,
                    action: { label: 'Import bookings', onClick: noop },
                  }
                : null
            }
            // cycle-expression-8: a ChartCard that mounts into loading keeps only its declared rows, so the 390 loading card is shorter than the ready one.
            height="short"
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n29, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: tagFocus.readout(percent(share), (key) => percent(shown[key] / whole)),
                    period: tagFocus.readout(
                      `tagged, ${money(tagged)} of ${money(whole)} ${subject}`,
                      (key) =>
                        `${TAG_LABEL[key].toLowerCase()}, ${money(shown[key])} of ${money(whole)} ${subject}`,
                    ),
                  }
                : { value: null }
            }
            footer={
              ready
                ? [
                    {
                      label: 'Untagged bookings',
                      value: focus.readout(untaggedCount, (m) => m.untaggedBookings),
                    },
                  ]
                : undefined
            }
            chart={() => (
              <SplitView split={shown} tagFocus={tagFocus} money={money} percent={percent} />
            )}
          />
          <BarList
            title="Merchants with untagged bookings"
            subtitle="most untagged spend first"
            phase={phase}
            empty={
              rows.length === 0
                ? { cause: 'Nothing to rank until bookings are imported.' }
                : merchants.length === 0
                  ? { cause: 'Every booking carries a tax tag.' }
                  : null
            }
            items={merchants.map((m) => ({
              key: m.name,
              label: m.name,
              value: m.untagged,
              secondary: `${m.untaggedBookings} of ${m.bookings}`,
              parts: { untagged: m.untagged },
            }))}
            // cycle-expression-8: BarList prints its series legend whenever rows carry parts, so a one-series list repeats its title; its error reads 'Could not load this.' and its rows take no mono for names.
            series={[{ key: 'untagged', label: 'Untagged spend', color: UNTAGGED }]}
            bodyRows={6}
            format={money}
            focus={focus}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
