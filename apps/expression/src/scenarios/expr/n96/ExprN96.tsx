import { useFormat } from 'basalt-ui'
import type { Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N96_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildLibrary, variantOf } from './fixture'
import type { Library, Setting } from './fixture'

type Formatter = ReturnType<typeof useFormat>

/** A setting under this share of the photos is almost never used. */
const SELDOM = 0.01

type Dimension = {
  key: 'focal' | 'aperture' | 'iso' | 'shutter'
  title: string
  subtitle: string
  xTitle: string
  /** The setting as a reader says it: "35 mm", "f/2.8". */
  name: (label: string, f: Formatter) => string
  /** The tick text of a setting. */
  tick: (label: string, f: Formatter) => string
  /** The empty sentence of a card whose own source is missing. */
  cause?: string
}

const DIMENSIONS: readonly Dimension[] = [
  {
    key: 'focal',
    title: 'Focal length',
    subtitle: 'Wide to tele',
    xTitle: 'mm',
    name: (label) => `${label} mm`,
    tick: (label) => label,
  },
  {
    key: 'aperture',
    title: 'Aperture',
    subtitle: 'Wide open to stopped down',
    xTitle: 'f-number',
    name: (label) => `f/${label}`,
    tick: (label) => label,
  },
  {
    key: 'iso',
    title: 'ISO',
    subtitle: 'Only the values in use',
    xTitle: 'ISO value',
    name: (label, f) => `ISO ${f.number(Number(label))}`,
    tick: (label, f) => f.number(Number(label)),
    cause: 'No ISO was recorded for these photos. Import them again with their EXIF data.',
  },
  {
    key: 'shutter',
    title: 'Shutter speed',
    subtitle: 'Fast to slow',
    xTitle: 'seconds',
    name: (label) => `${label} s`,
    tick: (label) => label,
  },
]

const RETRY = () => undefined

const photosOf = (f: Formatter, n: number): string =>
  `${f.number(n)} ${f.plural(n) === 'one' ? 'photo' : 'photos'}`

const shareOf = (f: Formatter, fraction: number): string =>
  fraction < 0.001
    ? '<0.1 %'
    : f.percent(fraction, { maximumFractionDigits: fraction < 0.1 ? 1 : 0 }).replace('%', ' %')

type CardProps = {
  dim: Dimension
  settings: readonly Setting[]
  total: number
  phase: Phase
  empty: Empty | null
}

function SettingCard({ dim, settings, total, phase, empty }: CardProps) {
  const f = useFormat()
  const focus = useChartFocus(settings, {
    announce: (s) =>
      `${dim.name(s.label, f)}: ${photosOf(f, s.photos)}, ${shareOf(f, s.photos / total)}`,
  })
  const peak = settings.reduce((max, s) => Math.max(max, s.photos), 0)
  const top = settings.find((s) => s.photos === peak)
  const used = settings.filter((s) => s.photos > 0)
  const least = used.reduce<Setting | undefined>(
    (low, s) => (low === undefined || s.photos < low.photos ? s : low),
    undefined,
  )
  const seldom = settings.filter((s) => s.photos < total * SELDOM)
  const first = settings.at(0)
  const last = settings.at(-1)

  const footer: FootFacts =
    least === undefined
      ? [
          { label: 'Under 1 %', value: '' },
          { label: 'Rarest', value: '' },
        ]
      : [
          { label: 'Under 1 %', value: `${seldom.length} of ${settings.length}` },
          {
            label: 'Rarest',
            value: `${dim.name(least.label, f)} (${f.number(least.photos)})`,
          },
        ]

  return (
    <ChartCard
      title={dim.title}
      subtitle={dim.subtitle}
      height="tall"
      phase={phase}
      empty={empty}
      figure={
        top === undefined
          ? { value: null, period: '' }
          : {
              value: dim.name(top.label, f),
              period: focus.readout(
                `${shareOf(f, top.photos / total)} of photos`,
                (s) =>
                  `${dim.name(s.label, f)}: ${photosOf(f, s.photos)}, ${shareOf(f, s.photos / total)}`,
              ),
            }
      }
      footer={footer}
      chart={(box) => (
        <Bars
          label={`${dim.title}: photos at each setting`}
          height={box.height}
          data={settings}
          focus={focus}
          tooltip={false}
          table
          cursor={`n96-${dim.key}`}
          x={{
            value: (s) => s.label,
            format: (label) => dim.tick(String(label), f),
            title: dim.xTitle,
          }}
          y={{ title: 'Photos' }}
          zones={
            first === undefined || last === undefined
              ? []
              : [
                  {
                    axis: 'x',
                    from: first.label,
                    to: last.label,
                    y: { from: 0, to: total * SELDOM },
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
              color: N96_SERIES.photos,
              y: (s) => s.photos,
              format: (v) => photosOf(f, v),
              highlight: (s) => s.photos === peak,
              values: (v, s) => (s.photos === peak ? f.number(v) : ''),
            },
          ]}
        />
      )}
    />
  )
}

const NO_PHOTOS: Library = { total: 0, focal: [], aperture: [], iso: [], shutter: [] }

export function ExprN96Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const ready = shotState === undefined
  const library = ready ? buildLibrary(variantOf(fixture)) : NO_PHOTOS
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The library did not answer', retry: RETRY }
        : 'ready'
  const nothing = shotState === 'empty'

  return (
    <Page area="scenarios">
      <PageBar title="Shooting settings" />
      {phase === 'loading' ? (
        <PageSummary phase="loading" />
      ) : phase === 'ready' && !nothing ? (
        <PageSummary sentence={`${f.number(library.total)} photos in the library`} />
      ) : phase === 'ready' ? (
        <PageSummary
          sentence="No photos in the library yet"
          facts={['Import a folder to see which settings you shoot at']}
        />
      ) : (
        <PageSummary phase={{ tag: 'error' }} />
      )}
      {/* cycle-expression-19: CardGrid has no two-by-two tier, so four wide plots form a 3+1 grid with a blank corner; two columns come from the container size */}
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-2">
          {DIMENSIONS.map((dim) => {
            const settings = library[dim.key]
            const none = phase === 'ready' && settings.every((s) => s.photos === 0)
            const empty: Empty | null = none
              ? { cause: nothing ? 'Nothing to count' : (dim.cause ?? 'Nothing to count') }
              : null
            return (
              <SettingCard
                key={dim.key}
                dim={dim}
                settings={settings}
                total={library.total}
                phase={phase}
                empty={empty}
              />
            )
          })}
        </div>
      </div>
    </Page>
  )
}
