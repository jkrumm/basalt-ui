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
import { Box, Button, Card, Group, Paper, Skeleton, Slider, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { EmptyState, PageBar } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { FIELD, FIELD_COLS, FIELD_ROWS, HOURS, KEY_STOPS, KEY_UNIT } from './map-data'
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
    <Stack gap="xs" p="sm" w={96} data-shot="map-key" aria-label={`Key: ${KEY_UNIT}`}>
      <Text size="xs" c="dimmed">
        {KEY_UNIT}
      </Text>
      <Group gap="xs" wrap="nowrap" align="stretch" flex={1} mih={120}>
        <svg width={10} height="100%" aria-hidden>
          <defs>
            <linearGradient id="sky-key-ramp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={VX.accent} stopOpacity={opacityOf(0)} />
              <stop offset="1" stopColor={VX.accent} stopOpacity={opacityOf(100)} />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#sky-key-ramp)" />
        </svg>
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

function Scrubber({ disabled }: { disabled: boolean }) {
  const [hour, setHour] = useState(2)
  return (
    <Paper
      data-shot="map-scrubber"
      pos="absolute"
      left="var(--vx-space-stack-md)"
      bottom="var(--vx-space-stack-md)"
      w="min(320px, calc(100% - 2 * var(--vx-space-stack-md)))"
    >
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Forecast hour
          </Text>
          <Text size="sm" fw={550}>
            {HOURS[hour]}
          </Text>
        </Group>
        <Slider
          value={hour}
          onChange={setHour}
          min={0}
          max={HOURS.length - 1}
          label={(v) => HOURS[v]}
          aria-label="Forecast hour"
          disabled={disabled}
        />
      </Stack>
    </Paper>
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
      <EmptyState
        tier="section"
        title="Could not load the cloud forecast"
        description={retryCopy('forecast service')}
        action={
          <Button size="xs" variant="default" onClick={noop}>
            Retry
          </Button>
        }
      />
    )
  }
  if (shotState === 'empty') {
    return (
      <EmptyState
        tier="section"
        title="No forecast for tonight"
        description="The next run publishes at 18:00. Check back then."
      />
    )
  }
  return <Field />
}

function Body({ shotState }: ScenarioProps) {
  return (
    <Group gap={0} wrap="nowrap" align="stretch" h="100%">
      <Box pos="relative" flex={1} miw={0}>
        <Canvas shotState={shotState} />
        <Scrubber disabled={shotState !== undefined} />
        <Attribution />
      </Box>
      <KeyRail />
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
