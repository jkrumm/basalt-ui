import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { HOMELAB_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  BUSY_CPU,
  FULL_PCT,
  MACHINES,
  MACHINE_IDS,
  median,
  nowOf,
  pctOf,
  samplesOf,
  variantOf,
} from './fixture'
import type { MachineId, MachineNow, Reading, Sample } from './fixture'
import { MachineLines } from './MachineLines'
import type { Measure } from './MachineLines'

type State = 'fine' | 'busy' | 'full' | 'both' | 'silent'

type Row = {
  id: MachineId
  role: string
  state: State
  cpu: number | null
  mem: number | null
  disk: number | null
  load: number | null
  netIn: number | null
  netOut: number | null
}

const READ = {
  cpu: (r: Reading): number => r.cpu,
  mem: (r: Reading, id: MachineId): number => pctOf(r.memGb, MACHINES[id].memGb),
  disk: (r: Reading, id: MachineId): number => pctOf(r.diskGb, MACHINES[id].diskGb),
  load: (r: Reading): number => r.load,
  net: (r: Reading): number => r.netIn + r.netOut,
}

/** A machine's current absolute reading, read from the latest row of `nows`. */
const READ_GB = {
  mem: (nows: readonly MachineNow[], id: MachineId): number =>
    nows.find((n) => n.id === id)?.reading?.memGb ?? 0,
  disk: (nows: readonly MachineNow[], id: MachineId): number =>
    nows.find((n) => n.id === id)?.reading?.diskGb ?? 0,
  netIn: (nows: readonly MachineNow[], id: MachineId): number =>
    nows.find((n) => n.id === id)?.reading?.netIn ?? 0,
  netOut: (nows: readonly MachineNow[], id: MachineId): number =>
    nows.find((n) => n.id === id)?.reading?.netOut ?? 0,
}

const LOAD_CAP = 16
const r1 = (v: number): number => Math.round(v * 10) / 10
const noop = (): void => undefined

const HEAD = {
  name: 'Name',
  state: 'State',
  cpu: 'CPU, %',
  mem: 'Memory, %',
  disk: 'Storage, %',
  load: 'Load',
  netIn: 'In, Mb/s',
  netOut: 'Out, Mb/s',
}

const c = col<Row>()
const STATE_LABELS = {
  fine: 'Fine',
  busy: 'Busy',
  full: 'Nearly full',
  both: 'Busy and full',
  silent: 'Silent',
} satisfies Record<State, string>

const COLUMNS = [
  c.entity('id', { header: HEAD.name, sub: (r) => r.role, priority: 1 }),
  c.status('state', {
    header: HEAD.state,
    options: ['fine', 'busy', 'full', 'both', 'silent'],
    labels: STATE_LABELS,
    tone: (s) => (s === 'fine' || s === 'silent' ? 'neutral' : 'bad'),
    priority: 1,
  }),
  c.meter('cpu', { header: HEAD.cpu, max: 100, priority: 2, card: 'meta' }),
  c.meter('mem', { header: HEAD.mem, max: 100, priority: 2, card: 'meta' }),
  c.meter('disk', { header: HEAD.disk, max: 100, priority: 2, card: 'meta' }),
  c.number('load', { header: HEAD.load, digits: 1, priority: 3 }),
  c.number('netIn', { header: HEAD.netIn, digits: 0, priority: 3 }),
  c.number('netOut', { header: HEAD.netOut, digits: 0, priority: 3 }),
]

type Top = { id: MachineId; v: number; median: number; start: number }

/** The machine with the highest reading now, against its own 24 hour median. */
function topOf(
  samples: readonly Sample[],
  nows: readonly MachineNow[],
  read: (r: Reading, id: MachineId) => number,
): Top | undefined {
  let best: Top | undefined
  for (const n of nows) {
    if (n.reading === null) continue
    const v = read(n.reading, n.id)
    if (best !== undefined && v <= best.v) continue
    const series = samples.flatMap((s) => {
      const r = s.read[n.id]
      return r === null ? [] : [read(r, n.id)]
    })
    const first = samples[0]?.read[n.id]
    best = {
      id: n.id,
      v,
      median: median(series),
      start: first === null || first === undefined ? v : read(first, n.id),
    }
  }
  return best
}

/** The first instant of the unbroken run of readings at or over `limit` that ends now. */
function overSince(
  samples: readonly Sample[],
  id: MachineId,
  limit: number,
  read: (r: Reading, id: MachineId) => number,
): number | undefined {
  let since: number | undefined
  for (const s of [...samples].reverse()) {
    const r = s.read[id]
    if (r === null || read(r, id) < limit) return since
    since = s.at
  }
  return since
}

const signed = (n: number, unit: string): string => `${n < 0 ? '−' : '+'}${Math.abs(n)} ${unit}`

export function ExprN59Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const samples = shotState === 'empty' ? [] : samplesOf(variantOf(fixture))
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The collector did not answer.' }
        : 'ready'
  const quiet: Phase =
    shotState === 'error' ? { tag: 'error', message: 'The collector did not answer.' } : phase
  const ready = phase === 'ready' && samples.length > 0
  const nows = nowOf(samples)
  const whole = (n: number): string => f.number(n, { maximumFractionDigits: 0 })
  const tenth = (n: number): string => f.number(n, { maximumFractionDigits: 1 })
  const clock = (at: number): string =>
    f.time(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const tb = (gb: number): string => tenth(gb / 1000)

  const focus = useChartFocus(samples, {
    announce: (s) => {
      const parts = MACHINE_IDS.flatMap((id) => {
        const r = s.read[id]
        return r === null ? [`${id} silent`] : [`${id} ${whole(r.cpu)} % CPU`]
      })
      return `${clock(s.at)}: ${parts.join(', ')}`
    },
  })

  const cpu = ready ? topOf(samples, nows, READ.cpu) : undefined
  const mem = ready ? topOf(samples, nows, READ.mem) : undefined
  const disk = ready ? topOf(samples, nows, READ.disk) : undefined
  const load = ready ? topOf(samples, nows, READ.load) : undefined
  const net = ready ? topOf(samples, nows, READ.net) : undefined
  const silent = nows.find((n) => n.reading === null && n.lastSeen !== null)

  const overOf = (
    read: (r: Reading, id: MachineId) => number,
    limit: (id: MachineId) => number,
  ): Set<MachineId> =>
    new Set(
      nows.flatMap((n) =>
        n.reading !== null && read(n.reading, n.id) >= limit(n.id) ? [n.id] : [],
      ),
    )
  const overCpu = overOf(READ.cpu, () => BUSY_CPU)
  const overMem = overOf(READ.mem, () => FULL_PCT)
  const overDisk = overOf(READ.disk, () => FULL_PCT)
  const overLoad = overOf(READ.load, (id) => MACHINES[id].cores)

  const rows: Row[] = nows.map((n) => {
    const r = n.reading
    const busy = overCpu.has(n.id)
    const full = overMem.has(n.id) || overDisk.has(n.id)
    return {
      id: n.id,
      role: MACHINES[n.id].role,
      state: r === null ? 'silent' : busy && full ? 'both' : busy ? 'busy' : full ? 'full' : 'fine',
      cpu: r?.cpu ?? null,
      mem: r === null ? null : r1(READ.mem(r, n.id)),
      disk: r === null ? null : r1(READ.disk(r, n.id)),
      load: r?.load ?? null,
      netIn: r?.netIn ?? null,
      netOut: r?.netOut ?? null,
    }
  })

  const named = (top: Top | undefined, text: string): ReadonlyMap<MachineId, string> =>
    new Map(top === undefined ? [] : [[top.id, text]])

  const cpuMeasure: Measure = {
    read: READ.cpu,
    title: '%',
    format: whole,
    over: overCpu,
    named: new Map(
      [...rows]
        .filter((r) => r.cpu !== null)
        .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0))
        .slice(0, 2)
        .map((r) => [r.id, overCpu.has(r.id) ? `${r.id} ${whole(r.cpu ?? 0)} %` : r.id]),
    ),
    domain: [0, 100],
    refLines: [
      {
        value: BUSY_CPU,
        color: HOMELAB_SERIES.rule,
        dashed: true,
        label: 'Busy',
      },
    ],
    zones:
      silent?.lastSeen == null
        ? []
        : [
            {
              axis: 'x',
              from: silent.lastSeen,
              to: samples.at(-1)?.at ?? silent.lastSeen,
              fill: alpha(BASALT.inkMuted, 0.14),
              label: `${silent.id} silent`,
            },
          ],
  }
  const memMeasure: Measure = {
    read: READ.mem,
    title: '%',
    format: whole,
    over: overMem,
    named: named(mem, mem === undefined ? '' : `${mem.id} ${whole(mem.v)} %`),
    domain: [0, 100],
    refLines: [
      {
        value: FULL_PCT,
        color: HOMELAB_SERIES.rule,
        dashed: true,
        label: 'Limit',
      },
    ],
  }
  const diskMeasure: Measure = {
    read: READ.disk,
    title: '%',
    format: whole,
    over: overDisk,
    named: named(disk, disk === undefined ? '' : `${disk.id} ${whole(disk.v)} %`),
    domain: [0, 100],
    refLines: [
      {
        value: FULL_PCT,
        color: HOMELAB_SERIES.rule,
        dashed: true,
        label: 'Limit',
      },
    ],
  }
  const loadMeasure: Measure = {
    read: READ.load,
    title: 'Load',
    format: tenth,
    over: overLoad,
    named: named(load, load === undefined ? '' : `${load.id} ${tenth(load.v)}`),
    domain: [0, LOAD_CAP],
  }
  const netMeasure: Measure = {
    read: READ.net,
    title: 'Mb/s',
    format: whole,
    over: new Set(),
    named: named(net, net === undefined ? '' : `${net.id} ${whole(net.v)}`),
  }

  const cpuSince = cpu === undefined ? undefined : overSince(samples, cpu.id, BUSY_CPU, READ.cpu)
  const cpuFacts: FootFacts = [
    cpuSince === undefined
      ? { label: `Over ${BUSY_CPU} % since`, value: ready ? 'not in 24 h' : '' }
      : { label: `Over ${BUSY_CPU} % since`, value: clock(cpuSince), mono: true },
    {
      label: 'Not reporting',
      value: ready ? (silent === undefined ? 'none' : `${silent.id}, ${silent.silentMin} min`) : '',
    },
  ]

  const table = useDataTable({
    id: 'machines-now',
    label: 'Latest readings',
    columns: COLUMNS,
    data: ready ? rows : [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: MACHINE_IDS.length,
  })

  const none = (what: string): Empty => ({ cause: `No ${what} readings yet.` })
  const cardPhase = (retry: boolean): Phase => (retry ? phase : quiet)

  return (
    <Page area="expr-n59">
      <PageBar title="Homelab machines, last 24 hours" />
      <div className="grid gap-3 @wide:grid-cols-3">
        <div className="@wide:row-span-2">
          <ChartCard
            title="CPU by machine"
            subtitle="% of CPU time, a reading every 5 min, UTC"
            phase={cardPhase(true)}
            empty={
              ready || shotState !== 'empty'
                ? null
                : {
                    cause: 'No machine has reported. Start the collector on one.',
                  }
            }
            height="fill"
            figure={{
              value: cpu === undefined ? null : whole(cpu.v),
              unit: cpu === undefined ? '% CPU' : `% CPU on ${cpu.id}`,
              delta: {
                value: cpu === undefined ? '' : signed(Math.round(cpu.v - cpu.median), 'pts'),
                polarity: cpu !== undefined && overCpu.has(cpu.id) ? 'up-bad' : 'neutral',
                label: 'vs median',
              },
              period: 'now',
              status:
                cpu !== undefined && overCpu.has(cpu.id)
                  ? { tone: 'bad', label: 'Busy' }
                  : undefined,
            }}
            footer={cpuFacts}
            chart={(box) => (
              <MachineLines
                samples={samples}
                focus={focus}
                measure={cpuMeasure}
                label="CPU use by the hour"
                height={box.height}
              />
            )}
          />
        </div>
        <ChartCard
          title="Disk fullness"
          subtitle="Fullest disk of each"
          phase={cardPhase(false)}
          empty={ready || shotState !== 'empty' ? null : none('disk')}
          figure={{
            value: disk === undefined ? null : whole(disk.v),
            unit: disk === undefined ? '%' : `% on ${disk.id}`,
            delta: {
              value:
                disk === undefined
                  ? ''
                  : signed(Math.round((disk.v - disk.start) * 10) / 10, 'pts'),
              polarity: disk !== undefined && overDisk.has(disk.id) ? 'up-bad' : 'neutral',
              label: 'vs 24 h ago',
            },
            period: 'now',
            status:
              disk !== undefined && overDisk.has(disk.id)
                ? { tone: 'bad', label: 'Nearly full' }
                : undefined,
          }}
          footer={[
            {
              label: 'Used',
              value:
                disk === undefined
                  ? ''
                  : `${tb(READ_GB.disk(nows, disk.id))} of ${tb(MACHINES[disk.id].diskGb)} TB`,
            },
            {
              label: 'Free',
              value:
                disk === undefined
                  ? ''
                  : `${tb(MACHINES[disk.id].diskGb - READ_GB.disk(nows, disk.id))} TB`,
            },
          ]}
          chart={(box) => (
            <MachineLines
              samples={samples}
              focus={focus}
              measure={diskMeasure}
              label="Space in use, per hour"
              height={box.height}
            />
          )}
        />
        <ChartCard
          title="Memory use"
          subtitle="Share of installed RAM"
          phase={cardPhase(false)}
          empty={ready || shotState !== 'empty' ? null : none('memory')}
          figure={{
            value: mem === undefined ? null : whole(mem.v),
            unit: mem === undefined ? '%' : `% on ${mem.id}`,
            delta: {
              value: mem === undefined ? '' : signed(Math.round(mem.v - mem.median), 'pts'),
              polarity: mem !== undefined && overMem.has(mem.id) ? 'up-bad' : 'neutral',
              label: 'vs median',
            },
            period: 'now',
          }}
          footer={[
            {
              label: 'Used',
              value:
                mem === undefined
                  ? ''
                  : `${tenth(READ_GB.mem(nows, mem.id))} of ${MACHINES[mem.id].memGb} GB`,
            },
          ]}
          chart={(box) => (
            <MachineLines
              samples={samples}
              focus={focus}
              measure={memMeasure}
              label="Share in use during the day"
              height={box.height}
            />
          )}
        />
        <ChartCard
          title="Load average"
          subtitle="Tasks waiting for a core"
          phase={cardPhase(false)}
          empty={ready || shotState !== 'empty' ? null : none('load')}
          figure={{
            value: load === undefined ? null : tenth(load.v),
            unit: load === undefined ? '' : `on ${load.id}`,
            delta: {
              value:
                load === undefined ? '' : signed(Math.round((load.v - load.median) * 10) / 10, ''),
              polarity: load !== undefined && overLoad.has(load.id) ? 'up-bad' : 'neutral',
              label: 'vs median',
            },
            period: 'now',
          }}
          footer={[
            { label: 'Cores', value: load === undefined ? '' : MACHINES[load.id].cores },
            {
              label: 'Per core',
              value:
                load === undefined
                  ? ''
                  : f.number(load.v / MACHINES[load.id].cores, { maximumFractionDigits: 2 }),
            },
          ]}
          chart={(box) => (
            <MachineLines
              samples={samples}
              focus={focus}
              measure={loadMeasure}
              label="Core queue through the day"
              height={box.height}
            />
          )}
        />
        <ChartCard
          title="Network traffic"
          subtitle="Mb/s, in plus out"
          phase={cardPhase(false)}
          empty={ready || shotState !== 'empty' ? null : none('network')}
          figure={{
            value: net === undefined ? null : whole(net.v),
            unit: net === undefined ? 'Mb/s' : `Mb/s on ${net.id}`,
            delta: {
              value: net === undefined ? '' : signed(Math.round(net.v - net.median), 'Mb/s'),
              polarity: 'neutral',
              label: 'vs usual',
            },
            period: 'now',
          }}
          footer={[
            {
              label: 'In',
              value: net === undefined ? '' : `${whole(READ_GB.netIn(nows, net.id))} Mb/s`,
            },
            {
              label: 'Out',
              value: net === undefined ? '' : `${whole(READ_GB.netOut(nows, net.id))} Mb/s`,
            },
          ]}
          chart={(box) => (
            <MachineLines
              samples={samples}
              focus={focus}
              measure={netMeasure}
              label="Throughput all day long"
              height={box.height}
            />
          )}
        />
        <div className="@wide:col-span-3">
          <DataPanel
            title="State now"
            subtitle="Latest reading of each machine"
            phase={cardPhase(false)}
            empty={
              ready || shotState !== 'empty'
                ? null
                : { cause: 'The list fills when a collector reports.' }
            }
            bodySize={{ rows: MACHINE_IDS.length + 1 }}
            body={() => (
              <DataTable table={table} height="fill" focusSeries={{ focus, key: (r) => r.id }} />
            )}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
