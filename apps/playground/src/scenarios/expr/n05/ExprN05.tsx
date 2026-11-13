/**
 * n05: which models give the most quality for their price, and which is beaten by a cheaper one.
 *
 *   Question: Which models give the most quality for their price, and which does a cheaper one beat?
 *   Decision: Pick a model for a workload, or drop one from the shortlist.
 *
 * A scatter of quality against log price with the frontier staircase; filled accent dots sit on it,
 * hollow grey ones are beaten. The ranked list and the table give every figure without a hover.
 */
import { Box, Button, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarList, EmptyState, PageBar, Section } from 'basalt-ui'
import { ChartCard } from 'basalt-ui/charts'
import type { ChartFact, ResponsiveChartHeight } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS } from 'basalt-ui/tokens'
import { cardStateProps, chartStateFor, noop, queryFor, retryCopy } from '../../shot-state'
import type { ScenarioProps, ShotState } from '../../shot-state'
import { AS_OF_LABEL, CHART_HEIGHT, VIEW, fmtExtra, fmtPerMillion, fmtPrice } from './fixture'
import type { Model, View } from './fixture'
import { useFocusedModel } from './focus'
import { PriceQualityChart } from './PriceQualityChart'

const EMPTY_COPY =
  'No models are priced yet. Import a price list: the frontier appears once two models have a price and a score.'
const NONE_BEATEN_COPY = 'No model is beaten: every priced model sits on the frontier.'
const errorCopy = (): string => retryCopy('model catalog')

// cycle-expression-1: a card holding a hand-composed chart cannot say how tall its loaded card is, so
// the empty and error placeholders reserve the chart height, the captions, key and readout around it
// and the header's headline and subtitle (hidden in those states), summed by hand from the r1 shots;
// the loading state renders the body itself (a ghost chart of the same box) instead.
const BODY_OVERHEAD = { base: 145, regular: 143, wide: 143 } as const
const HEADER_EXTRA = { base: 104, regular: 62, wide: 62 } as const
const BODY_HEIGHT: ResponsiveChartHeight = {
  base: CHART_HEIGHT.base + BODY_OVERHEAD.base + HEADER_EXTRA.base,
  regular: CHART_HEIGHT.regular + BODY_OVERHEAD.regular + HEADER_EXTRA.regular,
  wide: CHART_HEIGHT.wide + BODY_OVERHEAD.wide + HEADER_EXTRA.wide,
}

const col = createColumnHelper<Model>()

const COLUMNS = [
  col.accessor('name', { header: 'Model', meta: { priority: 1 } }),
  col.accessor('price', {
    header: 'Price (USD per 1M tokens)',
    cell: (c) => fmtPrice(c.getValue()),
    meta: { kind: 'number', priority: 2 },
  }),
  col.accessor('quality', { header: 'Quality (0-100)', meta: { kind: 'number', priority: 2 } }),
  col.accessor((m) => (m.frontier ? 'On the frontier' : 'Beaten'), {
    id: 'verdict',
    header: 'Verdict',
    meta: { priority: 3 },
  }),
  col.accessor((m) => m.beatenBy?.name ?? '—', {
    id: 'beatenBy',
    header: 'Beaten by',
    meta: { priority: 4 },
  }),
  col.accessor('family', { header: 'Family', meta: { priority: 5 } }),
  col.accessor((m) => m.size ?? '—', { id: 'size', header: 'Size', meta: { priority: 6 } }),
]

/** The lead fact as one sentence: what the readout says while no dot has focus. */
const idleOf = (view: View): string => {
  if (view.leader === null)
    return 'Point at a dot, or tab into the chart and use the arrow keys, to read a model.'
  const { model, beats } = view.leader
  return `${model.name}: ${model.quality} quality at ${fmtPerMillion(model.price)}. It beats ${beats} pricier ${beats === 1 ? 'model' : 'models'}. Point at a dot, or use the arrow keys, to read another.`
}

const leadFact = (view: View): ChartFact | undefined => {
  if (view.leader !== null) {
    const { model, beats, avgExtra, avgGain } = view.leader
    return {
      value: model.name,
      unit: `beats ${beats} pricier ${beats === 1 ? 'model' : 'models'}, for ${fmtPrice(avgExtra)} less and +${Math.round(avgGain)} pts on average`,
    }
  }
  const only = view.frontier[0]
  if (only === undefined) return undefined
  return {
    value:
      view.frontier.length === 1 ? only.name : `${view.frontier.length} of ${view.models.length}`,
    unit: view.frontier.length === 1 ? 'is the only model' : 'models, none beaten',
  }
}

function FrontierCard({ view, shotState }: { view: View; shotState: ShotState | undefined }) {
  const loading = shotState === 'loading'
  const fact = leadFact(view)
  return (
    <Box data-shot="price-quality" h="100%">
      <ChartCard
        title="Quality against price by model"
        subtitle={`USD per 1M tokens, 3:1 input to output, ${AS_OF_LABEL}`}
        info="The dashed staircase joins the models no cheaper model matches on quality; below it, a cheaper model scores the same or more. The headline is the frontier model that the most other models are beaten by."
        {...(fact !== undefined && { facts: fact })}
        placeholderHeight={loading ? 'content' : BODY_HEIGHT}
        state={chartStateFor(shotState, { empty: EMPTY_COPY, error: errorCopy() })}
        {...(shotState === 'error' && { onRetry: noop })}
        {...(shotState === 'empty' && {
          stateAction: (
            <Button variant="default" onClick={noop}>
              Import price list
            </Button>
          ),
        })}
      >
        <Box data-shot-hover data-shot-tooltip>
          <PriceQualityChart view={view} pending={loading} idle={idleOf(view)} />
        </Box>
      </ChartCard>
    </Box>
  )
}

const bar = (m: Model, focused: Model | undefined) => {
  const lit =
    focused !== undefined && (focused.name === m.name || focused.name === m.beatenBy?.name)
  const secondary = `${m.beatenBy?.short ?? ''} \u00b7 +${m.beatenBy?.gain ?? 0} pts`
  return {
    key: m.name,
    label: m.name,
    // cycle-expression-1: BarList has no minimum bar length, so the bar runs on sqrt(extra) and the
    // value reads back through `format`; the caption above the list states the scale.
    value: Math.sqrt(m.beatenBy?.extra ?? 0),
    // cycle-expression-1: BarList has no row highlight, so the row the scatter's focus names (the model,
    // or a model it beats) is set in bold through its secondary slot.
    secondary: lit ? (
      <Text span inherit fw={700}>
        {secondary}
      </Text>
    ) : (
      secondary
    ),
  }
}

function BeatenCard({ view, shotState }: { view: View; shotState: ShotState | undefined }) {
  const focused = useFocusedModel(view)
  const items = view.beaten.map((m) => bar(m, focused))
  const copy = shotState === 'empty' ? EMPTY_COPY : NONE_BEATEN_COPY
  return (
    <Box data-shot="beaten-by-cheaper" h="100%">
      <ChartCard
        style={{ height: '100%' }}
        title="Beaten by a cheaper model"
        subtitle="Extra price over the cheapest model that scores at least as much, per 1M tokens"
        facts={
          items.length === 0
            ? { value: 'None', unit: 'every model is on the frontier' }
            : {
                value: `${items.length} of ${view.models.length}`,
                unit: 'models are beaten by a cheaper one',
              }
        }
        {...cardStateProps(shotState, errorCopy(), 'content', EMPTY_COPY)}
      >
        <Stack gap="xs" data-shot-hover>
          <Text size="xs" c="dimmed">
            Bar length follows the square root of the extra price
          </Text>
          <BarList
            label="Extra price per 1M tokens of each beaten model over the model that beats it, USD, bars on a square-root scale"
            items={shotState === undefined ? items : []}
            format={(v) => fmtExtra(v * v)}
            loading={shotState === 'loading'}
            loadingRows={Math.max(items.length, 5)}
            emptyText={copy}
          />
        </Stack>
      </ChartCard>
    </Box>
  )
}

function ModelTable({ view, shotState }: { view: View; shotState: ShotState | undefined }) {
  const query = queryFor(shotState, errorCopy())
  return (
    <Box data-shot="model-table">
      <Section title="All models by price">
        <BasaltDataTable
          data={shotState === undefined ? [...view.models] : []}
          columns={COLUMNS}
          rowLabel={(m) => m.name}
          skeletonRows={view.models.length}
          {...(query !== undefined && { query })}
          emptyState={
            <EmptyState tier="section" title="No models listed" description={EMPTY_COPY} />
          }
        />
      </Section>
    </Box>
  )
}

/** The page over any model list: zero models is the empty state, one is a lone frontier point. */
export function ModelsPage({ view, shotState }: { view: View; shotState: ShotState | undefined }) {
  const state = view.models.length === 0 && shotState === undefined ? 'empty' : shotState
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar />
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.wide]: 2 }}>
        <FrontierCard view={view} shotState={state} />
        <BeatenCard view={view} shotState={state} />
      </SimpleGrid>
      <ModelTable view={view} shotState={state} />
    </Stack>
  )
}

export function ExprN05Scenario({ shotState }: ScenarioProps) {
  return <ModelsPage view={VIEW} shotState={shotState} />
}
