---
name: Peek
use when: 'a plain click on a record link should show the record beside a list or a graph without leaving it (master-detail with the list kept live)'
never when: 'the choice is a yes or no (a `Dialog`), a form edited beside the page that should block it (a `Sheet`), or a page''s own inspector docked beside its content (`PageAside`)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [peek]
---

# Peek

A right-side panel (a non-modal `<dialog open>`) over the page it was opened from, for a record: the page underneath stays
mounted, so its scroll, filters and selection are where they were when the panel closes. It is
not modal (no scrim, nothing inert), so another link can be clicked to swap what it shows. Under
an `AppShell` it sits over main between the header and the footer and does not scroll with the
page; without one it is a block in flow. Focus moves in when it opens and back to the opener
when it closes. `onPin` adds a button that moves the record into the shell's `Dock`. It draws no address and binds no keys: `usePeek` from `basalt-ui/router` owns
the `?peek=` address, the click handler, history and Escape, and hands this panel its `onClose`.

## Signature

```ts
Peek({ title, tag, fullPage, onClose, onPin, children, }: PeekProps): ReactElement | null
  title: string  // The accessible name and the visible heading: what is shown (`Issue 12`)
  tag?: string  // A short mono tag before the title (`#12`), for what the heading does not say
  fullPage?: string | NavTarget  // The record's own page
  onClose: () => void  // Escape, the close button and Back: the caller decides how the address changes (`usePeek().close`)
  onPin?: () => void  // Draws a button that moves the record into the shell's `Dock` (`usePeek().pin`)
  children?: ReactNode
```

## Example

```tsx
const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
{peek.open && (
  <Peek title={`Issue ${peek.open.id}`} fullPage={peek.fullPage ?? undefined} onClose={peek.close}>
    <IssueView id={peek.open.id} />
  </Peek>
)}
```
