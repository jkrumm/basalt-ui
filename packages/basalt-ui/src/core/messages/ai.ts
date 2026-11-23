import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./content` and `./ai` print themselves. `ai.copy` names a code block's copy button,
 * `ai.copied` is announced once it worked. `ai.toolRunning`, `ai.toolAwaitingApproval` and
 * `ai.toolDenied` are the status words of a tool row (pending and running share the first; done
 * and error print no word of their own). `ai.steps` labels a folded reasoning trace that used
 * tools: the tool count, then the seconds the turn took when this client watched it run;
 * `ai.reasoned` labels one that used none, and `ai.thinking` one still running.
 * `ai.blockUnavailable` is the quiet line a catalog `Block` prints in place of a spec it rejected or
 * a render that threw. The `ai.composer*` keys name the composer's controls, `ai.mentions` its
 * mention list, `ai.modelsSelected` the model picker's count footer, `ai.models` its trigger when several are chosen, and `ai.action*` the message
 * actions.
 */
export type AiMessages = Record<
  | 'ai.copy'
  | 'ai.copied'
  | 'ai.toolRunning'
  | 'ai.toolAwaitingApproval'
  | 'ai.toolDenied'
  | 'ai.blockUnavailable'
  | 'ai.thinking'
  | 'ai.composerSend'
  | 'ai.composerStop'
  | 'ai.composerAdd'
  | 'ai.composerAttach'
  | 'ai.composerMention'
  | 'ai.composerFiles'
  | 'ai.composerRemoveFile'
  | 'ai.mentions'
  | 'ai.modelSearch'
  | 'ai.actions'
  | 'ai.actionCopy'
  | 'ai.actionRegenerate'
  | 'ai.actionEdit'
  | 'ai.actionGood'
  | 'ai.actionBad',
  string
> &
  Record<'ai.steps', (f: Format, n: number, seconds?: number) => string> &
  Record<'ai.reasoned', (f: Format, seconds?: number) => string> &
  Record<'ai.modelsSelected' | 'ai.models', (f: Format, n: number) => string>

const took = (f: Format, seconds: number | undefined): string =>
  seconds === undefined ? '' : ` · ${f.number(seconds)} s`

export const ai = {
  'ai.copy': 'Copy',
  'ai.copied': 'Copied',
  'ai.toolRunning': 'Running',
  'ai.toolAwaitingApproval': 'Awaiting approval',
  'ai.toolDenied': 'Denied',
  'ai.blockUnavailable': 'This could not be displayed.',
  'ai.steps': (f, n, seconds) =>
    `${f.number(n)} ${f.plural(n) === 'one' ? 'tool' : 'tools'} used${took(f, seconds)}`,
  'ai.reasoned': (f, seconds) => `Reasoned${took(f, seconds)}`,
  'ai.thinking': 'Thinking',
  'ai.composerSend': 'Send',
  'ai.composerStop': 'Stop',
  'ai.composerAdd': 'Add',
  'ai.composerAttach': 'Attach files',
  'ai.composerMention': 'Mention',
  'ai.composerFiles': 'Attached files',
  'ai.composerRemoveFile': 'Remove',
  'ai.mentions': 'Mentions',
  'ai.modelSearch': 'Search models',
  'ai.modelsSelected': (f, n) =>
    `${f.number(n)} ${f.plural(n) === 'one' ? 'model' : 'models'} selected`,
  'ai.models': (f, n) => `${f.number(n)} ${f.plural(n) === 'one' ? 'model' : 'models'}`,
  'ai.actions': 'Message actions',
  'ai.actionCopy': 'Copy message',
  'ai.actionRegenerate': 'Regenerate',
  'ai.actionEdit': 'Edit',
  'ai.actionGood': 'Good response',
  'ai.actionBad': 'Bad response',
} satisfies Partial<BasaltMessages>
