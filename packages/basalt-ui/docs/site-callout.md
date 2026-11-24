---
name: SiteCallout
use when: 'an article carries a tip, a warning or a caveat beside its text'
never when: 'the message is about the state of an app screen (use `Alert`)'
subpath: basalt-ui/static
peers: [react]
slots: [callout]
---

# SiteCallout

A tinted note beside the prose: an `aside` with the `Alert` tint of its tone. Static content is
never announced, so it carries no live role. With no `title`, `toneLabel` names the kind of note
for a screen reader; both are the consumer's words.

## Signature

```ts
SiteCallout({ tone, title, toneLabel, children, className, }: SiteCalloutProps): ReactElement
  tone?: Tone  // The tint and the glyph color
  title?: string  // The visible headline
  toneLabel?: string  // What the note is, for a screen reader when there is no title ("Warning")
  children: ReactNode
  className?: string
```

`Tone` import from `basalt-ui/cards`: `import type { Tone } from 'basalt-ui/cards'`.

`SiteCalloutProps` import from `basalt-ui/static`: `import type { SiteCalloutProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteCallout tone="warn" title="Rate limited">60 requests a minute.</SiteCallout>
```
