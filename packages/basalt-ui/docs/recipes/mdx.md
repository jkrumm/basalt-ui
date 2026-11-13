---
name: mdx
use-when: render authored MDX with the same look as `Prose`, and block unsafe links
file: apps/playground/src/recipes/mdx.tsx
---

Your toolchain compiles the MDX (Astro, `@mdx-js/rollup`, Next); basalt ships only the component map. `mdxComponents` covers `h2`-`h4` with anchors, `a`, `table`, `blockquote`, `Callout`, `Steps`/`Step`, `Tabs`/`Tab`, `Figure` and `Kbd`.

- Wrap the page in `Prose`; the map needs no markdown peer.
- A link the url policy blocks (`//host`, `javascript:`) renders with no `href`.
- `pre` is yours: MDX passes a `<code>` element, so the adapter below hands `CodeBlock` its language and text.
- Keep two identical headings apart with `rehype-slug`; the map keeps an id the compiler set.
- MDX is code. Never compile model output and never use `evaluate`; the `untrusted-markdown` rule bans it.

```tsx
import { CodeBlock } from 'basalt-ui/content'
import { Prose, mdxComponents } from 'basalt-ui/page'
import type { ComponentProps, ComponentType, ReactElement } from 'react'

// MDX hands `pre` a `<code>` element; `CodeBlock` takes the language and the text.
function Pre({ children }: { children?: ReactElement<ComponentProps<'code'>> }) {
  const { className = '', children: code = '' } = children?.props ?? {}
  return <CodeBlock lang={className.replace('language-', '')} code={String(code).trimEnd()} />
}

/** `Content` is the module your MDX toolchain compiled; this file never evaluates MDX text. */
export function Post({ Content }: { Content: ComponentType<{ components?: object }> }) {
  return (
    <Prose>
      <Content components={{ ...mdxComponents, pre: Pre }} />
    </Prose>
  )
}
```
