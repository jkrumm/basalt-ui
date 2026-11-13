/**
 * `basalt/colour-literal` (guardrails section 4, row 14): a hex or colour function written as a
 * string in TS. The regex guard it replaces had an escape hatch, which is why shutterflow carried
 * 11 canvas waivers; an AST rule reads strings and template quasis and nothing else. Deep-rendering
 * files take one file-level waiver on a path in `manifest.deepRender` (`waiver-needs-reason`).
 *
 * A function that wraps a token (`rgb(var(--vx-x) / 50%)`, `oklch(from var(--vx-x) l c h)`) is not
 * a literal and passes; `color-mix` and `light-dark` are the stylesheet's, not this rule's.
 *
 * Known limit: a short hex-alphabet fragment (`'#feed'`, `'#cafe'`) is indistinguishable from a
 * colour by syntax alone. `url(#id)` and `url('#id')` pass; an anchor or selector string of that
 * shape takes a per-line waiver with a reason.
 */
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'
import type { Node } from '../../factory'

const HEX = /(?<!url\(['"]?)(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi
const COLOUR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?:[-+.\d]|none\b|\$\{\})/i

/** `#123` in prose is an issue number, not a colour; a bare `'#123'` string still is one. */
const isIssueReference = (match: string, text: string): boolean =>
  /^#\d{3,4}$/.test(match) && text.trim() !== match

function literalIn(text: string): string | undefined {
  const fn = COLOUR_FUNCTION.exec(text)
  if (fn) return `${fn[0].replace(/\(.*$/s, '')}()`
  for (const hex of text.matchAll(HEX)) {
    if (!isIssueReference(hex[0], text)) return hex[0]
  }
  return undefined
}

const templateText = (node: Node): string =>
  (Array.isArray(node['quasis']) ? (node['quasis'] as Node[]) : [])
    .map((quasi) => {
      const value = quasi['value'] as { cooked?: string | null; raw: string }
      return value.cooked ?? value.raw
    })
    .join('${}')

const isModuleSource = (node: Node): boolean => {
  const parent = node['parent'] as Node | undefined
  return (
    parent?.type === 'ImportDeclaration' ||
    parent?.type === 'ExportAllDeclaration' ||
    parent?.type === 'ExportNamedDeclaration'
  )
}

export const colourLiteralForm: AstForm = {
  id: 'colour-literal',
  detect: ({ report }) => ({
    Literal(node) {
      const text = node['value']
      if (typeof text !== 'string' || isModuleSource(node)) return
      const found = literalIn(text)
      if (found) report(node, found)
    },
    TemplateLiteral(node) {
      const found = literalIn(templateText(node))
      if (found) report(node, found)
    },
  }),
  fix: 'A VX.* token, alpha(VX.x, n) or the series file; a deep-rendering file takes a reasoned file waiver',
  next: 'List the file in manifest.deepRender and waive colour-literal once with -- <why>',
  fixture: 'structure-rest/colour-literal.tsx',
}

export const colourLiteralRules = defineRules({
  'colour-literal': {
    family: 'structure',
    profiles: ['bridge', 'parts', 'app'],
    defect:
      '11 shutterflow canvas waivers (overlay.ts 10, Stage.tsx 1); the regex guard gave the escape and an AST rule replaces it',
    forms: [colourLiteralForm],
  },
})
