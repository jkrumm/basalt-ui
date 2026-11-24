---
name: Dock
use when: 'a record chosen from a list should stay open beside the screen while the reader keeps working in it, on any page'
never when: 'the record is a page''s own inspector (`PageAside`), the choice is a quick look that should vanish (`Peek`), or the form must block the page (`Sheet`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [dock]
---

# Dock

A record panel that belongs to the shell, not to a page: it sits at the end edge beside main
and pushes it (main reflows, with a short slide) while there is room for `MAIN_MIN_WIDTH` of
main; with no room, and on a phone, it is the same panel over main, as a `Peek` is. It stays
through route changes, and mounting it at the app root keyed to a URL field is what makes it
global. Mount one at a time: two would stack. An overlaid one covers a docked `PageAside`, as a
`Peek` does. Not modal: nothing is inert and
Escape inside the panel closes it. Focus moves in when it mounts and back to the opener when it
unmounts. A handle on its start edge resizes it (pointer, ArrowLeft and ArrowRight, Enter or a
double click to reset), the device remembers the width, and a docked one pushes main by that
width. It draws the one panel anatomy `Peek` and `PageAside` share. Without a shell it is a block in flow. `usePeek({ dockField })` from `basalt-ui/router`
owns the `?dock=` address, the click that swaps its record and the pin from a `Peek`.

## Signature

```ts
Dock({ title, tag, fullPage, favorite, onClose, icon, avatar, actions, records, footer, present, children, }: DockProps): ReactElement | null
  title: string  // The accessible name and the visible heading: what is shown (`Issue 12`)
  tag?: string  // A short mono tag before the title (`#12`), for what the heading does not say
  fullPage?: string | NavTarget  // The record's own page
  favorite?: FavoriteInput  // Draws a star in the header that adds the record to the shell rail's Favorites; nothing outside an `AppShell` or on a phone, where the rail is not drawn
  onClose: () => void  // The close button and Escape inside the panel: the caller decides how the address changes (`usePeek().dock.close`)
  icon?: IconComponent  // A glyph before the title, for what kind of record it is
  avatar?: AvatarEntry  // A face before the title, for a person or an object; wins over `icon`
  actions?: PanelActions  // The record's own actions, data like `PageBar` actions: the first two in the header, the rest in its More menu (a third alone stays inline)
  records?: RecordSequence  // The opener's records: previous and next in the header, ArrowUp and ArrowDown on the panel
  footer?: ReactNode  // A band under the body for a form's actions
  present?: OverlayPresent  // How the panel opens: `auto` is a bottom sheet that rests at half height and drags to full on a phone (compact width, coarse pointer), the side panel elsewhere; `popup` and `sheet` force one
  children?: ReactNode
```

`DockProps`, `FavoriteInput` import from `basalt-ui/page`: `import type { DockProps, FavoriteInput } from 'basalt-ui/page'`.

`IconComponent`, `NavTarget`, `RecordSequence` import from `basalt-ui`: `import type { IconComponent, NavTarget, RecordSequence } from 'basalt-ui'`.

## Example

```tsx
const peek = usePeek({ field: globals.field.peek, dockField: globals.field.dock, kinds: { issue: '/issues/$id' } })
{peek.dock.open && (
  <Dock title={`Issue ${peek.dock.open.id}`} fullPage={peek.dock.fullPage ?? undefined} onClose={peek.dock.close}>
    <IssueView id={peek.dock.open.id} />
  </Dock>
)}
```
