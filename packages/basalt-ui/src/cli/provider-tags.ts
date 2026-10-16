/** `<BasaltProvider>` tag reading — a leaf: the CLI's doctor and sync share it without importing each other. */
import { tokenize } from './source-text'

/** True when `{` at `i` opens a `{...spread}`: sticky, so any whitespace width is read. */
function isSpreadAt(code: string, i: number): boolean {
  const spread = /\{\s*\.\.\./y
  spread.lastIndex = i
  return spread.test(code)
}

export type ProviderTag = { attrs: string; spread: boolean }

/**
 * Every `<BasaltProvider …>` opening tag in a root route: its attribute text at JSX brace depth 0,
 * with string literals skipped (so `className="a > b"` cannot end the tag, nor `"router="` count),
 * and whether a `{...spread}` could carry a `router`.
 */
export function providerTags(src: string): ProviderTag[] {
  const { code, inLiteral } = tokenize(src)
  return [...code.matchAll(/<BasaltProvider\b/g)]
    .filter((m) => !inLiteral(m.index))
    .map((m) => {
      const tag: ProviderTag = { attrs: '', spread: false }
      let depth = 0
      for (let i = m.index + m[0].length; i < code.length; i++) {
        const ch = code[i]!
        if (inLiteral(i)) continue
        if (ch === '{') {
          if (depth++ === 0 && isSpreadAt(code, i)) tag.spread = true
        } else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) break
        else if (depth === 0) tag.attrs += ch
      }
      return tag
    })
}

export const carriesRouter = (tag: ProviderTag): boolean => /(^|\s)router\s*=/.test(tag.attrs)
