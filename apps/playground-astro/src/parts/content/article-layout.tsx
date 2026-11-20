import { ArticleLayout, Prose } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <ArticleLayout
      meta={{
        title: 'Reading run charts',
        description: 'How to read a week of training in one pass.',
        date: '2026-11-13',
        readingTime: 4,
      }}
      toc
      readingProgress
      next={{ label: 'Training load', href: '/guides/load' }}
    >
      <Prose>
        <h2 id="setup">Setup</h2>
        <p>Pick a window first, then read the bars left to right.</p>
        <h2 id="load">Training load</h2>
        <p>Volume rises by at most ten percent a week.</p>
      </Prose>
    </ArticleLayout>
  )
}
