---
name: InfoHint
use when: 'one word or number in a header, a sentence, a toolbar or a label needs its definition one press away'
never when: 'the word is in a glossary (use the `InfoHint` from `defineGlossary`), or the definition is the card''s own (use `info` on the card)'
subpath: basalt-ui/ui/info-hint
peers: ['@base-ui/react']
slots: [info-hint]
---

# InfoHint

A small info glyph beside a word or number, with its definition in a popover: it opens on hover
after 150 ms, on Enter or Space when focused and on a press (touch), and closes on Escape, an
outside press or blur. The glyph is named `What <label> means`. For a word a glossary defines,
use the `InfoHint` that `defineGlossary` returns: its text is never retyped.

## Props

### `InfoHint`

```ts
InfoHint({ label, children, className }: InfoHintProps): ReactElement
  className?: string  // Layout only (`-my-0.5`)
  label: string  // The popover's title and the glyph's name (`What <label> means`): the word being explained
  children: ReactNode  // The explanation
```

## Slots

- `info-hint`
