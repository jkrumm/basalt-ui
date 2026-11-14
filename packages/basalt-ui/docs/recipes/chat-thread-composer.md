---
name: chat-thread-composer
use-when: the message box of a chat thread: Enter sends, Shift+Enter and IME composition leave the draft, a failed send gives the text back
file: apps/playground/src/recipes/chat-thread-composer.tsx
---

Part of the `chat-thread` recipe: `MessageBox`, copied beside `chat-thread.tsx`.
Enter submits the form once (`requestSubmit`); Shift+Enter inserts a newline, and the Enter that confirms an IME candidate is left alone (`isComposing`).
The text clears at once. When `onSend` rejects it comes back, unless the user has typed something newer, which wins.
`busy` blocks a second send while a reply streams.

```tsx
import { Button } from 'basalt-ui/ui/button'
import { Textarea } from 'basalt-ui/ui/textarea'
import { useState } from 'react'

type Props = { busy: boolean; onSend: (text: string) => Promise<void> }

export function MessageBox({ busy, onSend }: Props) {
  const [draft, setDraft] = useState('')

  async function submit() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('') // optimistic clear; a failed send puts the text back
    await onSend(text).catch(() => setDraft((d) => d || text)) // a newer edit beats the stale restore
  }

  return (
    <form
      className="flex items-end gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Textarea
        aria-label="Message"
        value={draft}
        onValueChange={setDraft}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
          e.preventDefault() // Enter sends; Shift+Enter and an IME's Enter do not
          e.currentTarget.form?.requestSubmit()
        }}
      />
      <Button type="submit" disabled={busy}>
        Send
      </Button>
    </form>
  )
}
```
