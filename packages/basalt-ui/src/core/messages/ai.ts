import type { BasaltMessages } from './index'

/** The strings `./content` and `./ai` print themselves; `ai.copy` names a code block's copy button, `ai.copied` is announced once it worked. */
export type AiMessages = Record<'ai.copy' | 'ai.copied', string>

export const ai = {
  'ai.copy': 'Copy',
  'ai.copied': 'Copied',
} satisfies Partial<BasaltMessages>
