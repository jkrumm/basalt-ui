/**
 * PartList — exhaustively renders a list of AgentPart values using an overridable renderer map.
 *
 * The exhaustive switch with a `default: assertNever(part)` case guarantees that adding a new
 * AgentPart variant without updating this file (or the consumer's override map) is a tsc error.
 *
 * All default renderers are headless — plain HTML elements with className hooks, zero Mantine.
 * Consumers can override any or all renderers via the `components` prop. `PartList` itself stays
 * headless — the markdown renderer is the consumer's choice; basalt's own is `basalt-ui/content`'s
 * `Markdown`.
 *
 * The text renderer defaults to plain text (className="basalt-agent-text"). To render rich
 * markdown, pass a custom text renderer:
 *
 * @example
 * import { PartList } from 'basalt-ui/agent'
 * import { Markdown } from 'basalt-ui/content'
 *
 * <PartList
 *   parts={parts}
 *   components={{
 *     text: ({ part, settled }) => (
 *       <Markdown streaming={!settled} contentTrust="untrusted" density="chat">{part.text}</Markdown>
 *     ),
 *   }}
 * />
 */
import { Fragment, useMemo } from 'react'
import type { JSX } from 'react'
import { assertNever } from '../register'
import { alpha, VX } from '../tokens'
import type {
  AgentPart,
  ErrorPart,
  ReasoningPart,
  SourcePart,
  TextPart,
  ToolCallPart,
} from './parts'

// ── Per-type renderer signatures ──────────────────────────────────────────────

/**
 * The per-renderer argument. `settled` is `false` only while the message these parts belong to is
 * still streaming — it converges this map toward the `PartRenderContext` a foreign renderer
 * already receives (`./foreign`), rather than adding a third shape. Additive and
 * source-compatible: an existing `({ part }) => …` renderer simply ignores it.
 *
 * Settlement is MONOTONE — a message that has settled never un-settles.
 */
type PartRenderArgs<TPart> = {
  part: TPart
  index: number
  settled: boolean
}

export type TextPartRenderer<TPart extends AgentPart = AgentPart> = (
  props: PartRenderArgs<Extract<TPart, { type: 'text' }>>,
) => JSX.Element | null

export type ReasoningPartRenderer<TPart extends AgentPart = AgentPart> = (
  props: PartRenderArgs<Extract<TPart, { type: 'reasoning' }>>,
) => JSX.Element | null

export type ToolCallPartRenderer<TPart extends AgentPart = AgentPart> = (
  props: PartRenderArgs<Extract<TPart, { type: 'tool' }>>,
) => JSX.Element | null

export type SourcePartRenderer<TPart extends AgentPart = AgentPart> = (
  props: PartRenderArgs<Extract<TPart, { type: 'source' }>>,
) => JSX.Element | null

export type ErrorPartRenderer<TPart extends AgentPart = AgentPart> = (
  props: PartRenderArgs<Extract<TPart, { type: 'error' }>>,
) => JSX.Element | null

/**
 * Partial map of per-type renderers. Any omitted key falls back to the headless default.
 *
 * @example
 * const renderers: Partial<AgentPartRenderers> = {
 *   text: ({ part, settled }) => (
 *     <Markdown streaming={!settled} contentTrust="untrusted" density="chat">{part.text}</Markdown>
 *   ),
 * }
 */
export type AgentPartRenderers<TPart extends AgentPart = AgentPart> = {
  readonly text: TextPartRenderer<TPart>
  readonly reasoning: ReasoningPartRenderer<TPart>
  readonly tool: ToolCallPartRenderer<TPart>
  readonly source: SourcePartRenderer<TPart>
  readonly error: ErrorPartRenderer<TPart>
}

// ── Default headless renderers ────────────────────────────────────────────────
//
// Styled inline with `VX.*` / `alpha()` (never raw hex) so a bare consumer — one that renders
// `PartList` with no `components` override — still gets the on-brand look, not unstyled HTML.
// className hooks are kept alongside so a consumer's own CSS can still target/override each part.

/** Mono, uppercase, letter-spaced micro-label idiom (docs/DESIGN-SPEC.md §3) — reasoning/tool
 * headers below. */
const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const

/** Faint left divider rail (docs/DESIGN-SPEC.md §5) — reasoning/tool-call parts read as transcript
 * asides, not surfaces. */
const RAIL_STYLE = {
  borderLeft: `2px solid ${VX.divider}`,
  paddingLeft: 'var(--vx-space-agent-rail-inset-x)',
} as const

const CODE_BLOCK_STYLE = {
  marginTop: 'var(--vx-space-agent-part-gap-top)',
  fontFamily: 'var(--basalt-font-mono)',
  backgroundColor: alpha(VX.ink, 0.06),
  borderRadius: 'var(--vx-radius-card)',
  padding: 'var(--vx-space-agent-code-inset)',
  overflowX: 'auto',
} as const

/** Terminal-state status line (tool-call error/denial) — plain text, no code-block chrome. */
const STATUS_LINE_STYLE = {
  marginTop: 'var(--vx-space-agent-part-gap-top)',
  color: VX.status.bad,
} as const

function DefaultText({ part }: { part: TextPart; index: number }): JSX.Element {
  return (
    <div
      className="basalt-agent-text"
      style={{ color: VX.ink, fontFamily: 'var(--basalt-font-sans)' }}
    >
      {part.text}
    </div>
  )
}

function DefaultReasoning({ part }: { part: ReasoningPart; index: number }): JSX.Element {
  return (
    <details className="basalt-agent-reasoning" style={RAIL_STYLE}>
      <summary
        className="basalt-agent-reasoning-summary"
        style={{ ...MICRO_LABEL_STYLE, cursor: 'pointer' }}
      >
        Reasoning
      </summary>
      <div
        className="basalt-agent-reasoning-body"
        style={{ color: VX.muted, marginTop: 'var(--vx-space-agent-part-gap-top)' }}
      >
        {part.text}
      </div>
    </details>
  )
}

function DefaultToolCall({ part }: { part: ToolCallPart; index: number }): JSX.Element {
  return (
    <div className="basalt-agent-tool" style={RAIL_STYLE}>
      <span className="basalt-agent-tool-name" style={MICRO_LABEL_STYLE}>
        {part.toolName}
      </span>
      <pre className="basalt-agent-tool-input" style={CODE_BLOCK_STYLE}>
        {JSON.stringify(part.input, null, 2)}
      </pre>
      {/* output-error's input never validated — rawInput is the only surviving record of what was
          actually sent, so show it whenever there is no validated input to show instead. */}
      {part.state === 'output-error' && part.input === undefined && part.rawInput !== undefined && (
        <pre className="basalt-agent-tool-raw-input" style={CODE_BLOCK_STYLE}>
          {JSON.stringify(part.rawInput, null, 2)}
        </pre>
      )}
      {part.state === 'output-available' && (
        <pre className="basalt-agent-tool-output" style={CODE_BLOCK_STYLE}>
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
      {/* A failed or denied call must stay visible after the seven-state split — neither carries
          an `output`, so without this the call renders as name+input and nothing else. */}
      {part.state === 'output-error' && (
        <div className="basalt-agent-tool-error" role="alert" style={STATUS_LINE_STYLE}>
          {part.errorText}
        </div>
      )}
      {part.state === 'output-denied' && (
        <div className="basalt-agent-tool-denied" style={STATUS_LINE_STYLE}>
          Denied{part.approval.reason !== undefined ? `: ${part.approval.reason}` : ''}
        </div>
      )}
    </div>
  )
}

function DefaultSource({ part }: { part: SourcePart; index: number }): JSX.Element {
  return (
    <a
      className="basalt-agent-source"
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: VX.accent }}
    >
      {part.title ?? part.url}
    </a>
  )
}

function DefaultError({ part }: { part: ErrorPart; index: number }): JSX.Element {
  return (
    <div
      className="basalt-agent-error"
      role="alert"
      style={{
        backgroundColor: alpha(VX.status.bad, 0.13),
        color: VX.status.bad,
        borderRadius: 'var(--vx-radius-card)',
        padding: 'var(--vx-space-agent-error-inset-y) var(--vx-space-agent-error-inset-x)',
      }}
    >
      {part.message}
    </div>
  )
}

const DEFAULT_RENDERERS: AgentPartRenderers = {
  text: DefaultText,
  reasoning: DefaultReasoning,
  tool: DefaultToolCall,
  source: DefaultSource,
  error: DefaultError,
}

// ── PartList ──────────────────────────────────────────────────────────────────

export type PartListProps<TPart extends AgentPart = AgentPart> = {
  /** The parts accumulator from useAgentStream. */
  readonly parts: TPart[]
  /**
   * Override individual part renderers. Omitted keys fall back to the headless defaults.
   * Pass `{ text: ({ part, settled }) => <Markdown streaming={!settled} contentTrust="untrusted" density="chat">{part.text}</Markdown> }`
   * to enable rich markdown rendering.
   */
  readonly components?: Partial<AgentPartRenderers<TPart>>
  /**
   * `false` while the message these parts belong to is still streaming — forwarded to every
   * renderer so a text renderer can drop out of streaming mode (and a fenced mermaid/diagram can
   * upgrade) once the turn finishes. Defaults to `true`: a caller that knows nothing about a run
   * is rendering a finished list, and un-settled must be opted into by the thing that does know.
   */
  readonly settled?: boolean
}

/**
 * Renders a list of AgentPart values via an exhaustive switch over part.type.
 *
 * The `default: assertNever(part)` branch ensures that adding a new AgentPart variant is a tsc
 * error unless every switch consuming AgentPart is updated. Headless — zero Mantine imports.
 *
 * @example
 * import { PartList } from 'basalt-ui/agent'
 * <PartList parts={parts} />
 *
 * @example
 * // With basalt's own Markdown for the text renderer:
 * import { PartList } from 'basalt-ui/agent'
 * import { Markdown } from 'basalt-ui/content'
 * <PartList
 *   parts={parts}
 *   components={{
 *     text: ({ part, settled }) => (
 *       <Markdown streaming={!settled} contentTrust="untrusted" density="chat">{part.text}</Markdown>
 *     ),
 *   }}
 * />
 */
export function PartList<TPart extends AgentPart = AgentPart>({
  parts,
  components,
  settled = true,
}: PartListProps<TPart>): JSX.Element {
  // Memoised to avoid rebuilding the renderer map on every streaming re-render (hot path).
  // Cast required because DEFAULT_RENDERERS is typed for the base AgentPart, not the generic TPart.
  const renderers = useMemo(
    () => ({ ...DEFAULT_RENDERERS, ...components }) as AgentPartRenderers<TPart>,
    [components],
  )

  return (
    <Fragment>
      {parts.map((part, index) => {
        // The exhaustive switch: `default: assertNever(part)` is the tsc gate.
        // If a new AgentPart variant is added without a case here, tsc errors.
        switch (part.type) {
          case 'start':
            // Not renderable content — a no-op signal (run id + resume token).
            return null
          case 'text': {
            const Render = renderers.text
            return (
              <Fragment key={part.id}>
                <Render
                  part={part as Extract<TPart, { type: 'text' }>}
                  index={index}
                  settled={settled}
                />
              </Fragment>
            )
          }
          case 'reasoning': {
            const Render = renderers.reasoning
            return (
              <Fragment key={part.id}>
                <Render
                  part={part as Extract<TPart, { type: 'reasoning' }>}
                  index={index}
                  settled={settled}
                />
              </Fragment>
            )
          }
          case 'tool': {
            const Render = renderers.tool
            return (
              <Fragment key={part.id}>
                <Render
                  part={part as Extract<TPart, { type: 'tool' }>}
                  index={index}
                  settled={settled}
                />
              </Fragment>
            )
          }
          case 'source': {
            const Render = renderers.source
            return (
              <Fragment key={part.id}>
                <Render
                  part={part as Extract<TPart, { type: 'source' }>}
                  index={index}
                  settled={settled}
                />
              </Fragment>
            )
          }
          case 'error': {
            const Render = renderers.error
            return (
              <Fragment key={part.id}>
                <Render
                  part={part as Extract<TPart, { type: 'error' }>}
                  index={index}
                  settled={settled}
                />
              </Fragment>
            )
          }
          default:
            // This line is a tsc error if any AgentPart variant is unhandled above.
            return assertNever(part)
        }
      })}
    </Fragment>
  )
}
