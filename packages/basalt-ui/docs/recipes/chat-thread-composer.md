---
name: chat-thread-composer
use-when: wiring the Composer to a chat: mentions sent as ids beside the text, files and a model choice
---

`Composer` from `basalt-ui/ai` owns the box: Enter sends, Shift+Enter breaks, an IME's Enter never sends, a throw or rejection from `onSend` gives the draft back, and `status` turns send into stop. This note is the wiring only.
A mention comes back as data, `{ value, label, start, end }` in the sent text: pass the values on as metadata the server resolves, never parse `@` back out of the text.
`mentions.source` takes grouped options or a loader `(query, { signal })`; the list asks it on every keystroke after `@` and drops a late answer.
`files` turns on attachments through `FileUpload` in the add menu; `model` puts a `ModelPicker` in the footer (`multiple` adds a count footer).

```tsx
import { Composer } from 'basalt-ui/ai'
import type { ComposerMessage, ComposerStatus } from 'basalt-ui/ai'
import type { ListLoader } from 'basalt-ui/ui/combobox'

type Doc = { id: string; title: string }
type Send = (message: { text: string; metadata: { docs: string[] } }) => Promise<void>
type Props = { status: ComposerStatus; stop: () => void; send: Send; docs: ListLoader<Doc> }

/** The mentions travel beside the text as ids the server resolves, never parsed back out of it. */
export function ChatComposer({ status, stop, send, docs }: Props) {
  const onSend = ({ text, mentions }: ComposerMessage<Doc>) =>
    send({ text, metadata: { docs: mentions.map((m) => m.value.id) } })
  return (
    <Composer<Doc>
      aria-label="Message"
      status={status}
      onStop={stop}
      onSend={onSend}
      mentions={{ source: docs }}
      files={{ accept: 'image/*,.pdf', maxSize: 10_000_000 }}
      model={{
        'aria-label': 'Model',
        options: [
          { value: 'fast', label: 'Fast' },
          { value: 'deep', label: 'Deep' },
        ],
        defaultValue: 'fast',
      }}
    />
  )
}
```
