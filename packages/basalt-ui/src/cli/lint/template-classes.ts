/**
 * The class rules over `.astro` and `.mdx` templates. oxlint parses neither, so a `class="ml-4"` in a
 * site's page would pass every class rule it fails in a `.tsx` file. This scanner reads the class
 * attributes of a template (`class`, `className`, and the string literals of `class:list`) and runs
 * the same token patterns (`CLASS_RULES`), plus a hex or colour function in a class (`colour-literal`),
 * for the rules the root's shipped preset turns on. An AST-only form (a media query in script) has
 * no template form and is left to oxlint on the site's scripts.
 *
 * A finding is waived like any other: `oxlint-disable-next-line basalt/<id> -- <why>` on the line
 * above, inside an HTML or JSX comment.
 */
import { formMessage } from '../../lint/factory'
import { isClassForm, isEnabled } from '../../lint/rule-table'
import type { Form } from '../../lint/rule-table'
import { CLASS_RULES } from '../../lint/rules/class/table'

export type TemplateFinding = { line: number; id: string; message: string }

export const TEMPLATE_FILE = /\.(?:astro|mdx)$/

const ATTRIBUTE = /\b(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g
const CLASS_LIST = /\bclass:list\s*=\s*\{([^}]*)\}/g
const STRING = /"([^"]*)"|'([^']*)'|`([^`]*)`/g
const COLOUR =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i

/** Every class string in `text` with the offset it starts at. */
function classStrings(text: string): { value: string; at: number }[] {
  const out: { value: string; at: number }[] = []
  for (const match of text.matchAll(ATTRIBUTE)) {
    out.push({ value: match[1] ?? match[2] ?? match[3] ?? '', at: match.index ?? 0 })
  }
  for (const match of text.matchAll(CLASS_LIST)) {
    for (const literal of (match[1] ?? '').matchAll(STRING)) {
      out.push({
        value: literal[1] ?? literal[2] ?? literal[3] ?? '',
        at: (match.index ?? 0) + (literal.index ?? 0),
      })
    }
  }
  return out
}

/** A fenced code block, blanked line by line so the lines after it keep their numbers. */
const FENCE = /^(```|~~~)[\s\S]*?^\1/gm
const withoutFences = (text: string): string =>
  text.replace(FENCE, (block) => block.replace(/[^\n]/g, ' '))

/** The class-rule findings of one template, for the basalt rule ids in `enabled`; fenced code is an example, never a finding. */
export function templateClassFindings(
  source: string,
  enabled: ReadonlySet<string>,
): TemplateFinding[] {
  const text = withoutFences(source)
  const lines = text.split('\n')
  const lineOf = (at: number): number => text.slice(0, at).split('\n').length
  const waived = (line: number, id: string): boolean => {
    const above = lines[line - 2] ?? ''
    return above.includes('oxlint-disable-next-line') && above.includes(`basalt/${id}`)
  }
  const rules = Object.entries(CLASS_RULES).filter(([id]) => enabled.has(id))
  const findings: TemplateFinding[] = []
  for (const { value, at } of classStrings(text)) {
    const line = lineOf(at)
    for (const token of value.split(/\s+/).filter(Boolean)) {
      for (const [id, rule] of rules) {
        const forms: readonly Form[] = rule.forms
        for (const form of forms.filter(isEnabled).filter(isClassForm)) {
          if (!form.pattern.test(token) || waived(line, id)) continue
          findings.push({
            line,
            id: `basalt/${id}`,
            message: formMessage(form).replace('{{subject}}', token),
          })
        }
      }
      if (enabled.has('colour-literal') && COLOUR.test(token) && !waived(line, 'colour-literal')) {
        findings.push({
          line,
          id: 'basalt/colour-literal',
          message: `\`${token}\`: a colour literal in a class; use a token class (bg-card, text-muted-foreground) or a --basalt-* variable.`,
        })
      }
    }
  }
  return findings
}
