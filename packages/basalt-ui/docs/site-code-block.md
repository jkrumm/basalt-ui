---
name: SiteCodeBlock
use when: 'an article shows source a reader will paste'
never when: 'the code streams in from a model (use `CodeBlock` from `basalt-ui/content`)'
subpath: basalt-ui/static
peers: [react]
slots: [code-block]
---

# SiteCodeBlock

A code block with a copy button. Highlighting stays with the host's toolchain: pass the `<pre>`
it rendered as `children`, and the prose sheet styles it by element. The button is plain
markup; `siteScript()` copies the block's text, flips the glyph for a moment and announces
`copiedLabel`. Without the script the block stays selectable.

## Signature

```ts
SiteCodeBlock({ children, copyLabel, copiedLabel, caption, className, }: SiteCodeBlockProps): ReactElement
  children: ReactNode  // The block itself: a `<pre>` your toolchain rendered (Astro's Shiki, an MDX `pre`), or plain text
  copyLabel: string  // The copy button's accessible name ("Copy code")
  copiedLabel: string  // Announced once the copy succeeded ("Copied")
  caption?: ReactNode  // A caption above the block: a file name, a language
  className?: string
```

`SiteCodeBlockProps` import from `basalt-ui/static`: `import type { SiteCodeBlockProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteCodeBlock copyLabel="Copy code" copiedLabel="Copied"><pre><code>bun add basalt-ui</code></pre></SiteCodeBlock>
```
