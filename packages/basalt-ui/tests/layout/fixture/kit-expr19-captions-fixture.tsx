/**
 * Issue 2889 kit fixes: n96's bar cards (a 1 % band across every bucket, a caption wider than the
 * gaps between the bars) and n97's stack (the
 * y hover chip beside the ticks), as their scenarios build them. Read by `kit-expr19-captions.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { alpha, BASALT } from '../../../src/tokens'
import { Bars } from '../../../src/charts/parts/bars'

const tone = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})

// ---- n96: photos per focal length, tall bars in the middle, a 1 % band over every bucket ----
type Bucket = { label: string; photos: number }
const SHAPE = [
  3, 5, 12, 80, 60, 70, 630, 410, 1079, 120, 905, 210, 470, 95, 255, 430, 8, 120, 14, 12,
]
const FOCAL: Bucket[] = SHAPE.map((photos, i) => ({ label: String(10 + i * 7), photos }))
// The aperture card: a long run of tall bars and a short tail, so the corner and the middle are taken.
const TAIL = [
  1, 230, 90, 280, 250, 75, 135, 610, 190, 260, 105, 170, 535, 130, 395, 75, 195, 35, 8, 55, 6, 12,
]
const APERTURE: Bucket[] = TAIL.map((photos, i) => ({ label: `f/${i + 1}`, photos }))

function Photos({ data, id }: { data: Bucket[]; id: string }) {
  const first = data[0]
  const last = data.at(-1)
  const total = data.reduce((sum, d) => sum + d.photos, 0)
  const peak = Math.max(...data.map((d) => d.photos))
  return (
    <div data-testid={id} className="min-w-0">
      <Bars<Bucket>
        label={id}
        data={data}
        height={300}
        tooltip={false}
        x={{ value: (d) => d.label }}
        y={{ title: 'Photos' }}
        zones={
          first === undefined || last === undefined
            ? []
            : [
                {
                  axis: 'x',
                  from: first.label,
                  to: last.label,
                  y: { from: 0, to: total * 0.01 },
                  fill: alpha(BASALT.inkMuted, 0.14),
                  label: 'Almost never',
                },
              ]
        }
        series={[
          {
            mark: 'bar',
            key: 'photos',
            label: 'Photos',
            color: tone(1),
            y: (d) => d.photos,
            highlight: (d) => d.photos === peak,
            values: (v, d) => (d.photos === peak ? String(v) : ''),
          },
        ]}
      />
    </div>
  )
}

// ---- n97: monthly stack, the y chip beside the 100 tick ----
type Month = { at: string; kept: number; rejected: number; unrated: number }
const MONTHS: Month[] = [
  ['Dec', 119, 148, 12],
  ['Jan', 119, 148, 22],
  ['Feb', 110, 166, 32],
  ['Mar', 120, 190, 20],
  ['Apr', 124, 126, 10],
  ['May', 130, 168, 28],
  ['Jun', 5, 6, 148],
  ['Jul', 4, 3, 122],
  ['Aug', 2, 1, 110],
  ['Sep', 118, 174, 26],
].map(([at, kept, rejected, unrated]) => ({
  at: at as string,
  kept: kept as number,
  rejected: rejected as number,
  unrated: unrated as number,
}))

function Stack() {
  return (
    <div data-testid="x19-stack" className="min-w-0">
      <Bars<Month>
        label="Shots per month"
        data={MONTHS}
        height={300}
        tooltip={false}
        x={{ value: (d) => d.at }}
        y={{ title: 'Shots per month' }}
        series={[
          { mark: 'bar', key: 'kept', label: 'Kept', color: tone(1), y: (d) => d.kept },
          { mark: 'bar', key: 'rejected', label: 'Rejected', color: tone(2), y: (d) => d.rejected },
          { mark: 'bar', key: 'unrated', label: 'Unrated', color: tone(3), y: (d) => d.unrated },
        ]}
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
    <Photos id="x19-focal" data={FOCAL} />
    <Photos id="x19-aperture" data={APERTURE} />
    <Stack />
  </main>,
)
