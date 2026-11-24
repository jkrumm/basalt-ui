---
name: Fact
use when: 'a card footer states a fact beside its figure: a source, a time, an id'
never when: 'the text is the card''s headline figure or a sentence (use `value` or `sub`)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# Fact

One labelled fact in a footer. `value` is data, never a node, so every card formats alike.

## Signature

```ts
type Fact = {
  label: string
  value: string | number
  /** The value is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
}
```

## Example

```tsx
{ label: 'Updated', value: '14:02', mono: true }
```
