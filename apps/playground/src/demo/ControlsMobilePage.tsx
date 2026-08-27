/**
 * ControlsMobilePage — the phone surface for `docs/CONTROLS-SPEC.md` §2.1/§3, and the ONE behaviour
 * no consumer has run yet: the in-flow sticky row 2 with a table scrolling under it.
 *
 * Narrow the window below `sm` and five things have to happen, none of them written here:
 *
 * 1. Row 1 keeps the breadcrumb, renders `primary` as an icon button, and folds every other action
 *    into ONE kebab — shared with the shell's `mobile: 'more'` global actions (law C7).
 * 2. Row 2 keeps the first `FilterSet` pill inline and folds the other four into a `Filters (n)`
 *    pill; `n` counts the fields that differ from their fallback, so it is the store's arithmetic,
 *    not a hand-kept number.
 * 3. The sheet renders every filter full-width at 44px rows, applies immediately, and offers
 *    `Reset all` (law C15).
 * 4. The `stickyHeader` table's head parks under row 2 via `--basalt-page-bar-h`, the measured
 *    height basalt publishes — there is no `useEffect` and no hardcoded fallback in this file.
 * 5. `ViewTabs` past three options becomes a `Select` rather than a squeezed segmented control.
 *
 * Every control is bound to a `FieldHandle`, so nothing here holds filter state and nothing here
 * branches on a viewport: the responsive swap belongs to the control (law C9).
 */
import { Stack, Text } from '@mantine/core'
import { PageBar, Section } from 'basalt-ui'
import {
  CompareFilter,
  FilterSet,
  MultiSelectFilter,
  NumberFilter,
  RangeFilter,
  SearchFilter,
  SelectFilter,
  ToggleFilter,
  ViewTabs,
} from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { VX } from 'basalt-ui/tokens'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data'
import { field } from 'basalt-ui/router-tanstack'
import { createLocalStore } from 'basalt-ui/state'
import { CHANNEL_KEYS, integer } from './analytics-data'
import { mobileFilters } from './controls-mobile-store'
import { IconCurrency, IconSearch, IconSettings } from './icons'

/**
 * The section's view axis is LOCAL — five options, so `ViewTabs` renders a `Select` below `sm`.
 * `createLocalStore` gives it the same `FieldHandle` a URL-lane field has, which is exactly why a
 * view tab never needs `useState` (law C3).
 */
const sectionView = createLocalStore({
  key: 'controls-mobile-view',
  fields: {
    view: field.enum(['all', 'new', 'returning', 'churned', 'flagged'], 'all'),
  },
}).labels({
  view: {
    all: 'All',
    new: 'New',
    returning: 'Returning',
    churned: 'Churned',
    flagged: 'Flagged',
  },
})

type Row = { customer: string; channel: string; orders: number; revenue: number }

/** Deterministic, so re-rendering under a sheet cannot reshuffle the table behind it. */
const ROWS: Row[] = Array.from({ length: 60 }, (_, index) => ({
  customer: `customer-${String(index + 1).padStart(3, '0')}`,
  channel: CHANNEL_KEYS[index % CHANNEL_KEYS.length]!,
  orders: 3 + ((index * 7) % 29),
  revenue: 180 + ((index * 137) % 2400),
}))

const col = createColumnHelper<Row>()

const COLUMNS = [
  col.accessor('customer', { header: 'Customer' }),
  col.accessor('channel', { header: 'Channel' }),
  col.accessor('orders', { header: 'Orders', meta: { align: 'right' } }),
  col.accessor('revenue', {
    header: 'Revenue',
    meta: { align: 'right' },
    cell: (info) => integer(info.getValue()),
  }),
]

export function ControlsMobilePage() {
  const active = mobileFilters.useActiveCount()

  return (
    <Stack gap={14}>
      <PageBar
        actions={{
          primary: { key: 'export', label: 'Export', onClick: () => {} },
          secondary: [
            { key: 'share', label: 'Share view', onClick: () => {} },
            { key: 'schedule', label: 'Schedule report', onClick: () => {} },
            { key: 'archive', label: 'Archive', onClick: () => {}, danger: true },
            {
              key: 'more',
              kind: 'menu',
              label: 'Developer',
              items: [
                { key: 'copy-url', label: 'Copy the URL', onClick: () => {} },
                { key: 'reset', label: 'Reset every filter', onClick: () => {} },
              ],
            },
          ],
        }}
        sync={{ syncing: false, lastCompletedAt: null, onSync: () => {} }}
        filters={
          <FilterSet>
            <RangeFilter field={mobileFilters.field.range} customPicker={DateRangePicker} />
            <CompareFilter field={mobileFilters.field.compare} />
            <SelectFilter
              field={mobileFilters.field.currency}
              label="Currency"
              icon={<IconCurrency />}
              clearable
            />
            <MultiSelectFilter
              field={mobileFilters.field.channels}
              label="All channels"
              noun="channels"
            />
            {/* The stepper form — no `options`, so the pill's popover holds a `ctl` NumberInput
                that applies on blur or Enter, and the sheet renders it as a full-width row. The
                pill reads the VALUE like every other pill, mono because the value is a number. */}
            <NumberFilter field={mobileFilters.field.minDuration} label="Min duration" step={30} />
            <SearchFilter field={mobileFilters.field.query} placeholder="Find a customer" />
            <ToggleFilter field={mobileFilters.field.verified} label="Verified only" />
          </FilterSet>
        }
        filtersEnd={[
          { key: 'metrics', label: 'Manage metrics', icon: <IconSettings />, onClick: () => {} },
        ]}
      />

      {/* One line. The page's subject is the CONTROLS; three paragraphs of explanation pushed the
          filter row, the section header and the table's own toolbar apart far enough that the
          rhythm this page exists to demonstrate was unreadable. */}
      <Text size="sm" c="dimmed">
        <span data-numeric style={{ color: VX.ink }}>
          {active}
        </span>{' '}
        of seven filters differ from their fallback — the `n` in the `Filters (n)` pill.
      </Text>

      <Section
        id="anchor"
        title="Customers"
        subtitle="A collapsible, anchored section — its fold state survives a reload."
        icon={<IconSearch />}
        collapsible
        persistKey="demo"
        count={ROWS.length}
        tabs={<ViewTabs field={sectionView.field.view} />}
      >
        <BasaltDataTable
          title="All customers"
          data={ROWS}
          columns={COLUMNS}
          stickyHeader
          stickyHeaderOffset="calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))"
          striped
          highlightOnHover
          verticalSpacing="xs"
          enableGlobalFilter
        />
      </Section>
    </Stack>
  )
}
