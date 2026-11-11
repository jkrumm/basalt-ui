/**
 * The fence registry (docs/v3/concepts/ai-mdx.md C12): a renderer returning `undefined` declines
 * and the block shows as code, `null` renders nothing, a throw (from the function or from what it
 * returns) leaves the block's text on screen, the language lookup reads own keys only, and
 * `settledOnly` is a pure function of `settled`. Also through the `pre` component react-markdown
 * calls, fed a real hast node.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import type { Element } from 'hast'
import { Fence, FenceSettled, createFencePre, settledOnly } from './fences'
import type { FenceRenderers } from './fences'

afterEach(cleanup)

let warn: ReturnType<typeof spyOn>
beforeEach(() => {
  warn = spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => warn.mockRestore())

const preOf = (container: HTMLElement): HTMLPreElement | null => container.querySelector('pre')

describe('Fence — registry results', () => {
  test('a consumer renderer for the language wins', () => {
    const renderers: FenceRenderers = { card: ({ code }) => <aside>card:{code}</aside> }
    render(<Fence lang="card" code="hello" renderers={renderers} />)
    expect(screen.getByText('card:hello')).toBeDefined()
  })

  test('undefined declines: the block shows as code', () => {
    const renderers: FenceRenderers = { vega: () => undefined }
    const { container } = render(<Fence lang="vega" code="{}" renderers={renderers} />)
    expect(preOf(container)?.textContent).toBe('{}')
  })

  test('null renders nothing, not the code', () => {
    const renderers: FenceRenderers = { hidden: () => null }
    const { container } = render(<Fence lang="hidden" code="secret" renderers={renderers} />)
    expect(container.textContent).toBe('')
    expect(preOf(container)).toBeNull()
  })

  test('no language is a plain code block', () => {
    const { container } = render(<Fence code="plain" />)
    expect(preOf(container)?.textContent).toBe('plain')
  })

  test('the renderer receives code, lang and settled', () => {
    const seen: unknown[] = []
    const renderers: FenceRenderers = {
      probe: (p) => {
        seen.push(p)
        return <i>ok</i>
      },
    }
    render(<Fence lang="probe" code="x" settled={false} renderers={renderers} />)
    expect(seen).toEqual([{ code: 'x', lang: 'probe', settled: false }])
  })
})

describe('Fence — own-property lookup', () => {
  test.each(['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    'language %s never reaches a renderer and the block shows as code',
    (lang) => {
      const calls: string[] = []
      const renderers: FenceRenderers = Object.assign(Object.create(null) as FenceRenderers, {
        ok: () => {
          calls.push('ok')
          return <i />
        },
      })
      const plain: FenceRenderers = { ok: () => <i /> }
      for (const registry of [renderers, plain, {}]) {
        const { container, unmount } = render(
          <Fence lang={lang} code="body text" renderers={registry} />,
        )
        expect(preOf(container)?.textContent).toBe('body text')
        unmount()
      }
      expect(calls).toEqual([])
    },
  )

  test('an own __proto__ key in a consumer literal is not a renderer either', () => {
    const renderers = JSON.parse('{"__proto__": 1}') as FenceRenderers
    const { container } = render(<Fence lang="__proto__" code="kept" renderers={renderers} />)
    expect(preOf(container)?.textContent).toBe('kept')
  })

  test('a non-function value forced past the types is ignored', () => {
    const renderers = { odd: 'nope' } as unknown as FenceRenderers
    const { container } = render(<Fence lang="odd" code="kept" renderers={renderers} />)
    expect(preOf(container)?.textContent).toBe('kept')
  })
})

describe('Fence — a throw is contained', () => {
  test('a throw from the renderer function leaves the text visible and warns once', () => {
    const renderers: FenceRenderers = {
      json: ({ code }) => {
        JSON.parse(code)
        return <i />
      },
    }
    const { container, rerender } = render(
      <Fence lang="json" code="{ not json" renderers={renderers} />,
    )
    expect(preOf(container)?.textContent).toBe('{ not json')
    rerender(<Fence lang="json" code="{ not json" renderers={renderers} />)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('a throw from the component the renderer returns leaves the text visible', () => {
    const error = spyOn(console, 'error').mockImplementation(() => undefined)
    function Boom(): ReactNode {
      throw new Error('blew up during its own render')
    }
    const renderers: FenceRenderers = { chart: () => <Boom /> }
    const { container } = render(<Fence lang="chart" code="spec body" renderers={renderers} />)
    error.mockRestore()
    expect(preOf(container)?.textContent).toBe('spec body')
  })

  test('a fence that was malformed and becomes valid gets a retry', () => {
    const error = spyOn(console, 'error').mockImplementation(() => undefined)
    function Parse({ code }: { code: string }): ReactNode {
      return <b>{JSON.parse(code).ok as string}</b>
    }
    const renderers: FenceRenderers = { json: ({ code }) => <Parse code={code} /> }
    const { container, rerender } = render(<Fence lang="json" code="{" renderers={renderers} />)
    expect(preOf(container)?.textContent).toBe('{')
    rerender(<Fence lang="json" code='{"ok":"fine"}' renderers={renderers} />)
    error.mockRestore()
    expect(container.querySelector('b')?.textContent).toBe('fine')
  })
})

describe('settledOnly', () => {
  const renderers: FenceRenderers = { fancy: settledOnly(({ code }) => <figure>{code}</figure>) }

  test('shows the code block while unsettled, without a copy button', () => {
    const { container, queryByRole } = render(
      <Fence lang="fancy" code="body" settled={false} renderers={renderers} />,
    )
    expect(container.querySelector('figure')).toBeNull()
    expect(preOf(container)?.textContent).toBe('body')
    expect(queryByRole('button')).toBeNull()
  })

  test('upgrades to the renderer once settled, and is deterministic about it', () => {
    const { container, rerender } = render(
      <Fence lang="fancy" code="body" settled={false} renderers={renderers} />,
    )
    rerender(<Fence lang="fancy" code="body" settled renderers={renderers} />)
    expect(container.querySelector('figure')?.textContent).toBe('body')
    rerender(<Fence lang="fancy" code="body" settled={false} renderers={renderers} />)
    expect(container.querySelector('figure')).toBeNull()
  })
})

describe('Fence — mermaid built in', () => {
  test('streaming shows the source, settled renders the diagram', async () => {
    const code = 'graph TD\n  A --> B'
    const { container, rerender } = render(<Fence lang="mermaid" code={code} settled={false} />)
    expect(container.querySelector('[data-slot="mermaid"]')).toBeNull()
    rerender(<Fence lang="mermaid" code={code} settled />)
    await waitFor(() => expect(container.querySelector('[data-slot="mermaid"] svg')).not.toBeNull())
  })

  test('a consumer mermaid entry wins over the built-in', () => {
    const renderers: FenceRenderers = { mermaid: () => <p>mine</p> }
    render(<Fence lang="mermaid" code="graph TD" renderers={renderers} />)
    expect(screen.getByText('mine')).toBeDefined()
  })
})

describe('createFencePre', () => {
  const pre = (language: string | undefined, text: string): Element => ({
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: language === undefined ? {} : { className: [`language-${language}`] },
        children: [{ type: 'text', value: text }],
      },
    ],
  })

  test('reads the language and text off the hast node', () => {
    const Pre = createFencePre({ note: ({ code }) => <mark>{code}</mark> })
    const { container } = render(<Pre node={pre('note', 'from hast')} />)
    expect(container.querySelector('mark')?.textContent).toBe('from hast')
  })

  test('a pre without a code child renders nothing', () => {
    const Pre = createFencePre()
    const node: Element = { type: 'element', tagName: 'pre', properties: {}, children: [] }
    const { container } = render(<Pre node={node} />)
    expect(container.textContent).toBe('')
  })

  test('the settled flag of the pipeline reaches the fence', () => {
    const Pre = createFencePre()
    const { queryByRole } = render(
      <FenceSettled value={false}>
        <Pre node={pre('ts', 'x')} />
      </FenceSettled>,
    )
    expect(queryByRole('button')).toBeNull()
  })
})
