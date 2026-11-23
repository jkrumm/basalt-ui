import { createFileRoute } from '@tanstack/react-router'
import { defineControls, field } from 'basalt-ui/router'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { Assistant } from '../../../../../packages/basalt-ui/blocks/assistant/Assistant'
import type { Turn } from '../../../../../packages/basalt-ui/blocks/assistant/model'
import { MODELS, TURNS, mentionLoader } from '../../demo/ref-assistant'

/** `?draft=` opens the composer with a draft: `?draft=Ask @nord` shows the mention list open. */
const assistantControls = defineControls({
  id: 'ref-assistant',
  scope: 'page',
  fields: { draft: field.string('') },
})

let turnId = 100

function AssistantRoute(): ReactElement {
  const { draft } = assistantControls.useValues()
  const [turns, setTurns] = useState<readonly Turn[]>(TURNS)
  return (
    <Assistant
      turns={turns}
      status="ready"
      draft={draft}
      mentions={mentionLoader}
      models={MODELS}
      onStop={() => undefined}
      onNew={() => setTurns([])}
      onRegenerate={() => undefined}
      onDecide={() => undefined}
      onSend={({ text }) => {
        turnId += 2
        setTurns((before) => [
          ...before,
          { id: `t${turnId}`, from: 'user', parts: [{ type: 'text', text }] },
          {
            id: `t${turnId + 1}`,
            from: 'assistant',
            parts: [
              {
                type: 'text',
                text: 'This reference page has no model behind it: the reply is fixed.',
              },
            ],
          },
        ])
      }}
    />
  )
}

export const Route = createFileRoute('/ref/assistant')({
  staticData: { title: 'Assistant' },
  validateSearch: assistantControls.validateSearch,
  search: { middlewares: assistantControls.middlewares },
  component: AssistantRoute,
})
