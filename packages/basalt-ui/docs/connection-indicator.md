---
name: ConnectionIndicator
use when: 'a live surface shows whether its data is streaming, polling or cut off, in the end slot of the page bar'
never when: 'the verdict is about a record, not the connection (use `Status`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [connection-indicator]
---

# ConnectionIndicator

The state of the app's data connection: a glyph and a word (`Live`, `Polling`, `Reconnecting`,
`Offline`, `Signed out`), and a popover with the stream state, the age of the last event and the
age of the data. Below 840 px the word is read by assistive tech only and each state keeps its
own glyph (filled dot, ring, dashed ring, slashed circle, bang), so state is never colour alone;
the hit area is 44 px on a coarse pointer. A polite live region announces a state change, not the
age ticking. Hidden on paper.

## Signature

```ts
ConnectionIndicator({ connection, className, }: ConnectionIndicatorProps): ReactElement
  connection: ConnectionView
  className?: string
```
