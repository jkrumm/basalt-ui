---
name: useAppearance
use when: 'a part reads the reader''s appearance (a chart that thins its marks when comfortable, a summary line)'
never when: 'the value only styles: CSS reads the attribute itself (`[data-density=''normal''] &`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# useAppearance

What `<html>` wears now: the scheme (`auto` when none is chosen) and the density, frame and accent
the reader chose (absent: the app's default). It follows every writer: `setAppearance`,
`setScheme`, the boot script and another tab. The server renders nothing chosen.

## Signature

```ts
useAppearance(): AppearanceState
```

## Example

```tsx
const { scheme, accent } = useAppearance()
```
