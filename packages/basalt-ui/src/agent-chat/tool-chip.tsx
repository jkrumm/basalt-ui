/**
 * ToolChip — a one-line collapsed row for a tool-call part, expanding to its input/output JSON.
 *
 * Replaces `thread-message.tsx`'s old always-expanded `ToolRenderer`, which unconditionally
 * rendered both input and output `<pre>` blocks. Collapsed, it shows a mono micro-label, the tool
 * name, a state dot, and `durationMs` when present; expanded, it shows whatever the part's state
 * actually carries — input, output, the surviving `rawInput` for a call whose input never
 * validated, the error text, the denial reason, or the approve/deny affordances.
 *
 * @example
 * import { ToolChip } from 'basalt-ui/agent-chat'
 *
 * <ToolChip
 *   part={part}
 *   onApprove={(id) => api.runs.approve.post({ approvalId: id })}
 *   onDeny={(id, reason) => api.runs.deny.post({ approvalId: id, reason })}
 * />
 */
import { Box, Button, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { JSX } from 'react'
import { isToolCallSettled } from '../agent'
import type { ToolCallPart } from '../agent'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { alpha, VX } from '../tokens'

// Mirrors thread-message.tsx's micro-label/rail/code-block idiom (docs/DESIGN-SPEC.md §3/§5) —
// duplicated locally rather than imported, matching the existing part-list.tsx/thread-message.tsx
// precedent of each Mantine-facing renderer file owning its own copy of these style objects.
const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const
const RAIL_STYLE = {
  borderLeft: `2px solid ${VX.divider}`,
  paddingLeft: 'var(--vx-space-agent-rail-inset-x)',
} as const
const CODE_BLOCK_STYLE = {
  margin: 0,
  marginTop: 'var(--vx-space-agent-part-gap-top)',
  fontFamily: 'var(--basalt-font-mono)',
  backgroundColor: alpha(VX.ink, 0.06),
  borderRadius: 'var(--vx-radius-card)',
  padding: 'var(--vx-space-agent-code-inset)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
} as const

/** Per-state (label, dot color) — the exhaustive switch that drives the collapsed row. */
function stateMeta(part: ToolCallPart): { readonly label: string; readonly dotToken: string } {
  switch (part.state) {
    case 'input-streaming':
      return { label: 'streaming', dotToken: VX.status.neutral }
    case 'input-available':
      // No 'running' state on the wire — 'input-available' IS the running state (input complete,
      // no output yet). This label is a UI-only gloss on that wire state, not a new state.
      return { label: 'running', dotToken: VX.status.neutral }
    case 'approval-requested':
      return { label: 'needs approval', dotToken: VX.status.warn }
    case 'approval-responded':
      return part.approval.approved
        ? { label: 'approved', dotToken: VX.status.neutral }
        : { label: 'declined', dotToken: VX.status.bad }
    case 'output-available':
      // preliminary vs final must be visually distinguishable — the label carries that here; the
      // expanded output body below is identical either way.
      return part.preliminary === true
        ? { label: 'preliminary', dotToken: VX.status.warn }
        : { label: 'done', dotToken: VX.status.good }
    case 'output-error':
      return { label: 'error', dotToken: VX.status.bad }
    case 'output-denied':
      return { label: 'denied', dotToken: VX.status.bad }
    default: {
      // `part` is `never` here ONLY at compile time — this switch is genuinely exhaustive today,
      // so adding an eighth ToolCallPart state without a case above makes this assignment a tsc
      // error, the same gate `assertNever` provides. But `part` at RUNTIME can be a value this
      // build never declared: `createThreadsStore` persists to localStorage with no shape
      // validation, and `edenTransport` trusts the wire with zero validation, so a 1.10.0-shaped
      // flat tool part (`state` undefined) or a future/foreign `state` string both reach here.
      // That must never THROW during render — mirrors ThreadTranscript's fallbackRenderer
      // doctrine (unknown data renders inert, it doesn't blank the transcript) — so, unlike a
      // genuinely-exhaustive switch elsewhere, this default returns a neutral descriptor instead
      // of calling assertNever.
      const exhaustive: never = part
      void exhaustive
      return { label: 'unknown', dotToken: VX.status.neutral }
    }
  }
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

export type ToolChipProps = BasaltProps & {
  readonly part: ToolCallPart
  readonly defaultExpanded?: boolean
  /** Rendered only in 'approval-requested'. Omit both to render a read-only chip. */
  readonly onApprove?: (approvalId: string) => void
  readonly onDeny?: (approvalId: string, reason?: string) => void
}

/**
 * A collapsed-by-default row for a single tool-call part. All seven wire states render something
 * sane; the switch above still gates an eighth (compile-time-unhandled) state as a tsc error via a
 * `const _: never = part` assignment, but unlike a truly-closed switch, its `default` branch never
 * throws at RUNTIME — a value from persisted/wire data that reaches here with a `state` this build
 * doesn't recognize renders an inert 'unknown' chip instead of blanking the transcript.
 *
 * @example
 * <ToolChip part={part} />
 */
export function ToolChip({
  part,
  defaultExpanded = false,
  onApprove,
  onDeny,
  className,
  style,
}: ToolChipProps): JSX.Element {
  assertRequiredProps('ToolChip', { part }, ['part'])
  const [expanded, { toggle }] = useDisclosure(defaultExpanded)
  const { label, dotToken } = stateMeta(part)
  const settled = isToolCallSettled(part)

  const input = 'input' in part ? part.input : undefined
  const rawInput = part.state === 'output-error' ? part.rawInput : undefined

  return (
    <Box className={cx(className)} style={style ? { ...RAIL_STYLE, ...style } : RAIL_STYLE}>
      <Stack gap={4}>
        <UnstyledButton onClick={toggle}>
          <Group gap={6} align="center" wrap="nowrap">
            <Box
              aria-hidden
              style={{
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: '50%', // theme-allow raw-surface — a 6px state dot is a circle, not a surface corner
                backgroundColor: dotToken,
              }}
            />
            <Text style={MICRO_LABEL_STYLE}>{part.toolName}</Text>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            {part.durationMs !== undefined && (
              <Text
                style={{
                  fontFamily: 'var(--basalt-font-mono)',
                  fontSize: VX.text.micro,
                  color: VX.faint,
                }}
              >
                {formatDuration(part.durationMs)}
              </Text>
            )}
            {!settled && (
              <Text size="xs" c="dimmed">
                …
              </Text>
            )}
          </Group>
        </UnstyledButton>
        <Collapse expanded={expanded}>
          <Stack gap={6}>
            {input !== undefined && (
              <Text component="pre" size="xs" style={CODE_BLOCK_STYLE}>
                {JSON.stringify(input, null, 2)}
              </Text>
            )}
            {rawInput !== undefined && (
              <Text component="pre" size="xs" style={CODE_BLOCK_STYLE}>
                {JSON.stringify(rawInput, null, 2)}
              </Text>
            )}
            {part.state === 'output-available' && (
              <Text component="pre" size="xs" style={CODE_BLOCK_STYLE}>
                {JSON.stringify(part.output, null, 2)}
              </Text>
            )}
            {part.state === 'output-error' && (
              <Text size="xs" style={{ color: VX.status.bad }}>
                {part.errorText}
              </Text>
            )}
            {part.state === 'output-denied' && part.approval.reason !== undefined && (
              <Text size="xs" c="dimmed">
                {part.approval.reason}
              </Text>
            )}
            {part.state === 'approval-requested' &&
              (onApprove !== undefined || onDeny !== undefined) && (
                <Group gap={6}>
                  {onApprove !== undefined && (
                    <Button size="compact-sm" onClick={() => onApprove(part.approval.id)}>
                      Approve
                    </Button>
                  )}
                  {onDeny !== undefined && (
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      onClick={() => onDeny(part.approval.id)}
                    >
                      Deny
                    </Button>
                  )}
                </Group>
              )}
          </Stack>
        </Collapse>
      </Stack>
    </Box>
  )
}
