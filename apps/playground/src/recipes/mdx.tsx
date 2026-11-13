// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:mdx
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
// #endregion
