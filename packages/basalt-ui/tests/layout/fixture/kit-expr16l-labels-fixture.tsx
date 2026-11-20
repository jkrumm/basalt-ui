/**
 * Expression cycle 16 kit fixes, chart labels (`v3-expr-16-kit-fixes` 3 and 4): the charts of n64 (a stack total
 * beside a zone caption), n68 (a caption over the bars), n70 (a bar filling its slot under a limit), n72 (a dense
 * column of dots, a zone caption) and n76 (twenty-four hourly bars) as their scenarios build them. Read by
 * `kit-expr16l-labels.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { alpha, BASALT } from '../../../src/tokens'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'

const tone = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

// ---- n64: the gap day carries the zone, the next day is the tallest stack and totals 92 ----
type Day = { label: string; iu: number; me: number; quota: number; down: number }
const DAYS: Day[] = [
  ['Nov 5', 40, 17, 5, 0],
  ['Nov 6', 36, 16, 6, 0],
  ['Nov 7', 36, 22, 8, 0],
  ['Nov 8', 39, 19, 3, 0],
  ['Nov 9', 46, 19, 5, 0],
  ['Nov 10', 31, 9, 4, 0],
  ['Nov 11', 28, 10, 2, 0],
  ['Nov 12', 0, 0, 0, 0],
  ['Nov 13', 48, 38, 4, 2],
  ['Nov 14', 37, 11, 6, 18],
  ['Nov 15', 32, 24, 6, 4],
  ['Nov 16', 22, 31, 14, 3],
].map(([label, iu, me, quota, down]) => ({ label, iu, me, quota, down }) as Day)

function Picks({ height }: { height: number }) {
  return (
    <Bars<Day>
      label="Targets per day"
      data={DAYS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.label }}
      y={{ title: 'Picks', domain: [0, 100] }}
      zones={[
        {
          axis: 'x',
          from: 'Nov 12',
          to: 'Nov 12',
          fill: alpha(BASALT.ink, 0.08),
          label: 'Gateway down',
        },
      ]}
      series={[
        { mark: 'bar', key: 'iu', label: 'iu', color: tone(1), y: (d) => d.iu },
        {
          mark: 'bar',
          key: 'me',
          label: 'me',
          color: tone(2),
          y: (d) => d.me,
          highlight: (d) => d.label === 'Nov 15' || d.label === 'Nov 16',
        },
        { mark: 'bar', key: 'quota', label: 'Quota', color: tone(3), y: (d) => d.quota },
        { mark: 'bar', key: 'down', label: 'Down', color: tone(4), y: (d) => d.down, values: true },
      ]}
    />
  )
}

// ---- n68: usable hours per month over a flat total, a zone caption wider than the room above the bars ----
type Month = { month: string; behind: number; flat: number }
const MONTHS: Month[] = [
  ['Jan', 1, 2],
  ['Feb', 4, 8],
  ['Mar', 14, 40],
  ['Apr', 46, 82],
  ['May', 81, 124],
  ['Jun', 85, 129],
  ['Jul', 81, 124],
  ['Aug', 53, 98],
  ['Sep', 20, 56],
  ['Oct', 0, 12],
].map(([month, behind, flat]) => ({ month, behind, flat }) as Month)

function Months({ height }: { height: number }) {
  return (
    <Bars<Month>
      label="Bars for each month, stacked"
      data={MONTHS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.month }}
      y={{ title: 'Hours', domain: [0, 150] }}
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

// ---- n70: shares of a limit, one bar exactly at the limit with no room above it ----
type Share = { name: string; share: number }
const SHARES: Share[] = [
  ['Ski trip', 61],
  ['Bike repair', 71],
  ['Dinner', 0],
  ['Garden party', 100],
  ['Camp', 23],
  ['Gift', 140],
  ['Easter', 0],
  ['Market', 45],
  ['Cabin', 37],
].map(([name, share]) => ({ name, share }) as Share)

function Shares({ height }: { height: number }) {
  return (
    <Bars<Share>
      label="Share of the limit"
      data={SHARES}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.name }}
      y={{ title: 'Share, %', domain: [0, 110] }}
      series={[
        {
          mark: 'bar',
          key: 'share',
          label: 'Share',
          color: tone(1),
          y: (d) => d.share,
          format: (n) => `${n} %`,
          values: true,
          legend: false,
        },
      ]}
      refLines={[{ value: 100, color: LINE, dashed: true }]}
    />
  )
}

// ---- n72: a hundred dots on one value of x, a zone with a caption over the dense corner ----
type Dot = { id: number; a: number; b: number }
const DOTS: Dot[] = Array.from({ length: 145 }, (_, i) => {
  const column = i < 70
  return {
    id: i,
    a: column ? 99 : 52 + ((i * 37) % 47),
    b: column ? 88 + ((i * 13) % 12) : 50 + ((i * 53) % 49),
  }
})

function Dots({ height }: { height: number }) {
  return (
    <CartesianChart<Dot>
      label="Scatter of both verdicts"
      data={DOTS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.a, domain: [50, 100], title: 'First classifier, %' }}
      y={{ title: 'Second classifier, %', domain: [50, 100] }}
      series={[
        {
          mark: 'dot',
          key: 'dots',
          label: 'Agree',
          color: tone(1),
          y: (d) => d.b,
          r: () => 3,
          spread: 'y',
        },
      ]}
      zones={[
        {
          axis: 'x',
          from: 80,
          to: 100,
          y: { from: 80, to: 100 },
          fill: alpha(BASALT.ink, 0.06),
          label: 'Both sure, 80 %+',
        },
      ]}
    />
  )
}

// ---- n76: twenty-four hourly bars, each value wider than its bar ----
type Hour = { h: number; pages: number }
const PAGES = [
  336, 360, 369, 330, 371, 333, 322, 329, 275, 255, 254, 230, 196, 233, 230, 214, 244, 234, 218,
  247, 276, 287, 334, 300,
]
const HOURS: Hour[] = PAGES.map((pages, h) => ({ h, pages }))

function Hours({ height }: { height: number }) {
  return (
    <Bars<Hour>
      label="Pages per hour"
      data={HOURS}
      height={height}
      tooltip={false}
      x={{ value: (d) => d.h, format: (h) => `${String(h).padStart(2, '0')}:00`, ticks: 6 }}
      y={{ title: 'Pages', domain: [0, 400] }}
      series={[
        {
          mark: 'bar',
          key: 'pages',
          label: 'Pages',
          color: tone(1),
          y: (d) => d.pages,
          values: true,
          highlight: (d) => d.h === 23,
          legend: false,
        },
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
  const h = phone ? 244 : 360
  return (
    <div className="flex flex-col gap-6">
      <Card id="x16-picks" wide={w}>
        <Picks height={h} />
      </Card>
      <Card id="x16-months" wide={w}>
        <Months height={h} />
      </Card>
      <Card id="x16-share" wide={phone ? 366 : w}>
        <Shares height={phone ? 160 : 260} />
      </Card>
      <Card id="x16-dots" wide={w}>
        <Dots height={phone ? 260 : 400} />
      </Card>
      <Card id="x16-hours" wide={phone ? 366 : w}>
        <Hours height={phone ? 280 : 320} />
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
