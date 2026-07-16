/**
 * Pure hast-node helpers for extracting a fenced code block's language/title/text from the hast
 * tree react-markdown hands to a `pre` component override (docs/CONTENT-SPEC.md §6). MDX compiles
 * fences differently (no hast `node` prop reaches the component) — see `./mdx` for its own
 * lighter-weight extraction over rendered children.
 *
 * Not part of the public surface — `./markdown`'s `pre` renderer is the only consumer.
 */
import type { Element } from 'hast'

/** Depth-first text content of a hast element (concatenates every text descendant). */
export function hastToText(node: Element): string {
  let out = ''
  for (const child of node.children) {
    if (child.type === 'text') out += child.value
    else if (child.type === 'element') out += hastToText(child)
  }
  return out
}

function findElementChild(node: Element, tagName: string): Element | undefined {
  return node.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === tagName,
  )
}

function getClassNames(node: Element): string[] {
  const value = node.properties?.['className']
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return [value]
  return []
}

function getLanguage(node: Element): string | undefined {
  const languageClass = getClassNames(node).find((name) => name.startsWith('language-'))
  return languageClass?.slice('language-'.length)
}

/**
 * The fence's meta string (the text after the language on the opening fence line, e.g.
 * `title="query.ts"` in ` ```ts title="query.ts" `) — mdast-util-to-hast places it on the `code`
 * hast node's `data.meta`, never on the surrounding `pre`.
 */
function getCodeMeta(node: Element): string | undefined {
  const data = node.data as { meta?: string } | undefined
  return data?.meta
}

const TITLE_META_RE = /title="([^"]*)"/

function parseMetaTitle(meta: string | undefined): string | undefined {
  if (meta === undefined) return undefined
  return TITLE_META_RE.exec(meta)?.[1]
}

export type FenceInfo = {
  readonly code: string
  readonly language?: string
  readonly title?: string
}

/**
 * Extracts `{ code, language, title }` from a `pre` hast node's `code` child. Returns `undefined`
 * when the node carries no `code` child (never true for a genuine fenced block, but keeps the
 * caller total rather than throwing on unexpected input).
 */
export function extractFenceInfo(preNode: Element): FenceInfo | undefined {
  const codeNode = findElementChild(preNode, 'code')
  if (!codeNode) return undefined

  const language = getLanguage(codeNode)
  const title = parseMetaTitle(getCodeMeta(codeNode))
  const code = hastToText(codeNode)

  return {
    code,
    ...(language !== undefined && { language }),
    ...(title !== undefined && { title }),
  }
}
