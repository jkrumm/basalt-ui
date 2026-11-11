import type { BasaltMessages } from './index'

/** The strings `./content` and `./ai` print themselves; `ai.copy` names a code block's copy button. */
export type AiMessages = Record<'ai.copy', string>

export const ai = {
  'ai.copy': 'Copy',
} satisfies Partial<BasaltMessages>
