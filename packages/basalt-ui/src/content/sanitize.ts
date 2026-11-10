/**
 * The sanitize schema for `Markdown`: a fixed base policy plus the caller's ADDITIONS. Removal is
 * unrepresentable, so no caller input can shrink what `rehype-sanitize`'s `defaultSchema` strips.
 *
 * Two upstream traps shape the merge (hast-util-sanitize@6):
 *  - the plugin spreads a supplied schema shallowly, so passing a bare `attributes` object would
 *    REPLACE every default allowance (links would lose `href`). The merge works per tag instead.
 *  - `findDefinition` returns the FIRST entry matching a property name, so a bare-string addition
 *    appended after a narrower tuple (`['className', /^language-./]`) would be dead code. An
 *    addition therefore replaces any existing entry of that name: allow-any widens, never narrows.
 *
 * Property names in a schema are hast camelCase (`dataCalloutKind`); callers write HTML spelling
 * (`data-callout-kind`), converted in `toHastName`.
 *
 * Footnotes get exactly ONE clobber layer. `mdast-util-to-hast` already prefixes footnote ids AND
 * hrefs with `user-content-`; the sanitizer prefixes ids again but never hrefs, which leaves every
 * footnote link dangling (`id="user-content-user-content-fn-1"` beside `href="#user-content-fn-1"`).
 * An empty `clobberPrefix` turns the sanitizer's layer off. Markdown syntax cannot produce any other
 * id, and raw HTML never becomes an element (no `rehype-raw`), so nothing else loses protection; a
 * trusted consumer whose `rehypePlugins` inject elements owns their ids.
 */
import { defaultSchema } from 'rehype-sanitize'

type Definition = string | readonly [string, ...unknown[]]
type Attributes = Readonly<Record<string, readonly Definition[]>>

export type SanitizeAdditions = {
  allowTags?: string[]
  allowAttrs?: Record<string, string[]>
}

const BASE_ATTRS: Record<string, string[]> = {
  blockquote: ['data-callout', 'data-callout-kind', 'data-callout-title', 'data-callout-fold'],
  a: ['data-wikilink'],
  img: ['width', 'height'],
  input: ['checked'],
}

const HTML_TO_HAST: Readonly<Record<string, string>> = { class: 'className', for: 'htmlFor' }

function toHastName(name: string): string {
  const lower = name.toLowerCase()
  return (
    HTML_TO_HAST[lower] ?? lower.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
  )
}

const definitionName = (definition: Definition): string =>
  typeof definition === 'string' ? definition : definition[0]

function widenAttributes(base: Attributes, additions: Record<string, string[]>): Attributes {
  const merged = new Map(Object.entries(base))
  for (const [tag, names] of Object.entries(additions)) {
    const added = new Set(names.map(toHastName))
    const kept = (merged.get(tag) ?? []).filter((entry) => !added.has(definitionName(entry)))
    merged.set(tag, [...kept, ...added])
  }
  return Object.fromEntries(merged)
}

// Event handlers and inline style are never an addition: an `on*` attribute is script, `style` is
// a CSS exfiltration and UI-redress channel. The names are refused, not the tag.
const FORBIDDEN_ATTR = /^(?:on|style$)/i

function withoutForbidden(allowAttrs: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(allowAttrs).map(([tag, names]) => [
      tag,
      names.filter((name) => !FORBIDDEN_ATTR.test(toHastName(name))),
    ]),
  )
}

export function createSanitizeSchema({ allowTags = [], allowAttrs = {} }: SanitizeAdditions = {}) {
  const baseAttributes = widenAttributes(defaultSchema.attributes ?? {}, BASE_ATTRS)
  return {
    ...defaultSchema,
    attributes: widenAttributes(baseAttributes, withoutForbidden(allowAttrs)),
    tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...allowTags])],
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.['href'] ?? []), 'tel'],
    },
    clobberPrefix: '',
  }
}
