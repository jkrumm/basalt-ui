---
name: Peek
use when: 'a plain click on a record link or a table row should show the record beside a list or a graph without leaving it (master-detail with the list kept live)'
never when: 'the choice is a yes or no (a `Dialog`), a form edited beside the page that should block it (a `Sheet`), or a page''s own inspector docked beside its content (`PageAside`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# Peek

A record's panel, non-modal and over the page it was opened from: the page underneath stays
mounted and live (no scrim, nothing inert), so its scroll, filters and selection are where they
were when the panel closes, and another link can be clicked to swap what it shows. Focus moves in
when it opens and back to the opener when it closes; Escape inside it closes it (in a field the
first Escape only leaves the field).

## Signature

```ts
Peek(props: PeekProps): ReactElement | null
  title: string  // The accessible name and the visible heading: what is shown (`Issue 12`)
  tag?: string  // A short mono tag before the title (`#12`), for what the heading does not say
  icon?: IconComponent  // A glyph before the title, for what kind of record it is
  avatar?: AvatarEntry  // A face before the title, for a person or an object; wins over `icon`
  kind?: string  // The record kind (`issue`): its presentation, its side width and its window's size are remembered on the device per kind
  defaultPresent?: "page" | "peek" | "window"  // How a kind opens until the reader picks another in `Open as`: a form that is written in one go (a mail composer) opens as a `window`
  fullPage?: string | NavTarget  // The record's own page
  favorite?: FavoriteInput  // Draws a star in the header that adds the record to the shell rail's Favorites; nothing outside an `AppShell` or on a phone, where the rail is not drawn
  onClose: () => void  // Escape, the close button and Back: the caller decides how the address changes (`usePeek().close`)
  onPin?: () => void  // Draws a button that moves the record into the shell's `Dock` (`usePeek().pin`)
  actions?: PanelActions  // The record's own actions, data like `PageBar` actions: the first two in the header, the rest in its More menu (a third alone stays inline)
  records?: RecordSequence  // The opener's records in its order (`usePeek().go` or a table's rows): draws previous and next, disabled at the ends, and ArrowUp and ArrowDown on the panel step through them in place
  footer?: ReactNode  // A band under the body for a form's actions
  defaultWidth?: number  // The width in px the side panel opens at, from where the app saved it; else the width the reader last dragged this kind to; else the default tiers
  onWidthChange?: (px: number | null) => void  // The width in px once the user released the pointer or pressed a key on the handle, `null` once Enter or a double click put it back at the default
  children?: ReactNode
```

`FavoriteInput`, `PeekProps` import from `basalt-ui/page`: `import type { FavoriteInput, PeekProps } from 'basalt-ui/page'`.

`IconComponent`, `NavTarget`, `RecordSequence` import from `basalt-ui`: `import type { IconComponent, NavTarget, RecordSequence } from 'basalt-ui'`.

## Example

```tsx
const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
{peek.open && (
  <Peek
    kind="issue"
    title={`Issue ${peek.open.id}`}
    fullPage={peek.fullPage ?? undefined}
    records={{ ids: issueIds, id: peek.open.id, onStep: peek.go }}
    onClose={peek.close}
  >
    <IssueView id={peek.open.id} />
  </Peek>
)}
```
