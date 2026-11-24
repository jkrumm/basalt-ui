/**
 * `CodeBlock` on the server (Issue 2604): the highlighted markup is in the HTML a static page ships,
 * and the client hydrates it without a mismatch. The highlight is warmed first and the tree rendered
 * with `renderToString`, as `markdown-ssr.test.tsx` does: a host that streams (Astro's React renderer
 * awaits `allReady`) waits for the same promise, which `make astro-matrix` proves end to end. An async
 * server render in this process leaves React's context renderer set and fails every later hydration
 * test with "multiple renderers", so it is not used here.
 */
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { CodeBlock } from './code-block'
import { getHighlight } from './highlighter'
import { Markdown } from './markdown'

const SHIKI_SPAN = /<span style="--shiki-light:#[0-9a-f]+;--shiki-dark:#[0-9a-f]+/i

describe('CodeBlock server render', () => {
  test('a known language ships its highlighted spans', async () => {
    await getHighlight('const a: number = 1', 'ts').promise
    const html = renderToString(<CodeBlock lang="ts" code="const a: number = 1" />)
    expect(html).toMatch(SHIKI_SPAN)
    expect(html).toContain('class="shiki')
    expect(html).not.toContain('<template')
    expect(html).not.toContain('<!--$!-->')
  })

  test('a cold renderToString (no Suspense support) ships the plain block for the client to color', () => {
    const html = renderToString(<CodeBlock lang="ts" code="const cold = 0" />)
    expect(html).toContain('<code>const cold = 0</code>')
    expect(html).not.toContain('--shiki-')
  })

  test('an unknown language ships the plain block', () => {
    const html = renderToString(<CodeBlock lang="cobol" code="DISPLAY 'HI'" />)
    expect(html).not.toContain('--shiki-')
    expect(html).toContain('<pre tabindex="0"')
  })

  test('a streaming block ships plain even where its source is highlighted', async () => {
    await getHighlight('const b = 2', 'ts').promise
    const html = renderToString(<CodeBlock lang="ts" code="const b = 2" settled={false} />)
    expect(html).not.toContain('--shiki-')
    expect(html).toContain('const b = 2')
  })

  test('a source over the size budget ships plain and is never highlighted', async () => {
    const code = 'const x = 1\n'.repeat(5000)
    await getHighlight(code, 'ts').promise
    const html = renderToString(<CodeBlock lang="ts" code={code} />)
    expect(html).not.toContain('--shiki-')
    expect(html).toContain('<pre tabindex="0"')
  })

  test('a Markdown fence ships highlighted too', async () => {
    await getHighlight('const c = 3', 'ts').promise
    const html = renderToString(
      <Markdown contentTrust="untrusted">{'Text\n\n```ts\nconst c = 3\n```\n'}</Markdown>,
    )
    expect(html).toMatch(SHIKI_SPAN)
  })
})

describe('CodeBlock hydration', () => {
  const recovered: unknown[] = []
  let errors: ReturnType<typeof spyOn<Console, 'error'>>
  beforeEach(() => {
    recovered.length = 0
    errors = spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    errors.mockRestore()
    document.body.innerHTML = ''
  })

  test('the server markup hydrates with no mismatch and is kept as it is', async () => {
    await getHighlight("const d: string = 'x'", 'ts').promise
    const tree = <CodeBlock lang="ts" code="const d: string = 'x'" />
    const container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = renderToString(tree)
    const before = container.innerHTML
    expect(before).toMatch(SHIKI_SPAN)

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: (error) => recovered.push(error) })
    })

    expect(errors).not.toHaveBeenCalled()
    expect(recovered).toEqual([])
    expect(container.innerHTML).toBe(before)
  })

  test('a cold browser cache keeps the server markup while it waits, then hydrates it unchanged', async () => {
    const code = "const e: string = 'cold'"
    const highlight = getHighlight(code, 'ts')
    await highlight.promise
    const tree = <CodeBlock lang="ts" code={code} />
    const container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = renderToString(tree)
    const before = container.innerHTML
    // What a fresh page has: the server's markup, and no highlight in the cache.
    for (let n = 0; n <= 25; n++) await getHighlight(String(n).padEnd(49_000, 'x'), 'cobol').promise
    expect(getHighlight(code, 'ts')).not.toBe(highlight)

    act(() => {
      hydrateRoot(container, tree, { onRecoverableError: (error) => recovered.push(error) })
    })
    expect(container.innerHTML).toBe(before)

    await act(async () => {
      await getHighlight(code, 'ts').promise
    })
    // React's own note that the sync `act` above held a suspended boundary is the one expected message.
    const unexpected = errors.mock.calls.filter(
      (call) => !String(call[0]).includes('suspended inside an `act` scope'),
    )
    expect(unexpected).toEqual([])
    expect(recovered).toEqual([])
    expect(container.innerHTML).toBe(before)
  })
})
