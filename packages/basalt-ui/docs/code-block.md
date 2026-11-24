---
name: CodeBlock
use when: 'a fenced or standalone block of source or terminal output is shown, highlighted, with a copy button'
never when: 'the text is inline (use <code> in prose) or is a diagram (use a mermaid fence)'
subpath: basalt-ui/content
peers: ['@base-ui/react', '@shikijs/langs', '@shikijs/themes', pele, react-markdown, rehype-sanitize, remark-gfm, remend, shiki]
slots: [code-block]
---

# CodeBlock

A fenced code block: the source always on screen in a box that scrolls on its own, highlighted
with shiki once the block is settled and the language is known, plain otherwise (an unknown
language, a streaming tail, a shiki that fails to load). The highlight is part of the render: a
server render that waits for boundaries (a streaming render, Astro) ships the colored markup and
the client hydrates it as it is; `renderToString` cannot wait, so it ships the plain block and the
browser colors it. A block over 50 000 characters stays plain (the cost of coloring it is paid
on the server's thread). The copy button is hidden while the block is still streaming. The dark palette follows `[data-theme='dark']`.

## Signature

```ts
CodeBlock({ lang, code, settled }: CodeBlockProps): ReactElement
  lang?: string
  code: string
  settled?: boolean
```

`CodeBlockProps` import from `basalt-ui/content`: `import type { CodeBlockProps } from 'basalt-ui/content'`.

## Example

```tsx
<CodeBlock lang="ts" code={source} />
<CodeBlock lang="bash" code={partial} settled={false} />
```
