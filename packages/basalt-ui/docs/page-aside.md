---
name: PageAside
use when: 'a screen inspects or edits one record beside its list, or shows the detail of a record without leaving the page'
never when: 'the panel holds page-wide filters (use the PageBar controls) or two panels are needed (one aside per page)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# PageAside

The page's second surface: an inspector or detail panel beside the content. `title` is required
and is both the header and the landmark's `aria-label`. One per page; a second raises a dev
warning and the newest owns the region. An inspector's body of properties is a `Facts` list, and
the record it inspects is a string field passed as `state`.

## Signature

```ts
PageAside(props: PageAsideProps): ReactElement | null
  title: string  // Header and `aria-label`; required
  width?: number
  state?: ControlHandle<boolean> | ControlHandle<string>  // Open state, device or URL lane
  dock?: "auto" | "always"
  mobile?: "sheet"
  children?: ReactNode
```

## Example

```tsx
<PageAside title="Run details" width={360} state={store.field.run} mobile="sheet">
  <Facts rows={[{ label: 'Version', value: run.version }]} />
</PageAside>
```
