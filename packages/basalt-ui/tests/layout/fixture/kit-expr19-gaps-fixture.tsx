/**
 * Issue 2911 kit gaps: n79's end labels at 390 (a rising line through the stack), n72's dot cloud with its
 * page labels, and n71's few-photos zones, as their scenarios build them (same series, zones, naming and
 * label pass; the data is the scenarios' own, written out). Read by `kit-expr19-gaps.layout.test.ts`.
 */
import { text } from '@tanstack/charts/text'
import { createRoot } from 'react-dom/client'
import { alpha, BASALT } from '../../../src/tokens'
import { chartLabels } from '../../../src/charts/chart-labels'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'

const pair = (light: string, dark: string): { light: string; dark: string } => ({ light, dark })
const tone = (n: number): { light: string; dark: string } =>
  pair(`var(--basalt-chart-${n})`, `var(--basalt-chart-${n})`)

// ---- n79: eight classes over four weeks, flaky tests surging past the cap ----
const CLASSES = [
  ['lint', 'Lint', pair('#262626', '#e6e6e6')],
  ['types', 'Type errors', pair('#4a4a4a', '#c4c4c4')],
  ['flaky', 'Flaky tests', pair('#2871c7', '#5190f7')],
  ['build', 'Build config', pair('#6b6b6b', '#a8a8a8')],
  ['deps', 'Dependency bumps', pair('#8a8a8a', '#8f8f8f')],
  ['deploy', 'Deploy scripts', pair('#5a5a5a', '#b0b0b0')],
  ['docs', 'Docs drift', pair('#9a9a9a', '#7d7d7d')],
  ['migration', 'Migrations', pair('#b0b0b0', '#666666')],
] as const
type Week = { label: string; counts: readonly number[] }
const WEEKS: Week[] = [
  { label: 'Oct 24–30', counts: [15, 12, 4, 9, 8, 6, 5, 0] },
  { label: 'Oct 31–Nov 6', counts: [10, 11, 3, 7, 7, 4, 3, 0] },
  { label: 'Nov 7–13', counts: [7, 8, 3, 5, 5, 3, 3, 0] },
  { label: 'Nov 14–20', counts: [6, 6, 38, 4, 4, 3, 2, 0] },
]

function Surge({ id, weeks }: { id: string; weeks: readonly Week[] }) {
  return (
    <div data-testid={id} className="min-w-0">
      <ChartCard
        title="Fixes per class"
        height="tall"
        chart={(box) => (
          <Lines
            height={box.height}
            label="Four points per line, one line each"
            data={weeks}
            x={{ value: (w: Week) => w.label }}
            y={{ title: 'Count', domain: ([lo, hi]) => [lo, Math.min(hi, 20)] }}
            naming="endLabels"
            series={CLASSES.map(([key, name, color], i) => ({
              mark: 'line' as const,
              key,
              label: name,
              color,
              weight: key === 'flaky' ? ('strong' as const) : ('quiet' as const),
              y: (w: Week) => w.counts[i] ?? null,
            }))}
          />
        )}
      />
    </div>
  )
}

// ---- n72: both classifiers' confidence for 225 submissions, the sure cases named ----
type Verdict = 'legit' | 'spam' | 'marketing'
type Kind = 'agree' | 'other' | 'sure' | 'delivered'
type Submission = {
  id: string
  first: Verdict
  second: Verdict
  firstConf: number
  secondConf: number
  kind: Kind
  n: number
}
const WORD: Record<Verdict, string> = { legit: 'Legit', spam: 'Spam', marketing: 'Marketing' }
const VERDICT: Record<string, Verdict> = { l: 'legit', s: 'spam', m: 'marketing' }
const KIND: Record<string, Kind> = { a: 'agree', o: 'other', s: 'sure', d: 'delivered' }
// first verdict, its confidence, second verdict, its confidence, kind, submission number
const ENCODED =
  'l51l62a36 m51m51a195 l53l50a223 l54l61a77 s56s50a37 m56m50a192 l56l60a235 s58s51a90 l58m77o153 l58l66a226 s58s51a229 m59l94o233 l59l50a247 l61l72a42 l61l55a178 l61l62a202 l61l68a215 l62l66a246 l63l69a69 l63l73a85 l63l71a177 s63s63a184 m64l83o133 s64s63a157 m64m54a212 l64l62a236 m64m70a242 l66l71a27 l66l60a129 s66s60a155 l66m79o213 l67l78a109 s68s77a24 l68l58a163 m69m80a196 l70l63a222 s70s59a237 l70l72a240 l71s88o113 s71s71a225 l71l81a239 l71l62a249 s72s77a183 s73s68a59 l73l73a120 l74l76a205 l74l70a243 s74s67a244 l75l87a16 m75m67a84 l75l65a114 m75m64a146 l75l87a217 l76l82a122 s76l90o173 l76l83a189 l77l79a35 l77l72a40 l77l76a103 l77l67a105 m77m76a169 l77l83a182 l78l67a64 l78l73a167 l78l86a180 l78l81a220 l79l90a14 l79l90a34 m79m90a172 s80s76a58 l80l89a143 m81m92a8 l81l88a19 l81l83a45 l81l84a79 l81l74a87 m82m90a10 s82s88a15 l82l74a116 m82s55o193 l83l79a39 l83l88a137 l83l86a142 l83l92a154 l83l92a234 m84m94a152 l84l77a197 l84l78a207 s84s81a219 l85l76a25 l86l91a83 l86l84a224 l87l80a2 l87l84a62 l87s83s73 s87s79a76 l87l85a99 l87l89a102 l88l96a18 m88l91s33 l88l86a82 l89l99a70 l89l89a107 l89l94a108 l89l99a150 m89m95a176 m89m99a209 l90l81a30 l90l99a60 l90l91a115 l90l99a185 l91l91a3 l91l99a75 s91l62d93 l91l97a168 s91s79a206 l91l80a227 l91l91a228 l92m84s13 s92s99a26 s92s98a28 l92l87a56 l92l94a67 l92l96a74 l92l82a78 l92l83a112 m92m84a118 l92l87a123 l92l83a145 l92l99a179 m92m89a210 l93l86a48 s93s89a55 s93s84a65 m93m99a127 s93s99a138 l93l92a170 l93l90a175 l93l99a203 l93l82a232 s94s93a44 s94s95a117 l94l86a134 l94l88a160 l94l91a165 s94s95a190 s95s99a9 l95l86a38 s95s86a52 s95m81s53 l95l89a80 l95l99a104 l95l88a124 l95l99a136 s95s99a144 l95l99a186 l95l99a199 l95l89a248 s96s88a6 l96l99a12 l96l85a46 l96l99a63 l96l94a88 l96l99a119 s96s99a135 l97l99a7 s97s89a17 l97l99a66 l97l99a72 m97m99a96 l97l99a98 l97l92a130 l97l99a164 m97m99a187 m97m99a194 l97l99a218 l98l91a5 l98l91a54 s98s99a92 l98l99a95 l98l95a139 m98m99a156 l98l99a159 m98m93a188 s98s99a216 l98l99a230 l99l93a0 l99l99a4 l99l99a20 l99l95a22 l99l99a23 l99l88a29 l99l99a32 l99l95a43 l99l89a47 l99l99a49 l99l99a50 m99m94a57 l99l98a68 s99s99a86 s99s99a89 l99l99a94 l99l95a97 m99m99a100 l99l99a106 m99m93a110 l99l91a125 l99l93a126 m99m99a128 l99l99a132 l99l98a140 l99l92a147 l99l99a148 s99s89a149 m99m99a158 s99s93a162 s99s92a166 l99l97a174 l99l97a198 l99l91a200 l99l90a204 l99l99a208 s99s99a214 l99l99a238 l99l99a245'
const SUBMISSIONS: Submission[] = ENCODED.split(' ').map((token) => {
  const [, f, fc, s, sc, k, n] = /^([lsm])(\d+)([lsm])(\d+)([aosd])(\d+)$/.exec(
    token,
  ) as RegExpExecArray
  return {
    id: `#${n}`,
    first: VERDICT[f as string] as Verdict,
    firstConf: Number(fc),
    second: VERDICT[s as string] as Verdict,
    secondConf: Number(sc),
    kind: KIND[k as string] as Kind,
    n: Number(n),
  }
})
const SURE = 80
const xOf = (s: Submission): number => s.firstConf + s.n / 1_000_000
const KINDS = {
  agree: pair('#b0b0b0', '#666666'),
  other: pair('#4a4a4a', '#c4c4c4'),
  sure: pair('#2871c7', '#5190f7'),
  delivered: pair('#af293e', '#e46360'),
} as const
const CASE_LABEL: Record<Kind, string> = {
  agree: 'Agree',
  other: 'One unsure',
  sure: 'Both sure',
  delivered: 'Spam delivered',
}
const dots = (kind: Kind, r: number) => ({
  mark: 'dot' as const,
  key: kind,
  label: CASE_LABEL[kind],
  color: KINDS[kind],
  r: () => r,
  spread: 'y' as const,
  y: (d: Submission) => (d.kind === kind ? d.secondConf : null),
})
const DOT_SERIES = [dots('agree', 3), dots('other', 4), dots('sure', 5), dots('delivered', 6)]

function Agreement({ id }: { id: string }) {
  return (
    <div data-testid={id} className="min-w-0">
      <ChartCard
        title="Classifier agreement"
        height="tall"
        chart={() => (
          <CartesianChart
            label="Scatter of both verdicts for every message"
            data={SUBMISSIONS}
            tooltip={false}
            x={{
              value: xOf,
              format: (x) => String(Math.round(Number(x))),
              title: 'First classifier, %',
              domain: [50, 100],
            }}
            y={{ title: 'Second classifier, %', domain: [50, 100] }}
            series={DOT_SERIES}
            zones={[
              {
                axis: 'x',
                from: SURE,
                to: 100,
                y: { from: SURE, to: 100 },
                fill: alpha(BASALT.ink, 0.06),
                label: `${CASE_LABEL.sure}, ${SURE} %+`,
              },
            ]}
            marks={CartesianChart.custom<Submission>((plot) => {
              const r = BASALT.dotR + 1
              const obstacles = plot.data.map((d) => ({
                left: (plot.x(xOf(d)) ?? 0) - r,
                top: plot.y(d.secondConf) - r,
                width: 2 * r,
                height: 2 * r,
              }))
              const lead = plot.data.find((d) => d.kind === 'delivered')
              const named = [
                ...(lead === undefined
                  ? []
                  : [{ d: lead, text: CASE_LABEL.delivered, priority: 3 }]),
                ...plot.data
                  .filter((d) => d.kind === 'sure')
                  .map((d) => ({
                    d,
                    text: `${WORD[d.first]} vs ${WORD[d.second].toLowerCase()}`,
                    priority: 2,
                  })),
              ]
              const byId = new Map(named.map((n) => [n.d.id, n.d]))
              const { placed } = chartLabels.place(
                named.map((n) => ({
                  key: n.d.id,
                  text: n.text,
                  x: plot.x(xOf(n.d)) ?? 0,
                  y: plot.y(n.d.secondConf),
                  priority: n.priority,
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { obstacles, gap: BASALT.dotR + 3 },
              )
              return [
                text(placed, {
                  id: 'x19-named',
                  x: (l) => {
                    const d = byId.get(l.key)
                    return d === undefined ? 0 : xOf(d)
                  },
                  y: (l) => byId.get(l.key)?.secondConf ?? 0,
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
        )}
      />
    </div>
  )
}

// ---- n71: the few-photos library, a clipped unrated bar filling its own zone ----
type Rating = { key: string; photos: number; kept: boolean }
const RATINGS: Rating[] = [
  { key: 'rejected', photos: 2, kept: false },
  { key: 'one', photos: 1, kept: false },
  { key: 'two', photos: 3, kept: false },
  { key: 'three', photos: 5, kept: false },
  { key: 'four', photos: 5, kept: true },
  { key: 'five', photos: 2, kept: true },
  { key: 'unrated', photos: 5982, kept: false },
]
const RATING_WORD: Record<string, string> = {
  rejected: 'Rejected',
  one: '1★',
  two: '2★',
  three: '3★',
  four: '4★',
  five: '5★',
  unrated: 'Unrated',
}
function Stars({ id }: { id: string }) {
  return (
    <div data-testid={id} className="min-w-0">
      <ChartCard
        title="Star ratings"
        height="short"
        chart={(box) => (
          <Bars
            label="Count by star rating, keeper bars highlighted"
            data={RATINGS}
            height={box.height}
            tooltip={false}
            x={{ value: (d) => d.key, format: (x) => RATING_WORD[String(x)] ?? String(x) }}
            y={{ title: 'Photos', domain: [0, 6] }}
            zones={[
              {
                axis: 'x',
                from: 'four',
                to: 'five',
                fill: alpha(BASALT.brand, 0.1),
                label: 'Keepers',
              },
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
              },
            ]}
          />
        )}
      />
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex max-w-[1100px] min-w-0 flex-col gap-6 p-4 text-foreground">
    <Surge id="x19-surge" weeks={WEEKS} />
    <Agreement id="x19-agree" />
    <Stars id="x19-stars" />
  </main>,
)
