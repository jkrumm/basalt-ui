/**
 * PartList — exhaustively renders a list of AgentPart values using an overridable renderer map.
 *
 * The exhaustive switch with a `default: assertNever(part)` case guarantees that adding a new
 * AgentPart variant without updating this file (or the consumer's override map) is a tsc error.
 *
 * All default renderers are headless — plain HTML elements with className hooks, zero Mantine.
 * Consumers can override any or all renderers via the `components` prop.
 *
 * The text renderer defaults to plain text (className="basalt-agent-text"). To use
 * StreamingMarkdown for rich markdown, pass a custom text renderer:
 *
 * @example
 * import { PartList, StreamingMarkdown } from 'basalt-ui/agent'
 *
 * <PartList
 *   parts={parts}
 *   components={{
 *     text: ({ part }) => <StreamingMarkdown>{part.text}</StreamingMarkdown>,
 *   }}
 * />
 */
import { Fragment, useMemo } from 'react'
import type { JSX } from 'react'
import { assertNever } from '../register'
import type {
  AgentPart,
  ErrorPart,
  ReasoningPart,
  SourcePart,
  TextPart,
  ToolCallPart,
} from './parts'

// ── Per-type renderer signatures ──────────────────────────────────────────────

export type TextPartRenderer<TPart extends AgentPart = AgentPart> = (props: {
  part: Extract<TPart, { type: 'text' }>
  index: number
}) => JSX.Element | null

export type ReasoningPartRenderer<TPart extends AgentPart = AgentPart> = (props: {
  part: Extract<TPart, { type: 'reasoning' }>
  index: number
}) => JSX.Element | null

export type ToolCallPartRenderer<TPart extends AgentPart = AgentPart> = (props: {
  part: Extract<TPart, { type: 'tool' }>
  index: number
}) => JSX.Element | null

export type SourcePartRenderer<TPart extends AgentPart = AgentPart> = (props: {
  part: Extract<TPart, { type: 'source' }>
  index: number
}) => JSX.Element | null

export type ErrorPartRenderer<TPart extends AgentPart = AgentPart> = (props: {
  part: Extract<TPart, { type: 'error' }>
  index: number
}) => JSX.Element | null

/**
 * Partial map of per-type renderers. Any omitted key falls back to the headless default.
 *
 * @example
 * const renderers: Partial<AgentPartRenderers> = {
 *   text: ({ part }) => <StreamingMarkdown>{part.text}</StreamingMarkdown>,
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

function DefaultText({ part }: { part: TextPart; index: number }): JSX.Element {
  return <div className="basalt-agent-text">{part.text}</div>
}

function DefaultReasoning({ part }: { part: ReasoningPart; index: number }): JSX.Element {
  return (
    <details className="basalt-agent-reasoning">
      <summary className="basalt-agent-reasoning-summary">Reasoning</summary>
      <div className="basalt-agent-reasoning-body">{part.text}</div>
    </details>
  )
}

function DefaultToolCall({ part }: { part: ToolCallPart; index: number }): JSX.Element {
  return (
    <div className="basalt-agent-tool">
      <span className="basalt-agent-tool-name">{part.toolName}</span>
      <pre className="basalt-agent-tool-input">{JSON.stringify(part.input, null, 2)}</pre>
      {part.output !== undefined && (
        <pre className="basalt-agent-tool-output">{JSON.stringify(part.output, null, 2)}</pre>
      )}
    </div>
  )
}

function DefaultSource({ part }: { part: SourcePart; index: number }): JSX.Element {
  return (
    <a className="basalt-agent-source" href={part.url} target="_blank" rel="noopener noreferrer">
      {part.title ?? part.url}
    </a>
  )
}

function DefaultError({ part }: { part: ErrorPart; index: number }): JSX.Element {
  return (
    <div className="basalt-agent-error" role="alert">
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
   * Pass `{ text: ({ part }) => <StreamingMarkdown>{part.text}</StreamingMarkdown> }` to
   * enable rich markdown rendering.
   */
  readonly components?: Partial<AgentPartRenderers<TPart>>
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
 * // With StreamingMarkdown for the text renderer:
 * import { PartList, StreamingMarkdown } from 'basalt-ui/agent'
 * <PartList parts={parts} components={{ text: ({ part }) => <StreamingMarkdown>{part.text}</StreamingMarkdown> }} />
 */
export function PartList<TPart extends AgentPart = AgentPart>({
  parts,
  components,
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
          case 'text': {
            const Render = renderers.text
            return (
              <Fragment key={index}>
                <Render part={part as Extract<TPart, { type: 'text' }>} index={index} />
              </Fragment>
            )
          }
          case 'reasoning': {
            const Render = renderers.reasoning
            return (
              <Fragment key={index}>
                <Render part={part as Extract<TPart, { type: 'reasoning' }>} index={index} />
              </Fragment>
            )
          }
          case 'tool': {
            const Render = renderers.tool
            return (
              <Fragment key={index}>
                <Render part={part as Extract<TPart, { type: 'tool' }>} index={index} />
              </Fragment>
            )
          }
          case 'source': {
            const Render = renderers.source
            return (
              <Fragment key={index}>
                <Render part={part as Extract<TPart, { type: 'source' }>} index={index} />
              </Fragment>
            )
          }
          case 'error': {
            const Render = renderers.error
            return (
              <Fragment key={index}>
                <Render part={part as Extract<TPart, { type: 'error' }>} index={index} />
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
