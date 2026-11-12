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
warning and the newest owns the region.

## Signature

```ts
PageAside(props: PageAsideProps): ReactElement | null
  title: string
  width?: number
  state?: ControlHandle<boolean>
  dock?: "auto" | "always"
  mobile?: "sheet"
  children?: ReactNode
```
