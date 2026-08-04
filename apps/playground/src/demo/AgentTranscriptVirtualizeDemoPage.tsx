/**
 * AgentTranscriptVirtualizeDemoPage — basalt-ui 1.13.0 playground gate demos 2 + 3: a 500-message
 * `ThreadTranscript` with `virtualize` on, plus copy / regenerate / relative timestamps / author
 * grouping on the same thread.
 *
 * The 500 messages (`./agent-long-thread`) are deliberately NOT uniform height: one-line acks,
 * bulleted medium replies, and long fenced-code deep-dives sit side by side, and some consecutive
 * same-author runs land inside the 5-minute grouping window (chrome collapses) while others land
 * just outside it (chrome stays) — a uniform thread would hide both a `measureElement` regression
 * and a grouping-boundary regression.
 *
 * happy-dom (the unit test harness) has no layout engine, so `virtualize`'s actual scroll/measure
 * behavior has never been observed anywhere but here — this page is where a human confirms the
 * windowed pane scrolls smoothly. The "Virtualize" switch toggles the SAME 500 messages through
 * the unwindowed path so the cost of turning it off is felt directly, not just asserted.
 *
 * The `virtualize: true` + omitted `height` tsc error this gate also asks for is proven as a
 * committed fixture instead of re-created live here — see
 * `./agent-transcript-virtualize.type-guard.ts` beside this file.
 *
 * 1.13.0 GATE ADDITION: `overscan`/`estimateSize`/`initialScroll` — the fields of the consumer-
 * supplied `VirtualizeOptions` object form (`virtualize: { overscan, estimateSize, initialScroll }`
 * instead of the bare `virtualize: true` used everywhere else in this repo) — had never been
 * exercised from outside the package. The controls below feed all three straight through: push
 * `estimateSize` far from the true row height and scroll to feel the rows visibly jump as they
 * measure in, drop `overscan` to 0 and scroll fast to see blank frames at the windowing edge, or
 * flip `initialScroll` to see the pane mount at the newest message (`'end'`, the shipped default)
 * versus the oldest (`'start'`) on the SAME 500-message thread.
 */
import {
  Badge,
  Group,
  List,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import type { VirtualizeProps } from 'basalt-ui/agent-chat'
import { VX } from 'basalt-ui/tokens'
import { useMemo, useState } from 'react'
import { buildLongThread } from './agent-long-thread'

const MESSAGE_COUNT = 500
const TRANSCRIPT_HEIGHT = 560
const REGENERATE_LOG_MAX = 5
// Mirrors thread-message.tsx's own internal defaults (DEFAULT_VIRTUALIZE_OVERSCAN /
// DEFAULT_VIRTUALIZE_ESTIMATE_SIZE) purely as this page's starting point — neither is exported, so
// these are just reasonable initial values for the two inputs below, not a reference to the source.
// KEEP THESE IN STEP with those constants: this page ALWAYS passes the object form, so a starting
// value that disagrees with the package default means the shipped default is the one thing this
// page can never show. (1.13.0 raised estimateSize 96 → 160 for exactly the jump-on-first-descent
// reason the copy below describes; 96 was left behind here and is restored to parity.)
const DEFAULT_OVERSCAN = 6
const DEFAULT_ESTIMATE_SIZE = 160
// Mirrors the shipped `VirtualizeOptions.initialScroll` default — see the note above, same reasoning.
const DEFAULT_INITIAL_SCROLL = 'end'

export function AgentTranscriptVirtualizeDemoPage() {
  const messages = useMemo(() => buildLongThread(MESSAGE_COUNT), [])
  const [virtualizeOn, setVirtualizeOn] = useState(true)
  const [overscan, setOverscan] = useState(DEFAULT_OVERSCAN)
  const [estimateSize, setEstimateSize] = useState(DEFAULT_ESTIMATE_SIZE)
  const [initialScroll, setInitialScroll] = useState<'end' | 'start'>(DEFAULT_INITIAL_SCROLL)
  const [regenerateLog, setRegenerateLog] = useState<string[]>([])

  const virtualizeProps: VirtualizeProps = virtualizeOn
    ? { virtualize: { overscan, estimateSize, initialScroll }, height: TRANSCRIPT_HEIGHT }
    : {}

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Transcript virtualization — {MESSAGE_COUNT} messages</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Scroll the pane below to confirm it stays smooth with virtualization on. Toggle it off to
          feel the cost of rendering all {MESSAGE_COUNT} rows unwindowed on the same thread. Hover
          any message for its relative timestamp, a copy action, and — on the last assistant message
          only — Regenerate. Scroll through a few turns to see consecutive same-author messages:
          some collapse their role label and chrome (grouped, inside the 5-minute window), some
          don&apos;t (same role, but the gap crossed the window). <code>overscan</code>,{' '}
          <code>estimateSize</code>, and <code>initialScroll</code> below are the consumer-supplied{' '}
          <code>VirtualizeOptions</code> — push them off their defaults and scroll to feel the
          difference. Switching <code>initialScroll</code> remounts the pane below so you can see it
          land at the newest message (<code>&apos;end&apos;</code>, the shipped default) versus the
          oldest (<code>&apos;start&apos;</code>).
        </Text>
      </div>

      <Group gap="sm" align="flex-end">
        <Switch
          label="Virtualize (windowed rendering)"
          checked={virtualizeOn}
          onChange={(event) => setVirtualizeOn(event.currentTarget.checked)}
        />
        <NumberInput
          label="overscan"
          value={overscan}
          onChange={(value) => setOverscan(typeof value === 'number' ? value : DEFAULT_OVERSCAN)}
          min={0}
          max={50}
          disabled={!virtualizeOn}
          w={110}
        />
        <NumberInput
          label="estimateSize"
          value={estimateSize}
          onChange={(value) =>
            setEstimateSize(typeof value === 'number' ? value : DEFAULT_ESTIMATE_SIZE)
          }
          min={16}
          max={800}
          disabled={!virtualizeOn}
          w={130}
        />
        <SegmentedControl
          value={initialScroll}
          onChange={(value) => setInitialScroll(value === 'start' ? 'start' : 'end')}
          disabled={!virtualizeOn}
          data={[
            { label: 'initialScroll: end', value: 'end' },
            { label: 'initialScroll: start', value: 'start' },
          ]}
        />
        <Badge variant="light" color="gray" ff="monospace">
          {`${messages.length} messages`}
        </Badge>
      </Group>

      <Paper p="sm">
        <ThreadTranscript
          // Remounts the transcript on `initialScroll` change: like `initialOffset` in the
          // underlying virtualizer, it is consumed once at setup — flipping the control after mount
          // wouldn't move an already-scrolled pane, so a fresh `key` is what makes the option
          // actually OBSERVABLE from this page rather than merely accepted and ignored.
          key={virtualizeOn ? initialScroll : 'non-virtualized'}
          messages={messages}
          affordances={{
            timestamp: 'relative',
            copy: true,
            onRegenerate: (messageId) =>
              setRegenerateLog((prev) =>
                [`Regenerate requested for ${messageId}`, ...prev].slice(0, REGENERATE_LOG_MAX),
              ),
          }}
          {...virtualizeProps}
        />
      </Paper>

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
          Regenerate log
        </Text>
        {regenerateLog.length === 0 ? (
          <Text size="sm" c="dimmed">
            Hover the LAST assistant message — already in view when <code>initialScroll</code> is{' '}
            <code>&apos;end&apos;</code>, otherwise scroll down — and click Regenerate.
          </Text>
        ) : (
          <List size="sm" spacing={4}>
            {regenerateLog.map((line, index) => (
              <List.Item key={`${index}-${line}`}>
                <Text size="xs" ff="monospace" c={VX.faint}>
                  {line}
                </Text>
              </List.Item>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  )
}
