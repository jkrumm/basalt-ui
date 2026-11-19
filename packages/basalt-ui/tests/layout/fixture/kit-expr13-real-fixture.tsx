/**
 * Expression cycle 13 kit fixes, the real-page shapes (`v3-expr-13-kit-fixes`): the charts of n57
 * (night zones), n58 (credit pools, round 0), n59 (six machines, a disk and a CPU chart) and n62 (wind
 * zones, a storm past the cap) as their scenarios build them: same series, zones, rules, naming and
 * custom marks, data of the same shape. Read by `kit-expr13-real.layout.test.ts`.
 */
import { text } from '@tanstack/charts/text'
import { createRoot } from 'react-dom/client'
import { BASALT } from '../../../src/tokens'
import { chartLabels } from '../../../src/charts/chart-labels'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'

const tone = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const OVER = { light: 'var(--basalt-bad)', dark: 'var(--basalt-bad)' }
const wobble = (i: number, k: number): number =>
  Math.sin(i * 1.7 + k * 3.1) * 0.5 + Math.cos(i * 0.37 + k)

// ---- n59: six machines over 24 hours, a reading every 5 minutes, six hours of room on the right ----

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 10, 19, 10)
const N = 289
const MACHINES = ['forge', 'vault', 'stream', 'edge', 'pihole', 'lab'] as const
type Machine = (typeof MACHINES)[number]
type Sample = { at: number; read: Record<Machine, number | null> }
const FIRST = NOW - 24 * HOUR
const SILENT_FROM = 245

function samples(pegged: boolean): Sample[] {
  return Array.from({ length: N }, (_, i) => ({
    at: FIRST + i * 300_000,
    read: {
      forge: pegged && i >= 160 ? 99 : 30 + wobble(i, 1) * 12 + (i >= 250 ? 40 : 0),
      vault: 6.2 + wobble(i, 2) * 0.2,
      stream: 44 + wobble(i, 3) * 14,
      edge: i >= SILENT_FROM ? null : 12 + wobble(i, 4) * 6,
      pihole: 2 + wobble(i, 5) * 0.4,
      lab: 0.5 + wobble(i, 6) * 0.2,
    },
  }))
}
const DISK: Record<Machine, number> = {
  forge: 41,
  vault: 94,
  stream: 63,
  edge: 33,
  pihole: 47,
  lab: 58,
}
const diskSamples = (): Sample[] =>
  samples(false).map((s) => ({
    at: s.at,
    read: Object.fromEntries(
      MACHINES.map((m) => [m, DISK[m] + (m === 'vault' ? wobble(s.at / 300_000, 7) * 0.05 : 0)]),
    ) as Sample['read'],
  }))

function Machines({
  data,
  named,
  refLine,
  zone,
  height,
}: {
  data: Sample[]
  named: Map<Machine, string>
  refLine: { value: number; label: string }
  zone?: { from: number; to: number; label: string }
  height: number
}) {
  return (
    <CartesianChart
      label="Machines"
      data={data}
      height={height}
      x={{
        value: (s) => new Date(s.at),
        domain: [new Date(FIRST), new Date(NOW + 6 * HOUR)],
        ticks: data.filter((s) => s.at % (6 * HOUR) === 0).map((s) => new Date(s.at)),
      }}
      y={{ title: '%', domain: [0, 100] }}
      series={MACHINES.map((id) => ({
        mark: 'line' as const,
        key: id,
        label: id,
        color: id === 'forge' ? OVER : tone(2),
        weight: id === 'forge' ? ('strong' as const) : ('quiet' as const),
        legend: false as const,
        y: (s: Sample) => s.read[id],
      }))}
      refLines={[{ value: refLine.value, color: LINE, dashed: true, label: refLine.label }]}
      zones={
        zone === undefined
          ? []
          : [
              {
                axis: 'x',
                from: zone.from,
                to: zone.to,
                fill: 'color-mix(in srgb, var(--basalt-line) 30%, transparent)',
                label: zone.label,
              },
            ]
      }
      marks={CartesianChart.custom<Sample>((plot) => {
        const ends = new Map<Machine, { at: number; v: number }>()
        for (const id of named.keys()) {
          const last = plot.rows(id).findLast((s) => s.read[id] !== null)
          const v = last?.read[id]
          if (last === undefined || v === null || v === undefined) continue
          ends.set(id, { at: last.at, v })
        }
        const { placed } = chartLabels.place(
          [...ends].map(([id, end]) => ({
            key: id,
            text: named.get(id) ?? id,
            x: plot.x(new Date(end.at)) ?? 0,
            y: plot.y(end.v),
            priority: id === 'forge' ? 1 : 0,
          })),
          { width: plot.plotWidth, height: plot.plotHeight },
          { gap: BASALT.dotR + 3 },
        )
        return [
          text(placed, {
            x: (l) => new Date(ends.get(l.key as Machine)?.at ?? NOW),
            y: (l) => ends.get(l.key as Machine)?.v ?? 0,
            text: (l) => l.text,
            dx: (l) => l.dx,
            dy: (l) => l.dy,
            anchor: (l) => l.textAnchor,
            fill: BASALT.ink,
            fontSize: BASALT.text.micro,
          }),
        ]
      })}
    />
  )
}

// ---- n58 round 0: credit pools, used share by day, with a carry-on to expiry ----

type Pool = {
  day: number
  team: number | null
  teamProj: number | null
  research: number | null
  researchProj: number | null
  batch: number | null
}
const DAYS = [
  ...new Set([...Array.from({ length: 61 }, (_, i) => i / 2), 9.4, 14.4, 22.7]),
].toSorted((a, b) => a - b)
const POOLS: Pool[] = DAYS.map((day) => ({
  day,
  team: day <= 14.4 ? day * 4 : null,
  teamProj: day >= 14.4 && day <= 22.7 ? 57.6 + (day - 14.4) * (42.4 / 8.3) : null,
  research: day <= 9.4 ? day * 2.9 : null,
  researchProj: day >= 9.4 ? 27.3 + (day - 9.4) * (60.7 / 20.6) : null,
  batch: day <= 0.5 ? day * 4 : null,
}))
const pool = (key: keyof Omit<Pool, 'day'>, label: string, n: number, extra: object = {}) => ({
  mark: 'line' as const,
  key,
  label,
  color: tone(n),
  y: (d: Pool) => d[key],
  gaps: 'connect' as const,
  ...extra,
})

// ---- n62: wind and gusts by the hour, zones by verdict, a storm past the 45 kt cap ----

type Hour = { at: number; g6: number; g3: number; g1: number; ms: number }
const H0 = Date.UTC(2026, 10, 19, 6)
function wind(storm: boolean): Hour[] {
  return Array.from({ length: 49 }, (_, i) => {
    const calm = 5 + Math.max(0, 14 * Math.sin(((i - 2) / 14) * Math.PI)) + (i > 20 ? 3 : 0)
    const gust = i >= 26 && i <= 29 ? (storm ? 51 + (i === 28 ? 0 : -6) : calm * 1.15) : calm * 1.15
    const ms = i >= 26 && i <= 29 && storm ? (i === 28 ? 51 : 40) : calm
    return {
      at: H0 + i * HOUR,
      ms,
      g1: i === 28 && storm ? 91 : gust,
      g3: i >= 28 && i <= 33 && storm ? 91 - (i - 28) * 2 : gust,
      g6: i >= 28 && i <= 40 && storm ? 91 - Math.max(0, i - 31) * 1.2 : gust,
    }
  })
}
const KT = (v: number): string => `${Math.round(v)} kt`

function Wind({ data }: { data: Hour[] }) {
  const series = [
    { key: 'g6', label: 'Gust 6 h', n: 4, dash: true, w: 'quiet', read: (d: Hour) => d.g6 },
    { key: 'g3', label: 'Gust 3 h', n: 3, dash: true, w: 'quiet', read: (d: Hour) => d.g3 },
    { key: 'g1', label: 'Gust 1 h', n: 2, dash: false, w: 'quiet', read: (d: Hour) => d.g1 },
    { key: 'wind', label: 'Wind', n: 1, dash: false, w: 'strong', read: (d: Hour) => d.ms },
  ] as const
  return (
    <CartesianChart<Hour>
      label="Knots by hour"
      data={data}
      height={300}
      tooltip={false}
      x={{
        value: (d) => new Date(d.at),
        ticks: data
          .filter((d) => new Date(d.at).getUTCHours() % 6 === 0)
          .map((d) => new Date(d.at)),
      }}
      y={{ title: 'Knots', domain: ([, hi]) => [0, Math.max(30, Math.min(hi, 45))] }}
      series={series.map((s) => ({
        mark: 'line' as const,
        key: s.key,
        label: s.label,
        format: KT,
        color: tone(s.n),
        ...(s.dash ? { dash: true as const } : {}),
        weight: s.w,
        y: s.read,
      }))}
      refLines={[
        { value: 12, color: LINE, dashed: true, label: '12 kt' },
        { value: 25, color: LINE, dashed: true, label: '25 kt' },
      ]}
      zones={[
        {
          axis: 'x',
          from: new Date(H0 + 4 * HOUR),
          to: new Date(H0 + 11 * HOUR),
          y: { from: 12, to: 25 },
          fill: 'color-mix(in srgb, var(--basalt-chart-2) 16%, transparent)',
          label: 'Steady, 7 h',
        },
        {
          axis: 'x',
          from: new Date(H0 + 14 * HOUR),
          to: new Date(H0 + 19 * HOUR),
          y: { from: 12, to: 25 },
          fill: 'color-mix(in srgb, var(--basalt-chart-2) 16%, transparent)',
          label: 'Gusty, 5 h',
        },
        {
          axis: 'x',
          from: new Date(H0 + 21 * HOUR),
          to: new Date(H0 + 48 * HOUR),
          fill: 'color-mix(in srgb, var(--basalt-bad) 10%, transparent)',
          label: 'Offshore',
        },
      ]}
      marks={CartesianChart.custom<Hour>((plot) => {
        const end = plot.data.at(-9)
        const endX = end === undefined ? null : plot.x(new Date(end.at))
        if (end === undefined || endX === null) return []
        const at = new Map<string, { kt: number; text: string }>()
        for (const s of plot.visible) {
          const v = s.y(end)
          if (v !== null) at.set(s.key, { kt: v, text: s.label })
        }
        const { placed } = chartLabels.place(
          [...at].map(([key, a]) => ({ key, text: a.text, x: endX, y: plot.y(a.kt), priority: 1 })),
          { width: plot.plotWidth, height: plot.plotHeight },
        )
        return [
          text(placed, {
            x: () => new Date(end.at),
            y: (l) => at.get(l.key)?.kt ?? 0,
            text: (l) => l.text,
            dx: (l) => l.dx,
            dy: (l) => l.dy,
            anchor: (l) => l.textAnchor,
            fill: BASALT.ink,
            fontSize: BASALT.text.micro,
          }),
        ]
      })}
    />
  )
}

// ---- n57: the dark's cloud cover, a usable spell and the moon ----

type Slot = { at: number; low: number; mid: number; high: number }
const SLOTS: Slot[] = Array.from({ length: 20 }, (_, i) => ({
  at: 19.5 + i * 0.5,
  low: 4 + Math.abs(wobble(i, 8)) * 4,
  mid: 2 + Math.abs(wobble(i, 9)) * 2,
  high: 1 + Math.abs(wobble(i, 10)),
}))

function Night() {
  return (
    <CartesianChart<Slot>
      label="Night"
      height={288}
      data={SLOTS}
      x={{ value: (s) => s.at }}
      y={{ title: 'Sky covered, %', domain: [0, 100] }}
      series={(['low', 'mid', 'high'] as const).map((k, n) => ({
        mark: 'line' as const,
        key: k,
        label: k,
        color: tone(n + 1),
        y: (s: Slot) => s[k],
      }))}
      zones={[
        {
          axis: 'x',
          from: 19.5,
          to: 24.5,
          fill: 'color-mix(in srgb, var(--basalt-line) 30%, transparent)',
          label: 'Usable',
        },
        {
          axis: 'x',
          from: 24.5,
          to: 29,
          fill: 'color-mix(in srgb, var(--basalt-line) 30%, transparent)',
          label: 'Moon up',
        },
      ]}
      refLines={[{ value: 30, color: LINE, dashed: true, label: 'Clear under 30 %' }]}
    />
  )
}

function Card({ id, wide, children }: { id: string; wide: number; children: React.ReactNode }) {
  return (
    <div data-testid={id} className="min-w-0" style={{ width: `min(100%, ${wide}px)` }}>
      <ChartCard title={id} chart={() => children} />
    </div>
  )
}

const wholeNamed = (m: Machine, text: string): Map<Machine, string> => new Map([[m, text]])

function Probe() {
  const peggedData = samples(true)
  const cpuNames = new Map<Machine, string>([
    ['forge', 'forge 99 %'],
    ['stream', 'stream'],
  ])
  const lastSeen = peggedData[SILENT_FROM - 1]?.at ?? FIRST
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card id="x13-cpu" wide={496}>
        <Machines
          data={peggedData}
          named={cpuNames}
          refLine={{ value: 85, label: 'Busy' }}
          zone={{ from: lastSeen, to: peggedData.at(-1)?.at ?? NOW, label: 'edge silent' }}
          height={600}
        />
      </Card>
      <Card id="x13-disk" wide={496}>
        <Machines
          data={diskSamples()}
          named={wholeNamed('vault', 'vault 94 %')}
          refLine={{ value: 90, label: 'Limit' }}
          height={248}
        />
      </Card>
      <Card id="x13-pools" wide={716}>
        <Lines<Pool>
          label="Used share by day"
          data={POOLS}
          x={{ value: (d) => d.day, domain: [0, 30], ticks: [0, 10, 20, 30], title: 'Cycle day' }}
          y={{ domain: { floor: 0, ceil: 100, pad: 0.04 }, title: 'Used, %' }}
          naming="endLabels"
          series={[
            pool('team', 'Team pool', 2, { weight: 'strong' }),
            pool('teamProj', 'Team pool, out 27 Nov', 2, {
              dash: true,
              parent: 'team',
              legend: false,
              tooltip: false,
            }),
            pool('research', 'Research pool', 1),
            pool('researchProj', 'Research pool, US$12 left at expiry', 1, {
              dash: true,
              parent: 'research',
              legend: false,
              tooltip: false,
            }),
            pool('batch', 'Batch pool', 3),
          ]}
          refLines={[
            { value: 100, color: LINE, dashed: true },
            { value: 30, axis: 'x', color: LINE, dashed: true, label: 'Expiry' },
          ]}
        />
      </Card>
      <Card id="x13-wind" wide={1480}>
        <Wind data={wind(false)} />
      </Card>
      <Card id="x13-storm" wide={1480}>
        <Wind data={wind(true)} />
      </Card>
      <Card id="x13-night" wide={318}>
        <Night />
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
