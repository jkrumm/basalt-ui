/**
 * Content: an authored MDX article compiled at build time (vite.config.ts) and rendered through
 * `mdxComponents` inside `ArticleLayout`, which collects the on-this-page rail from its headings.
 */
import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from 'basalt-ui/content'
import { ArticleLayout, Page, mdxComponents } from 'basalt-ui/page'
import type { ComponentProps, ReactElement } from 'react'
import Article from '../../demo/content-article.mdx'

/** MDX hands `pre` a `<code>` element; `CodeBlock` takes the language and the text. */
function Pre({ children }: { children?: ReactElement<ComponentProps<'code'>> }): ReactElement {
  const { className = '', children: code = '' } = children?.props ?? {}
  return <CodeBlock lang={className.replace('language-', '')} code={String(code).trimEnd()} />
}

function ContentRoute(): ReactElement {
  return (
    <Page area="kit-content">
      <ArticleLayout
        meta={{
          title: 'Ship a page',
          description: 'From the question to the frames, in four steps.',
          date: '2026-11-24',
          readingTime: 3,
        }}
        toc
        prev={{ label: 'Charts', href: '/charts' }}
        next={{ label: 'States', href: '/kit/states' }}
      >
        <Article components={{ ...mdxComponents, pre: Pre }} />
      </ArticleLayout>
    </Page>
  )
}

export const Route = createFileRoute('/kit/content')({
  staticData: { title: 'Content' },
  component: ContentRoute,
})
