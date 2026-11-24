---
name: Callout
use when: 'an article or reply carries a note, tip, warning or error beside its prose'
never when: 'the message is about the state of the page or a form (use Alert directly)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# Callout

A tinted note inside an article, keyed to a semantic tone. A thin mapping onto `Alert`: `tone`
is the alert's tone, `title` is its title. Without a title the tone is named in a screen-reader
word instead (`neutral` and `accent` are plain notes and take none). The 2.x `icon` prop is gone;
the glyph follows the tone.

## Signature

```ts
Callout({ tone, kind, title, className, children }: CalloutProps): ReactElement
  tone?: Tone  // Semantic tone, the values of `Alert`: drives the tint, the glyph and the announcement
  title?: string
  className?: string  // Layout only (`my-6`)
  children: ReactNode
```

`Tone` import from `basalt-ui/cards`: `import type { Tone } from 'basalt-ui/cards'`.

## Example

```tsx
<Callout tone="warn" title="Heads up">
  <p>This endpoint is rate-limited to 60 requests/minute.</p>
</Callout>
```
