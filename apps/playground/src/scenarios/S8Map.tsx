/**
 * S8 — Map (stands for argo astro's Map tab). Wave 43, argo `docs/design/UPSTREAM.md` § Wave 51–52:
 * a geographic field on a map canvas with a key rail, a floating panel over a flush card, the map's
 * compact attribution, and a page that fills the scrollport.
 *
 *   Question: Where is the sky clear tonight?
 *   Decision: Drive out to observe, or stay home.
 *
 * No maplibre: the canvas is an SVG field of invented cloud cover. The attribution is a static mock
 * of MapLibre's compact control (its real class names), so `styles.css`'s block is exercised.
 *
 * Anchors for `basalt-ui shot`: `sky-map` (the card), `map-key` (the rail), `map-scrubber` (the
 * floating panel).
 */
import { Box, Card, Center, Group, Paper, Skeleton, Slider, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { EmptyState, PageBar } from 'basalt-ui'
import { ErrorNote } from '../demo/fixtures/error-note'
import { VX } from 'basalt-ui/tokens'
import {
  AREA,
  COAST,
  FIELD,
  FIELD_COLS,
  FIELD_ROWS,
  HOURS,
  HOUR_LABELS,
  KEY_STOPS,
  KEY_UNIT,
  NIGHT,
  PLACES,
} from './map-data'
import { noop, retryCopy } from './shot-state'
import type { ScenarioProps } from './shot-state'

/** Cloud cover as the accent's own opacity: one hue, a darker cell is a cloudier one. */
const opacityOf = (pct: number): number => 0.04 + (pct / 100) * 0.92

/** Only the box model of MapLibre's compact control; its radius, fill and type come from basalt. */
const MAPLIBRE_SHAPE = `
.sky-map-attrib .maplibregl-ctrl-attrib.maplibregl-compact{/* theme-allow inline-spacing — a static mock of the third-party control's own box model */min-height:20px;padding:2px 24px 2px 0;margin:10px;position:relative;box-sizing:content-box}
.sky-map-attrib .maplibregl-ctrl-attrib-button{position:absolute;top:0;right:0;width:24px;height:24px;box-sizing:border-box;border:0;padding:0;list-style:none}
.sky-map-attrib .maplibregl-ctrl-attrib-button::-webkit-details-marker{display:none}
.sky-map-attrib .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner{display:none}`

function Field() {
  return (
    <svg
      viewBox={`0 0 ${FIELD_COLS} ${FIELD_ROWS}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      role="img"
      aria-label="Cloud cover forecast, darker is cloudier"
      shapeRendering="crispEdges"
    >
      {FIELD.map((pct, i) => (
        <rect
          key={i}
          x={i % FIELD_COLS}
          y={Math.floor(i / FIELD_COLS)}
          width={1}
          height={1}
          fill={VX.accent}
          fillOpacity={opacityOf(pct)}
        />
      ))}
    </svg>
  )
}

function KeyRail() {
  return (
    <Stack
      gap="xs"
      p="sm"
      w={116}
      data-shot="map-key"
      data-shot-absent="empty error"
      aria-label={`Key: ${KEY_UNIT}`}
    >
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {KEY_UNIT}
      </Text>
      <Group gap="xs" wrap="nowrap" align="stretch" flex={1} mih={120}>
        <Box w={12} flex="none" bd={`1px solid ${VX.line}`} bdrs={2} style={{ overflow: 'hidden' }}>
          <svg width="100%" height="100%" display="block" aria-hidden>
            <defs>
              <linearGradient id="sky-key-ramp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={VX.accent} stopOpacity={opacityOf(0)} />
                <stop offset="1" stopColor={VX.accent} stopOpacity={opacityOf(100)} />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#sky-key-ramp)" />
          </svg>
        </Box>
        <Stack gap={0} justify="space-between">
          {KEY_STOPS.map((stop) => (
            <Text key={stop} size="xs">
              {stop}%
            </Text>
          ))}
        </Stack>
      </Group>
    </Stack>
  )
}

function Scrubber({ loading }: { loading: boolean }) {
  const [hour, setHour] = useState(2)
  // One body for both states: loading draws the same box (so it keeps the loaded height) and lays
  // skeletons over it in the same grid cell, with the live values hidden.
  const body = (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Forecast hour
        </Text>
        <Text size="sm" fw={550}>
          {HOUR_LABELS[hour]}
        </Text>
      </Group>
      <Slider
        value={hour}
        onChange={setHour}
        min={0}
        max={HOURS.length - 1}
        label={null}
        marks={[
          { value: 0, label: HOURS[0] },
          { value: HOURS.length - 1, label: HOURS[HOURS.length - 1] },
        ]}
        aria-label="Forecast hour"
        mb="md"
      />
    </Stack>
  )
  return (
    <Paper
      data-shot="map-scrubber"
      data-shot-absent="empty error"
      pos="absolute"
      left="var(--vx-space-stack-md)"
      bottom="var(--vx-space-stack-md)"
      w="min(320px, calc(100% - 2 * var(--vx-space-stack-md)))"
      // theme-allow inline-display — the loading skeleton overlays the hidden live body in one grid cell, so the box keeps its loaded height
      {...(loading && { 'aria-busy': true, display: 'grid' })}
    >
      {loading ? (
        <>
          <Box aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
            {body}
          </Box>
          <Stack gap="xs" justify="space-between" style={{ gridArea: '1 / 1' }}>
            <Group justify="space-between">
              <Skeleton h={12} w="35%" />
              <Skeleton h={14} w="18%" />
            </Group>
            <Skeleton h={8} />
            <Group justify="space-between">
              <Skeleton h={10} w={36} />
              <Skeleton h={10} w={36} />
            </Group>
          </Stack>
        </>
      ) : (
        body
      )}
    </Paper>
  )
}

/** The card's title: the area and the night, over the map. Error and empty leave it out: the state's own copy names the forecast and the panel would sit on it. */
function Heading() {
  return (
    <Paper
      pos="absolute"
      top="var(--vx-space-stack-md)"
      left="var(--vx-space-stack-md)"
      style={{ zIndex: 1 }}
    >
      <Text size="sm" fw={600}>
        Cloud cover, {AREA}
      </Text>
      <Text size="xs" c="dimmed">
        Night of {NIGHT}
      </Text>
    </Paper>
  )
}

/** An invented coastline and three place names: the field reads as a place, not a bare grid. */
function Geography() {
  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        aria-hidden
        style={{ position: 'absolute', inset: 0 }}
      >
        <path
          d={COAST}
          fill="none"
          stroke={VX.ink2}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {PLACES.map((p) => (
        <Text
          key={p.name}
          size="xs"
          c={VX.ink}
          pos="absolute"
          left={`${p.left}%`}
          top={`${p.top}%`}
          px={4}
          bg={VX.surface.panel}
          bdrs={2}
          style={{ whiteSpace: 'nowrap' }}
        >
          {p.name}
        </Text>
      ))}
    </>
  )
}

function Attribution() {
  return (
    <Box className="sky-map-attrib" pos="absolute" right={0} bottom={0}>
      <style>{MAPLIBRE_SHAPE}</style>
      <details className="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact">
        <summary className="maplibregl-ctrl-attrib-button" aria-label="Toggle attribution" />
        <div className="maplibregl-ctrl-attrib-inner">
          <a href="https://example.com">© Example forecast</a>
        </div>
      </details>
    </Box>
  )
}

/** The canvas's own content: the field at rest, or the state's body. The map chrome stays in every state. */
function Canvas({ shotState }: ScenarioProps) {
  if (shotState === 'loading') return <Skeleton h="100%" />
  if (shotState === 'error') {
    return (
      <Box p="md">
        <ErrorNote
          title="Could not load the cloud forecast"
          cause={retryCopy('forecast service')}
          onRetry={noop}
        />
      </Box>
    )
  }
  if (shotState === 'empty') {
    return (
      <Center h="100%" p="md">
        <EmptyState
          tier="section"
          title={`No cloud forecast for ${AREA} tonight`}
          description="The next run publishes at 18:00. Check back then."
        />
      </Center>
    )
  }
  return (
    <>
      <Field />
      <Geography />
    </>
  )
}

function Body({ shotState }: ScenarioProps) {
  // The floating chrome (heading, scrubber, key) leaves the state readable: it shows at rest and while loading.
  const chrome = shotState !== 'empty' && shotState !== 'error'
  return (
    <Group gap={0} wrap="nowrap" align="stretch" h="100%">
      <Box pos="relative" flex={1} miw={0}>
        <Canvas shotState={shotState} />
        {chrome && <Heading />}
        {chrome && <Scrubber loading={shotState === 'loading'} />}
        <Attribution />
      </Box>
      {chrome && <KeyRail />}
    </Group>
  )
}

export function MapScenario({ shotState }: ScenarioProps) {
  return (
    <>
      <PageBar />
      <Card
        variant="flush"
        data-shot="sky-map"
        data-shot-states="empty loading error"
        h="var(--basalt-main-content-h)"
        mih={420}
        style={{ overflow: 'hidden' }}
      >
        <Body shotState={shotState} />
      </Card>
    </>
  )
}
