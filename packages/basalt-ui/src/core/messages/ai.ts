import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./content` and `./ai` print themselves. `ai.copy` names a code block's copy button,
 * `ai.copied` is announced once it worked. `ai.toolRunning`, `ai.toolAwaitingApproval` and
 * `ai.toolDenied` are the status words of a tool row (pending and running share the first; done
 * and error print no word of their own). `ai.steps` labels the folded tool rail: the step count,
 * then the seconds the turn took when this client watched it run. `ai.blockUnavailable` is the
 * quiet line a catalog `Block` prints in place of a spec it rejected or a render that threw.
 */
export type AiMessages = Record<
  | 'ai.copy'
  | 'ai.copied'
  | 'ai.toolRunning'
  | 'ai.toolAwaitingApproval'
  | 'ai.toolDenied'
  | 'ai.blockUnavailable',
  string
> &
  Record<'ai.steps', (f: Format, n: number, seconds?: number) => string>

export const ai = {
  'ai.copy': 'Copy',
  'ai.copied': 'Copied',
  'ai.toolRunning': 'Running',
  'ai.toolAwaitingApproval': 'Awaiting approval',
  'ai.toolDenied': 'Denied',
  'ai.blockUnavailable': 'This could not be displayed.',
  'ai.steps': (f, n, seconds) =>
    `${f.number(n)} ${f.plural(n) === 'one' ? 'step' : 'steps'}${seconds === undefined ? '' : ` · ${f.number(seconds)} s`}`,
} satisfies Partial<BasaltMessages>
