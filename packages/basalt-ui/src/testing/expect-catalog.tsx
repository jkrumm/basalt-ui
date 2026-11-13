/**
 * The catalog contract test (docs/v3/concepts/ai-mdx.md row 11, P5). Structural over `CatalogLike`,
 * so `./testing` imports nothing from `./ai`.
 */
import { createElement } from 'react'
import type { FC } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CatalogLike, Phase } from '../core/ports'

type Path = readonly (string | number)[]
type BlockView = FC<{ spec: unknown; phase: Phase }>

/** Mirrors the catalog default; a block's own `limits` is read when it has one. */
const DEFAULT_LIMITS = { maxBytes: 32 * 1024, maxDepth: 6 }
const URL_KEYS: ReadonlySet<string> = new Set(['href', 'src', 'url', 'link'])
const MARK = 'basalt-fuzz'
const HOSTILE = [`//${MARK}.invalid/p`, `javascript:alert('${MARK}')`, `data:text/html,${MARK}`]
const PHASES: readonly Phase[] = ['ready', 'stale', 'loading', { tag: 'error' }]
const IN_ATTRIBUTE = new RegExp(`\\s[\\w:-]+="[^"]*${MARK}`)

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const pathText = (path: Path): string => path.map(String).join('.')

function stringLeaves(x: unknown, path: Path = []): Path[] {
  if (typeof x === 'string') return [path]
  if (Array.isArray(x)) return x.flatMap((item, i) => stringLeaves(item, [...path, i]))
  if (isRecord(x)) return Object.entries(x).flatMap(([k, v]) => stringLeaves(v, [...path, k]))
  return []
}

function setAt(root: Record<string, unknown>, path: Path, value: unknown): Record<string, unknown> {
  const copy = structuredClone(root)
  let node: Record<string | number, unknown> = copy
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>
  node[path.at(-1)!] = value
  return copy
}

function nested(levels: number): unknown {
  let value: unknown = 'x'
  for (let i = 0; i < levels; i++) value = [value]
  return value
}

function limitsOf(block: CatalogLike['blocks'][number]): typeof DEFAULT_LIMITS {
  const own = (block as { limits?: typeof DEFAULT_LIMITS }).limits
  return own ?? DEFAULT_LIMITS
}

function blockViewOf(catalog: CatalogLike): BlockView | null {
  const view = (catalog as { Block?: unknown }).Block
  return typeof view === 'function' ? (view as BlockView) : null
}

function render(view: BlockView, spec: unknown, phase: Phase): string {
  return renderToStaticMarkup(createElement(view, { spec, phase }))
}

/** A throw here is already reported by the phase pass; the fuzz pass only reads the markup. */
function renderOrEmpty(view: BlockView, spec: unknown): string {
  try {
    return render(view, spec, 'ready')
  } catch {
    return ''
  }
}

function checkSample(
  catalog: CatalogLike,
  view: BlockView | null,
  block: CatalogLike['blocks'][number],
  sample: unknown,
  at: string,
): string[] {
  const failures: string[] = []
  if (!isRecord(sample)) return [`${at} is not an object; a block's props are one object`]
  const spec = { block: block.name, ...sample }
  const own = catalog.validate(spec)
  if (!own.ok) return [`${at} does not validate: ${own.error}`]

  for (const phase of view ? PHASES : []) {
    const tag = typeof phase === 'string' ? phase : phase.tag
    try {
      render(view!, spec, phase)
    } catch (error) {
      failures.push(`${at} throws while rendering in ${tag}: ${String(error)}`)
    }
  }

  const { maxBytes, maxDepth } = limitsOf(block)
  if (catalog.validate({ ...spec, pad: 'x'.repeat(maxBytes) }).ok)
    failures.push(`${at} padded past ${maxBytes} bytes is accepted`)
  if (catalog.validate({ ...spec, deep: nested(maxDepth) }).ok)
    failures.push(`${at} nested past depth ${maxDepth} is accepted`)

  const urlPaths: Path[] = [['href']]
  for (const path of stringLeaves(sample)) {
    const key = path.at(-1)
    if (typeof key === 'string' && URL_KEYS.has(key.toLowerCase())) urlPaths.push(path)
  }
  for (const path of urlPaths) {
    for (const url of HOSTILE) {
      if (catalog.validate(setAt(spec, path, url)).ok)
        failures.push(`${at}: the hostile URL "${url}" in ${pathText(path)} is accepted`)
    }
  }

  if (view === null) return failures
  for (const path of stringLeaves(sample)) {
    for (const url of HOSTILE) {
      const hostile = setAt(spec, path, url)
      if (!catalog.validate(hostile).ok) continue
      if (IN_ATTRIBUTE.test(renderOrEmpty(view, hostile)))
        failures.push(
          `${at}: the model string in ${pathText(path)} reaches an attribute unfiltered ("${url}")`,
        )
    }
  }
  return failures
}

/**
 * The one contract test every app catalog runs: samples, limits and hostile URLs. It throws one
 * error that lists every failure.
 *
 * What it checks:
 *
 * - every `sample` validates as `{ block: name, ...sample }`, and renders through `catalog.Block`
 *   in `ready`, `stale`, `loading` and `error` without throwing;
 * - each sample padded past the block's `limits.maxBytes`, or nested past `limits.maxDepth`, is
 *   refused;
 * - a hostile URL (`//host`, `javascript:`, `data:`) in any `href`, `src`, `url` or `link` field of
 *   the sample, or added as `href` at its root, is refused;
 * - a hostile URL in any other string field either is refused or never reaches an attribute of the
 *   rendered markup: a block that turns a model string into a link must take it from a url field.
 *
 * Rendering runs on `react-dom/server`, so it needs no DOM and a render that throws is not hidden
 * by the block's error boundary. `Block` is read when the catalog has one (every `defineCatalog`
 * product does); without it only the validator is checked.
 *
 * @useWhen a test file holds the `defineCatalog` product of an app to the sample, limit and hostile-URL contract
 * @neverWhen the code runs in an app bundle, or the question is the look of a block (use a layout or screenshot test)
 *
 * @example
 * test('the show catalog', () => expectCatalog(catalog))
 */
export function expectCatalog(catalog: CatalogLike): void {
  const view = blockViewOf(catalog)
  const failures: string[] = []
  if (catalog.blocks.length === 0) failures.push('the catalog has no blocks')
  for (const block of catalog.blocks) {
    if (block.sample.length === 0) failures.push(`block "${block.name}" has no sample`)
    for (const [i, sample] of block.sample.entries()) {
      failures.push(
        ...checkSample(catalog, view, block, sample, `block "${block.name}" sample ${i}`),
      )
    }
  }
  if (failures.length > 0)
    throw new Error(`expectCatalog: ${failures.length} failure(s)\n- ${failures.join('\n- ')}`)
}
