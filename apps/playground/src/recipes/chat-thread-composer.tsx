// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:chat-thread-composer
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
// #endregion
