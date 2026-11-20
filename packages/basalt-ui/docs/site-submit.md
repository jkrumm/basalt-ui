---
name: SiteSubmit
use when: 'a `SiteForm` needs its one submit button'
never when: 'the button does not submit (use `Button` from `basalt-ui/ui/button` in an island)'
subpath: basalt-ui/static
peers: [react]
slots: [button]
---

# SiteSubmit

The submit button, in the primary look.

## Signature

```ts
SiteSubmit({ children, className, }: { children: Slot; className?: string; }): ReactElement
  children: ReactNode
  className?: string
```

## Example

```tsx
<SiteSubmit>Send</SiteSubmit>
```
