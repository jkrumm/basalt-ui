---
name: Callout
use when: 'an article or reply carries a note, tip, warning or error beside its prose'
never when: 'the message is about the state of the page or a form (use Alert directly)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# Callout

A tinted note inside an article, keyed to a semantic kind. A thin mapping onto `Alert`: the kind
is the tone, `title` is the alert's title. Without a title the kind is named in a screen-reader
word instead. The 2.x `icon` prop is gone; the glyph follows the kind.

## Signature

```ts
Callout({ kind, title, className, children }: CalloutProps): ReactElement
  kind?: CalloutKind  // Semantic kind: drives the tint, the glyph and the announcement
  title?: string
  className?: string  // Layout only (`my-6`)
  children: ReactNode
```

## Example

```tsx
<Callout kind="warn" title="Heads up">
  <p>This endpoint is rate-limited to 60 requests/minute.</p>
</Callout>
```
