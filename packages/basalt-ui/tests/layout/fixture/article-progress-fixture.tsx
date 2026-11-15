/** `ArticleProgress` over a tall column: the URL hash is `window` or `port`, plus `-target`. */
import { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { ArticleProgress } from '../../../src/page/article-progress'

function Column({ tracked }: { tracked: boolean }) {
  const articleRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div style={{ height: 300 }} />
      <div ref={articleRef} style={{ height: 2000 }} />
      <div style={{ height: 200 }} />
      <ArticleProgress {...(tracked && { target: articleRef })} />
    </>
  )
}

function Fixture() {
  const [scroller, ...rest] = window.location.hash.slice(1).split('-')
  const column = <Column tracked={rest.includes('target')} />
  if (scroller === 'window') return column
  return (
    // oxlint-disable-next-line basalt/raw-scroll-container -- a bare scrollport stands in for the shell's main region
    <div data-basalt-scrollport style={{ height: 600, overflowY: 'auto' }} id="port">
      {column}
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
