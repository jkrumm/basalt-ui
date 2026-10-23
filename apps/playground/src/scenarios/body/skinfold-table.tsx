/** The skinfold history table with a danger row action (argo UPSTREAM Wave 52). */
import { Box } from '@mantine/core'
import { IconTrash } from '../../demo/icons'
import { EmptyState, Section } from 'basalt-ui'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { FixedClockTime } from '../FixedClockTime'
import { noop, queryFor } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { CALIPER_GAP, CALIPER_NEXT, READING_DATE, SKINFOLD_ERROR } from './body-data'

const READING = READING_DATE
const fullDate = (date: Date): string =>
  date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

type Skinfold = {
  date: Date
  chest: number
  abdomen: number
  thigh: number
  sum: number
}

const row = (date: string, chest: number, abdomen: number, thigh: number): Skinfold => ({
  date: new Date(date),
  chest,
  abdomen,
  thigh,
  sum: chest + abdomen + thigh,
})

const SKINFOLDS: Skinfold[] = [
  row('2026-10-19T07:30:00Z', 8, 16, 12),
  row('2026-10-05T07:30:00Z', 8, 17, 12),
  row('2026-09-21T07:30:00Z', 9, 18, 13),
  row('2026-09-07T07:30:00Z', 9, 19, 13),
  row('2026-08-24T07:30:00Z', 10, 21, 14),
  row('2026-08-10T07:30:00Z', 11, 22, 15),
]

const col = createColumnHelper<Skinfold>()

const COLUMNS = [
  col.accessor('date', {
    header: 'Measured',
    cell: (c) => <FixedClockTime date={c.getValue()} now={READING} full={fullDate(c.getValue())} />,
    meta: { kind: 'relative-time', priority: 1 },
  }),
  col.accessor('chest', { header: 'Chest (mm)', meta: { kind: 'number', priority: 3 } }),
  col.accessor('abdomen', { header: 'Abdomen (mm)', meta: { kind: 'number', priority: 3 } }),
  col.accessor('thigh', { header: 'Thigh (mm)', meta: { kind: 'number', priority: 3 } }),
  col.accessor('sum', { header: 'Sum (mm)', meta: { kind: 'number', priority: 2 } }),
]

/** Five short columns never fill a 1440 card: the table ends where its rows do. */
const TABLE_MAX_WIDTH = 640

export function BodySkinfoldTable({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, SKINFOLD_ERROR)
  return (
    <Box data-shot="skinfold-history">
      <Section title="Skinfold history, 10 Aug–19 Oct">
        <Box maw={TABLE_MAX_WIDTH}>
          <BasaltDataTable
            data={shotState === 'empty' ? [] : SKINFOLDS}
            emptyState={
              <EmptyState title={CALIPER_GAP} description={CALIPER_NEXT} tier="section" />
            }
            columns={COLUMNS}
            rowLabel={(r) => r.date.toISOString().slice(0, 10)}
            rowActions={[
              {
                key: 'delete',
                label: 'Delete measurement',
                icon: <IconTrash />,
                danger: true,
                onClick: noop,
              },
            ]}
            {...(query !== undefined && { query })}
          />
        </Box>
      </Section>
    </Box>
  )
}
