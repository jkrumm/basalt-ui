---
name: MailThread
use when: 'a reader shows one mail conversation, or any thread of long messages where one is read at a time'
never when: 'short chat messages that are all read at once (use the chat parts'' Message), or a feed of events (use EventList)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [mail-message, mail-thread, mail-thread-reply]
---

# MailThread

A conversation in a reader: one bordered column of messages, oldest first. A message that is not
open is one row of face, sender, a line of its text and its day; opening one closes the one that
was open, and the latest is open at first. The open message shows the sender's address, who it
went to, the full time, the body with its line breaks and the attachments as file cards with a
download. `reply` sits under the thread's card: the reply buttons, or an inline
composer once the reader replies.

## Signature

```ts
MailThread({ label, messages, defaultOpen, reply }: MailThreadProps): ReactElement
  label: string  // Names the thread for assistive tech: the subject
  messages: readonly MailMessage[]  // Oldest first
  defaultOpen?: string  // The message open at first
  reply?: ReactNode  // The reply under the thread's card: the reply buttons, or an open composer
```

`MailMessage`, `MailThreadProps` import from `basalt-ui/cards`: `import type { MailMessage, MailThreadProps } from 'basalt-ui/cards'`.

## Example

```tsx
<MailThread label={thread.subject} messages={thread.messages} reply={<ReplyBar />} />
```
