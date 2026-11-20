/**
 * Expression cycle 15 kit fixes, bar value labels (`v3-expr-15-kit-fixes` 1 and 2): the bar charts of
 * n70 (a negative bar and a limit rule), n71 (a fixed domain top and zone captions), n64 (a stack total
 * under a zone caption) and n68 (long labels and a caption) as their scenarios build them. Read by
 * `kit-expr15-labels.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { alpha, BASALT } from '../../../src/tokens'
import { Bars } from '../../../src/charts/parts/bars'

const tone = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

// ---- n70: net per household event, a negative Gift and a limit of 300, the camp clamped at 600 ----
type Net = { name: string; net: number }
const NET: Net[] = [
  { name: 'Ski trip', net: 480 },
  { name: 'Easter', net: 460 },
  { name: 'Bike repair', net: 85 },
  { name: 'Garden party', net: 0 },
  { name: 'Camp', net: 2400 },
  { name: 'Gift', net: -60 },
  { name: 'Dinner', net: 180 },
  { name: 'Cabin', net: 340 },
  { name: 'Market', net: 170 },
]
const euro = (n: number): string => `${n < 0 ? '\u2212' : ''}€${Math.abs(n)}`

function Net({ height }: { height: number }) {
  return (
    <Bars<Net>
      label="Net per entry"
      data={NET}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.name }}
      y={{ title: 'Net, EUR', domain: [-100, 600] }}
      series={[
        {
          mark: 'bar',
          key: 'net',
          label: 'Net',
          color: tone(1),
          y: (d) => d.net,
          format: euro,
          values: true,
          highlight: (d) => d.net > 300,
          legend: false,
        },
      ]}
      refLines={[{ value: 300, color: LINE, dashed: true, label: 'Limit €300' }]}
    />
  )
}

// ---- n71: photos by star rating, a tuple domain whose top is the tallest bar, two zone captions ----
type Star = { key: string; photos: number; kept: boolean }
const STARS: Star[] = [
  { key: 'unrated', photos: 210, kept: false },
  { key: 'one', photos: 300, kept: false },
  { key: 'two', photos: 620, kept: false },
  { key: 'three', photos: 1740, kept: false },
  { key: 'four', photos: 980, kept: true },
  { key: 'five', photos: 430, kept: true },
]
const STAR_NAME: Record<string, string> = {
  unrated: 'Unrated',
  one: '1 star',
  two: '2 stars',
  three: '3 stars',
  four: '4 stars',
  five: '5 stars',
}

function Stars({ height, top }: { height: number; top: number }) {
  return (
    <Bars<Star>
      label="Count by star rating"
      data={STARS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.key, format: (x) => STAR_NAME[String(x)] ?? String(x) }}
      y={{ title: 'Photos', domain: [0, top] }}
      zones={[
        { axis: 'x', from: 'four', to: 'five', fill: alpha(BASALT.brand, 0.1), label: 'Keepers' },
        {
          axis: 'x',
          from: 'unrated',
          to: 'unrated',
          fill: alpha(BASALT.ink, 0.05),
          label: 'Not counted',
        },
      ]}
      series={[
        {
          mark: 'bar',
          key: 'count',
          label: 'Count',
          color: tone(1),
          y: (d) => d.photos,
          values: true,
          highlight: (d) => d.kept,
          format: (n) => n.toLocaleString('en'),
        },
      ]}
    />
  )
}

// ---- n64: picks per day stacked by reason, a day of 'Gateway down' whose total is 92 ----
type Day = { label: string; iu: number; me: number; quota: number; down: number }
const DAYS: Day[] = [
  { label: 'Nov 9', iu: 20, me: 12, quota: 3, down: 0 },
  { label: 'Nov 10', iu: 30, me: 10, quota: 4, down: 0 },
  { label: 'Nov 11', iu: 22, me: 18, quota: 2, down: 0 },
  { label: 'Nov 12', iu: 26, me: 14, quota: 5, down: 0 },
  { label: 'Nov 13', iu: 12, me: 8, quota: 2, down: 70 },
  { label: 'Nov 14', iu: 24, me: 15, quota: 3, down: 0 },
  { label: 'Nov 15', iu: 18, me: 11, quota: 1, down: 0 },
]

function Picks({ height }: { height: number }) {
  return (
    <Bars<Day>
      label="Targets per day"
      data={DAYS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.label }}
      y={{ title: 'Picks' }}
      zones={[
        {
          axis: 'x',
          from: 'Nov 13',
          to: 'Nov 13',
          fill: alpha(BASALT.ink, 0.08),
          label: 'Gateway down',
        },
      ]}
      series={[
        { mark: 'bar', key: 'iu', label: 'iu', color: tone(1), y: (d) => d.iu },
        { mark: 'bar', key: 'me', label: 'me', color: tone(2), y: (d) => d.me },
        { mark: 'bar', key: 'quota', label: 'Quota', color: tone(3), y: (d) => d.quota },
        { mark: 'bar', key: 'down', label: 'Down', color: tone(4), y: (d) => d.down, values: true },
      ]}
    />
  )
}

// ---- n68: usable hours per month over a flat total, labelled 'behind/flat', a zone caption ----
type Month = { month: string; behind: number; flat: number }
const MONTHS: Month[] = [
  ['Jan', 14, 40],
  ['Feb', 30, 60],
  ['Mar', 81, 124],
  ['Apr', 85, 129],
  ['May', 70, 118],
  ['Jun', 40, 88],
  ['Jul', 45, 92],
  ['Aug', 81, 124],
  ['Sep', 74, 120],
  ['Oct', 30, 70],
  ['Nov', 12, 30],
  ['Dec', 8, 22],
].map(([month, behind, flat]) => ({ month, behind, flat }) as Month)

function Months({ height }: { height: number }) {
  return (
    <Bars<Month>
      label="Bars for each month, stacked"
      data={MONTHS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.month }}
      y={{ title: 'Hours' }}
      zones={[
        {
          axis: 'x',
          from: 'Mar',
          to: 'Sep',
          fill: alpha(BASALT.brand, 0.08),
          label: 'Usable Mar to Sep',
        },
      ]}
      series={[
        {
          mark: 'bar',
          key: 'behind',
          label: 'Usable',
          color: tone(1),
          y: (d) => d.behind,
          values: (_, d) => `${d.behind}/${d.flat}`,
        },
        { mark: 'bar', key: 'cost', label: 'Cost', color: tone(2), y: (d) => d.flat - d.behind },
      ]}
    />
  )
}

function Card({ id, wide, children }: { id: string; wide: number; children: React.ReactNode }) {
  return (
    <div data-testid={id} style={{ width: wide }} className="min-w-0 rounded-card bg-card p-3">
      {children}
    </div>
  )
}

function Probe() {
  const phone = window.innerWidth < 600
  const w = phone ? 342 : 1000
  return (
    <div className="flex flex-col gap-6">
      <Card id="x15-net" wide={w}>
        <Net height={phone ? 244 : 320} />
      </Card>
      <Card id="x15-stars" wide={w}>
        <Stars height={phone ? 244 : 320} top={1740} />
      </Card>
      <Card id="x15-picks" wide={w}>
        <Picks height={phone ? 244 : 400} />
      </Card>
      <Card id="x15-months" wide={w}>
        <Months height={phone ? 244 : 320} />
      </Card>
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex max-w-[1500px] min-w-0 flex-col gap-6 p-4 text-foreground">
    <Probe />
  </main>,
)
