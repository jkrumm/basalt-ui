/**
 * `<Markdown streaming contentTrust="untrusted">` under a real token stream — the matrix behind
 * docs/V2-SPEC.md § 6 "streaming markdown". Every prefix of a long reply (char-by-char and in
 * seeded random chunks) is rendered through the real lazy chain (react-markdown + remend +
 * rehype-sanitize) and held to the same invariants:
 *  - never throws;
 *  - no `streamdown:` sentinel reaches an `<img src>` / `<a href>`, and no remote `<img>` appears;
 *  - the final streamed output equals rendering the complete text in one go;
 *  - settled blocks are not re-rendered while the tail grows.
 */
import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Markdown } from './markdown'

function ui(text: string, key?: string) {
  return (
    <MantineProvider>
      <Markdown streaming contentTrust="untrusted" key={key}>
        {text}
      </Markdown>
    </MantineProvider>
  )
}

/** Deterministic PRNG (mulberry32) so a failing chunking is reproducible from the seed. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function prefixes(text: string, chunk: () => number): string[] {
  const out: string[] = []
  for (let end = 0; end < text.length;) {
    end = Math.min(text.length, end + chunk())
    out.push(text.slice(0, end))
  }
  return out
}

function assertSafe(container: HTMLElement, at: string): void {
  const where = `at prefix ${JSON.stringify(at.slice(-40))}`
  for (const img of container.querySelectorAll('img')) {
    expect(img.getAttribute('src') ?? '', where).not.toContain('streamdown:')
    expect(img.getAttribute('src') ?? '', where).toMatch(/^\//)
  }
  for (const a of container.querySelectorAll('a')) {
    expect(a.getAttribute('href') ?? '', where).not.toContain('streamdown:')
  }
  expect(container.innerHTML, where).not.toContain('streamdown:')
  expect(container.querySelector('script, iframe, object, [onclick], [onerror]'), where).toBeNull()
}

const REPLY = [
  '# Title',
  '',
  'A paragraph with **bold**, *italic*, ~~strike~~ and `inline code`, a [link](https://example.com/docs?a=1)',
  'and an ![inline image](/assets/ok.png) plus a remote ![tracker](https://evil.example/p.png?q=secret).',
  '',
  '- item one',
  '  - nested **two**',
  '    - deep [x](https://example.com/deep)',
  '- item three',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '```ts',
  'const x: number = 1',
  '```',
  '',
  '```mermaid',
  'graph TD',
  '  A --> B',
  '```',
  '',
  'Costs $5 and $10, and math $$x^2$$ done. <b onclick="x()">raw</b> <script>alert(1)</script>',
  '',
  'Last paragraph with a [dangling link](https://example.com/very/long',
].join('\n')

/** Everything above plus a closing so the full text has no dangling construct. */
const COMPLETE_REPLY = `${REPLY})\n\n![end](/assets/end.png)\n`

describe('streaming matrix — every prefix is safe', () => {
  const cases: ReadonlyArray<readonly [string, () => number]> = [
    ['char by char', () => 1],
    [
      'random chunks (seed 1)',
      (
        (r) => () =>
          1 + Math.floor(r() * 12)
      )(rng(1)),
    ],
    [
      'random chunks (seed 42)',
      (
        (r) => () =>
          1 + Math.floor(r() * 40)
      )(rng(42)),
    ],
  ]

  for (const [name, chunk] of cases) {
    test(
      name,
      async () => {
        const all = prefixes(COMPLETE_REPLY, chunk)
        const { container, rerender } = render(ui(''))
        for (const prefix of all) {
          await act(async () => {
            rerender(ui(prefix))
          })
          assertSafe(container, prefix)
        }
        await waitFor(() => expect(container.querySelector('h1')).not.toBeNull())
        assertSafe(container, COMPLETE_REPLY)

        const reference = render(ui(COMPLETE_REPLY, 'reference'))
        await waitFor(() => expect(reference.container.querySelector('h1')).not.toBeNull())
        expect(container.innerHTML).toBe(reference.container.innerHTML)
      },
      60_000,
    )
  }
})

async function tail(text: string): Promise<HTMLElement> {
  const { container } = render(ui(text))
  // The Suspense fallback is a bare span; the real pipeline renders a <p>/<pre>/<ul>/<table>.
  await waitFor(() => expect(container.querySelector('p, pre, ul, ol, table')).not.toBeNull())
  // …and remend resolves a tick later than react-markdown on a cold singleton.
  await act(async () => {
    await Promise.resolve()
  })
  return container
}

describe('streaming matrix — the tail constructs remend repairs', () => {
  test('unterminated link keeps its text, never an href', async () => {
    const c = await tail('see [the docs](https://example.com/a')
    expect(c.textContent).toContain('the docs')
    expect(c.querySelector('a[href]')).toBeNull()
    assertSafe(c, 'link')
  })

  test('unterminated image renders its alt text, never an <img>', async () => {
    const c = await tail('look: ![a diagram of the flow](/assets/flo')
    expect(c.querySelector('img')).toBeNull()
    expect(c.textContent).toContain('a diagram of the flow')
    assertSafe(c, 'image')
  })

  test('half-typed image alt (no bracket closed yet) is inert text', async () => {
    const c = await tail('look: ![a dia')
    expect(c.querySelector('img')).toBeNull()
    assertSafe(c, 'alt')
  })

  test('a complete same-origin image still renders as an <img>', async () => {
    const c = await tail('![ok](/assets/ok.png)')
    await waitFor(() => expect(c.querySelector('img')).not.toBeNull())
    expect(c.querySelector('img')?.getAttribute('src')).toBe('/assets/ok.png')
  })

  test('emphasis, strike and inline code close without leaking markers', async () => {
    for (const [src, selector] of [
      ['a **bold', 'strong'],
      ['an *italic', 'em'],
      ['a ~~gone', 'del'],
      ['some `code', 'code'],
    ] as const) {
      const c = await tail(src)
      await waitFor(() => expect(c.querySelector(selector)).not.toBeNull())
      expect(c.textContent).not.toMatch(/\*|~~|`/)
    }
  })

  test('table header without a delimiter row renders as text, then as a table', async () => {
    const early = await tail('| a | b |')
    expect(early.textContent).toContain('a')
    expect(early.querySelector('table')).toBeNull()

    const full = await tail('| a | b |\n|---|---|\n| 1 | 2 |')
    await waitFor(() => expect(full.querySelector('table')).not.toBeNull())
  })

  test('a deeply nested list with an unclosed ** repairs inside the item', async () => {
    const c = await tail('- a\n  - b\n    - **c')
    await waitFor(() => expect(c.querySelector('li li li strong')).not.toBeNull())
  })

  test('currency $ is left alone; an unterminated $$ block does not throw', async () => {
    const money = await tail('it costs $5 and $10 today')
    expect(money.textContent).toContain('$5 and $10')

    const math = await tail('so $$x^2')
    expect(math.textContent).toContain('x^2')
    assertSafe(math, 'math')
  })

  test('an unterminated code fence shows its text in a <pre>', async () => {
    const c = await tail('```ts\nconst a = 1\nconst b')
    expect(c.querySelector('pre')?.textContent).toContain('const b')
  })

  test('an unterminated mermaid fence stays a code block with the source intact', async () => {
    const c = await tail('```mermaid\ngraph TD\n  A --> ')
    expect(c.querySelector('pre')?.textContent).toContain('A -->')
    expect(c.querySelector('svg')).toBeNull()
  })

  test('raw HTML in a streamed tail never becomes an element', async () => {
    const c = await tail('hi <img src=x onerror=alert(1)> <script>alert(1)</script> <custom')
    expect(c.querySelector('script, img[onerror]')).toBeNull()
    expect(c.innerHTML).not.toContain('onerror=')
  })
})

describe('streaming matrix — settled blocks stay memoized', () => {
  test('settled blocks do not re-render while the tail grows', async () => {
    let settledRenders = 0
    const Spy = ({ children }: { children?: React.ReactNode }) => {
      settledRenders++
      return <h2>{children}</h2>
    }
    const view = (text: string) => (
      <MantineProvider>
        <Markdown streaming contentTrust="untrusted" components={SPY_COMPONENTS}>
          {text}
        </Markdown>
      </MantineProvider>
    )
    const SPY_COMPONENTS = { h2: Spy }

    const head = '## settled heading\n\nsettled paragraph.\n\n'
    const { rerender } = render(view(`${head}tail`))
    await screen.findByText('settled heading')
    const afterFirstPaint = settledRenders

    const tailText = 'the tail keeps growing one character at a time'
    for (let i = 1; i <= tailText.length; i++) {
      await act(async () => {
        rerender(view(`${head}${tailText.slice(0, i)}`))
      })
    }
    expect(screen.getByText(tailText)).not.toBeNull()
    // The settled heading's component never re-ran for any of the tail updates.
    expect(settledRenders).toBe(afterFirstPaint)
  })
})
