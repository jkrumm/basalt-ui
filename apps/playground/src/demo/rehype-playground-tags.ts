/**
 * rehype-playground-tags — a tiny, dependency-free rehype plugin backing the `/content-sanitize`
 * demo (basalt-ui 1.12.0 playground gate demo 2: the `sanitizeSchema` extension).
 *
 * Raw HTML typed directly into markdown text never becomes a hast element — react-markdown ships
 * no `rehype-raw`, so a literal `<script>`/`<pg-badge>` in the SOURCE text just renders as escaped
 * text, never exercising the sanitizer at all. This plugin instead builds real hast elements the
 * way a remark/rehype plugin legitimately does, so `sanitizeSchema` and `rehype-sanitize`'s
 * baseline `strip` list have something genuine to act on: two plain-text markers in the demo's
 * markdown source are rewritten, on the HAST TREE, into a `<pg-badge tone="…">` element (a
 * stand-in for a consumer's own semantic tag — e.g. `hermes-badge` in
 * docs/AGENT-CHAT-SPEC.md §7) and a `<script>` element (a simulated injection attempt).
 *
 * Ordering matters and is what makes this a genuine test: `Markdown` appends `rehypePlugins` BEFORE
 * its own `[rehypeSanitize, merged]` pass (see `content/markdown.tsx`'s module doc — that pass
 * always runs last, so nothing supplied through the escape hatch can outrun it). So both elements
 * this plugin builds are handed to the REAL sanitizer, not merely typed as inert text.
 */

// Structural mirror of the handful of hast fields this plugin touches — no dependency on the
// `hast`/`mdast` type packages (transitive-only in this workspace, not a declared playground dep).
type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

const BADGE_MARKER = /^\{\{badge:(\w+)\|([^}]+)\}\}$/
const SCRIPT_MARKER = '{{script}}'

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function badgeElement(tone: string, label: string): HastNode {
  return {
    type: 'element',
    tagName: 'pg-badge',
    properties: { tone },
    children: [{ type: 'text', value: label }],
  }
}

function scriptElement(): HastNode {
  return {
    type: 'element',
    tagName: 'script',
    properties: {},
    children: [{ type: 'text', value: "document.title = 'pwned by a markdown message'" }],
  }
}

function transform(node: HastNode): HastNode {
  if (node.type === 'element' && node.tagName === 'p') {
    const text = textOf(node).trim()
    const badge = BADGE_MARKER.exec(text)
    if (badge) {
      const tone = badge[1]
      const label = badge[2]
      if (tone !== undefined && label !== undefined) return badgeElement(tone, label)
    }
    if (text === SCRIPT_MARKER) return scriptElement()
  }
  if (node.children === undefined) return node
  return { ...node, children: node.children.map(transform) }
}

/** A unified/rehype plugin factory — pass as `<Markdown rehypePlugins={[rehypePlaygroundTags]}>`. */
export function rehypePlaygroundTags() {
  return (tree: HastNode): HastNode => transform(tree)
}

export const PLAYGROUND_SANITIZE_DEMO_MARKDOWN =
  `This message carries a custom tag and a simulated script-injection attempt — both built as ` +
  `real hast elements (not typed HTML, which react-markdown never parses without \`rehype-raw\`) ` +
  `so the sanitizer has something genuine to act on.\n\n` +
  `{{badge:critical|Escalate immediately}}\n\n` +
  `{{script}}\n`
