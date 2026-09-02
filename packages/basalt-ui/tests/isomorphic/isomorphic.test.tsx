/**
 * The isomorphic smoke suite — one `test()` per (subpath, component), so a red line names the
 * component that broke rather than "the barrel".
 *
 * What each test asserts, in order:
 *   1. the component mounts inside its subpath's MINIMAL provider tree without throwing;
 *   2. neither `console.error` nor `console.warn` was called during mount OR unmount;
 *   3. unmount does not throw.
 * `className` passthrough and `renderToString` survivability are RATCHETS against a recorded list
 * rather than walls: 98 components drop the class today, so demanding it would be 98 red lines
 * restating one finding. The record moves only when a component's behaviour does — in either
 * direction. `.claude/maturation/isomorphic-findings.md` is the prose half.
 *
 * The Mantine-FREE subpaths (`./charts`, `./tokens`, `./agent`) render with no provider at all.
 * That is not an omission: a component there that only renders inside `MantineProvider` has broken
 * the packaging invariant the whole boundary exists to hold.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { BasaltProvider } from '../../src/provider'
import { createBasaltTheme } from '../../src/theme'
import { createBasaltQueryClient } from '../../src/query-client'
import { describeOutcome, detectComponents, probeElement, renderProbe, ssrProbe } from './harness'
import {
  EXPECTED_DEFECTS,
  MINIMAL_PROPS,
  NO_CLASSNAME,
  SKIP,
  SSR_UNSUPPORTED,
  SVG_HOSTED,
} from './props'

const theme = createBasaltTheme()
const queryClient = createBasaltQueryClient()

/** The Mantine-coupled tree: everything a root-barrel component may assume exists. */
function Coupled({ children }: { children: ReactNode }): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BasaltProvider theme={theme} defaultColorScheme="dark">
        {children}
      </BasaltProvider>
    </QueryClientProvider>
  )
}

/** The Mantine-free tree: literally nothing. Rendering bare IS the assertion. */
function Free({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}

/**
 * An SVG host for the components that paint SVG children. Without it React logs
 * `The tag <rect> is unrecognized in this browser` — a harness artifact that would drown the real
 * console findings this suite exists to surface.
 */
function hosted(name: string, ui: ReactElement): ReactElement {
  return SVG_HOSTED.has(name) ? <svg>{ui}</svg> : ui
}

type Subpath = {
  readonly id: string
  readonly mod: Record<string, unknown>
  readonly mantineFree: boolean
}

/**
 * Imported dynamically and awaited at module scope so the describe/test tree can be BUILT from the
 * real exports. Bun evaluates a test file to completion before running anything it registered, so
 * top-level await is safe here — and it is the only way to emit one named test per export.
 */
const SUBPATHS: Subpath[] = await Promise.all(
  (
    [
      ['.', '../../src/index.ts', false],
      ['./charts', '../../src/charts/index.ts', true],
      ['./tokens', '../../src/tokens/index.ts', true],
      ['./controls', '../../src/controls/index.ts', false],
      ['./controls-dates', '../../src/controls-dates/index.ts', false],
      ['./forms', '../../src/forms/index.ts', false],
      ['./dashboard', '../../src/dashboard/index.ts', false],
      ['./shell', '../../src/shell/index.tsx', false],
      ['./data/table', '../../src/data/table.ts', false],
      ['./data/virtual', '../../src/data/virtual.ts', false],
      ['./notifications', '../../src/notifications/index.ts', false],
      ['./commands', '../../src/commands/index.ts', false],
      ['./content', '../../src/content/index.ts', false],
      ['./agent', '../../src/agent/index.ts', true],
      ['./agent-chat', '../../src/agent-chat/index.ts', false],
      ['./theme-lab', '../../src/theme-lab/index.tsx', false],
    ] as const
  ).map(async ([id, path, mantineFree]) => ({
    id,
    mantineFree,
    mod: (await import(path)) as Record<string, unknown>,
  })),
)

for (const subpath of SUBPATHS) {
  const components = detectComponents(subpath.mod)
  const Wrapper = subpath.mantineFree ? Free : Coupled

  describe(`basalt-ui${subpath.id === '.' ? '' : `/${subpath.id.slice(2)}`}`, () => {
    if (components.length === 0) {
      test('exports no components', () => {
        expect(components).toHaveLength(0)
      })
      return
    }

    for (const { name, component } of components) {
      const skip = SKIP[name]
      if (skip) {
        test.skip(`${name} — SKIPPED: ${skip}`, () => {})
        continue
      }

      const defect = EXPECTED_DEFECTS[name]
      const props = MINIMAL_PROPS[name] ?? {}
      const label = defect ? `${name} — EXPECTED DEFECT ${defect.finding}: ${defect.why}` : name
      const emit = defect ? test.skip : test

      emit(`${label} renders, stays quiet, and unmounts`, () => {
        const outcome = renderProbe(
          { render: (ui) => render(<Wrapper>{hosted(name, ui)}</Wrapper>) },
          probeElement(component, props),
        )
        expect(describeOutcome(name, outcome)).toBe(`${name}: clean`)
      })
    }
  })
}

/**
 * `className` passthrough — audit item C8, as a RATCHET rather than a wall.
 *
 * 98 of the library's components drop the class today, so asserting "everyone forwards it" would
 * be 98 red lines restating one finding. Instead the live probe is compared against `NO_CLASSNAME`
 * in both directions: a component that starts forwarding turns this red until its entry is
 * deleted, and a component that STOPS forwarding turns it red immediately. The record is the
 * audit artifact; the test is what keeps it honest.
 */
describe('className passthrough — audit item C8', () => {
  test('the recorded gap list matches what the components actually do', () => {
    const observed = new Set<string>()
    for (const subpath of SUBPATHS) {
      const Wrapper = subpath.mantineFree ? Free : Coupled
      for (const { name, component } of detectComponents(subpath.mod)) {
        if (SKIP[name] || EXPECTED_DEFECTS[name]) continue
        const outcome = renderProbe(
          { render: (ui) => render(<Wrapper>{hosted(name, ui)}</Wrapper>) },
          probeElement(component, MINIMAL_PROPS[name] ?? {}),
        )
        if (outcome.renderError) continue
        if (outcome.hasClassNameProbe === false) observed.add(name)
      }
    }

    const recorded = Object.keys(NO_CLASSNAME).toSorted()
    expect([...observed].toSorted()).toEqual(recorded)
  })
})

/**
 * The server half.
 *
 * `renderToString` is the honest form of "render with no `document`": React DOM cannot be made to
 * run against a deleted global, but the server renderer genuinely never touches one — so anything
 * reaching `window`/`document` DURING RENDER (as opposed to in an effect) throws here and nowhere
 * else. Each component is server-rendered inside the same provider tree the DOM pass uses, which
 * is what makes the result a statement about BASALT rather than about Mantine's own
 * "MantineProvider was not found" guard.
 */
describe('renderToString — every component must survive with no DOM', () => {
  test('the recorded SSR-unsupported list matches what actually throws', () => {
    const observed: string[] = []
    for (const subpath of SUBPATHS) {
      const Wrapper = subpath.mantineFree ? Free : Coupled
      for (const { name, component } of detectComponents(subpath.mod)) {
        if (SKIP[name] || EXPECTED_DEFECTS[name] || observed.includes(name)) continue
        const ui = (
          <Wrapper>{hosted(name, probeElement(component, MINIMAL_PROPS[name] ?? {}))}</Wrapper>
        )
        if (ssrProbe(renderToString, ui).error) observed.push(name)
      }
    }
    expect(observed.toSorted()).toEqual(Object.keys(SSR_UNSUPPORTED).toSorted())
  })
})

/**
 * The one assertion that protects the rest: every subpath that HAS components must have been seen
 * to have them. A barrel that starts resolving to an empty module (a bad path, a dropped export, a
 * build that moved a file) would otherwise turn this whole suite green by testing nothing.
 */
test('every coupled subpath enumerated at least one component', () => {
  const empty = SUBPATHS.filter((s) => detectComponents(s.mod).length === 0).map((s) => s.id)
  // `./tokens` is pure data by design and exports no component — the only permitted entry.
  expect(empty).toEqual(['./tokens'])
})
