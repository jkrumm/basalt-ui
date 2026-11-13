/**
 * `toolView`: one tool part of the wire (AI SDK 7 `tool-<name>` or `dynamic-tool`) as the six-state
 * `ToolView` the renderers read. Pure and total: a part with a state this version does not know, a
 * missing name or an `errorText` that is not text still yields a view, never a throw, because the
 * input is model-adjacent wire data.
 *
 * State map: `input-streaming` is pending; `input-available` and `approval-responded` are running
 * (the call is made or about to be); `approval-requested` is awaiting-approval; `output-available`
 * is done; `output-error` is error; `output-denied` is denied (a refusal, not a failure).
 */
import type { MessagePart, ToolView } from './contract'

/** The part types `toolView` reads: every `tool-<name>` and the dynamic tool. */
export type ToolPart = Extract<MessagePart, { type: `tool-${string}` } | { type: 'dynamic-tool' }>

const STATES: Readonly<Record<string, ToolView['state']>> = {
  'input-streaming': 'pending',
  'input-available': 'running',
  'approval-requested': 'awaiting-approval',
  'approval-responded': 'running',
  'output-available': 'done',
  'output-error': 'error',
  'output-denied': 'denied',
}

/** True for a tool part; the narrowing `partView` and callers share. */
export function isToolPart(part: MessagePart): part is ToolPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

function nameOf(part: ToolPart): string {
  if (part.type === 'dynamic-tool') {
    return typeof part.toolName === 'string' && part.toolName !== '' ? part.toolName : 'tool'
  }
  return part.type.slice('tool-'.length) || 'tool'
}

/**
 * The view of one tool part.
 *
 * @example
 * import { toolView } from 'basalt-ui/ai'
 *
 * const view = toolView({ type: 'tool-weather', toolCallId: 'c1', state: 'input-available', input: { city: 'Oslo' } })
 * // { state: 'running', name: 'weather', args: { city: 'Oslo' } }
 */
export function toolView(part: ToolPart): ToolView {
  // `Object.hasOwn`: a state named `constructor` or `toString` must not reach an inherited member.
  const state = Object.hasOwn(STATES, part.state) ? STATES[part.state] : undefined
  const view: ToolView = { state: state ?? 'pending', name: nameOf(part), args: part.input }
  if (view.state === 'done') view.result = part.output
  if (view.state === 'error' && typeof part.errorText === 'string') view.error = part.errorText
  return view
}
