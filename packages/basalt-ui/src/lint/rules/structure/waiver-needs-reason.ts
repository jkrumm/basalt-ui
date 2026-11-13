/**
 * `basalt/waiver-needs-reason` (guardrails sections 4 and 8, row 15): a plain plugin rule over
 * `sourceCode.getAllComments()`. Native directives stay the waiver dialect; this rule keeps them
 * honest. A directive counts only at the start of its comment, so a comment that merely mentions
 * the token neither disables anything nor trips the rule (lint-edges S4).
 *
 * - `missing-reason`: a `disable`, `disable-next-line` or `disable-line` directive (oxlint or
 *   eslint spelling) with no `-- <why>`; the reason text is never read as rule ids.
 * - `file-level-scope`: a file-level `disable` on any rule but `colour-literal`,
 *   `shadcn/no-inline-styles` or `raw-scroll`, naming no rule at all, or in a file outside the
 *   `deepRender` option (the paths `manifest.deepRender` declares).
 *
 * Option: `{ deepRender: string[] }`, path suffixes or globs (`*`, `**`) matched against the file.
 */
import type { FormContext, Node } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

type Comment = Node & { readonly value: string }

type HostContext = FormContext['context'] & {
  readonly filename?: string
  readonly physicalFilename?: string
  readonly sourceCode?: { getAllComments(): readonly Comment[] }
}

/** Rules a deep-rendering file may waive file-wide (guardrails section 6, E3). */
export const FILE_WAIVABLE: ReadonlySet<string> = new Set([
  'basalt/colour-literal',
  'shadcn/no-inline-styles',
  'basalt/raw-scroll',
  'raw-scroll',
])

const DIRECTIVE = /^\s*(?:oxlint|eslint)-(disable-next-line|disable-line|disable)(?=\s|$)([\s\S]*)$/
const REASON_SEPARATOR = /(?:^|\s)--+(?:\s|$)/

type Directive = {
  readonly kind: 'disable-next-line' | 'disable-line' | 'disable'
  readonly rules: readonly string[]
  readonly reason: string
}

function parseDirective(text: string): Directive | undefined {
  const match = DIRECTIVE.exec(text)
  if (!match) return undefined
  const rest = (match[2] ?? '').trim()
  const separator = REASON_SEPARATOR.exec(rest)
  const list = separator ? rest.slice(0, separator.index) : rest
  const reason = separator ? rest.slice(separator.index + separator[0].length).trim() : ''
  return {
    kind: match[1] as Directive['kind'],
    rules: list
      .split(',')
      .map((rule) => rule.trim())
      .filter(Boolean),
    reason,
  }
}

const globPattern = (glob: string): RegExp => {
  const source = glob
    .replaceAll('\\', '/')
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('\u0000', '.*')
  return new RegExp(`(?:^|/)${source}${glob.endsWith('/') ? '.*' : ''}$`)
}

function inDeepRender(filename: string, options: readonly unknown[]): boolean {
  const config = options[0] as { deepRender?: readonly string[] } | undefined
  const path = filename.replaceAll('\\', '/')
  return (config?.deepRender ?? []).some((glob) => globPattern(glob).test(path))
}

function commentsOf(context: HostContext): readonly Comment[] {
  return context.sourceCode?.getAllComments() ?? []
}

export const missingReason: AstForm = {
  id: 'missing-reason',
  detect: ({ context, report }) => ({
    'Program:exit'() {
      for (const comment of commentsOf(context as HostContext)) {
        const directive = parseDirective(comment.value)
        if (directive && directive.reason === '') report(comment, 'disable directive')
      }
    },
  }),
  fix: 'End the directive with -- <why>, e.g. // oxlint-disable-next-line basalt/x -- <why>',
  next: 'Fix the finding at its source instead of waiving it',
  fixture: 'structure-rest/waiver-needs-reason-missing-reason.tsx',
}

export const fileLevelScope: AstForm = {
  id: 'file-level-scope',
  detect: ({ context, report }) => ({
    'Program:exit'() {
      const host = context as HostContext
      const filename = host.physicalFilename ?? host.filename ?? ''
      const deep = inDeepRender(filename, context.options)
      for (const comment of commentsOf(host)) {
        const directive = parseDirective(comment.value)
        if (directive?.kind !== 'disable') continue
        const unlisted = directive.rules.filter((rule) => !FILE_WAIVABLE.has(rule))
        if (directive.rules.length > 0 && unlisted.length === 0 && deep) continue
        report(comment, directive.rules.length > 0 ? directive.rules.join(', ') : 'all rules')
      }
    },
  }),
  fix: 'Waive the line (oxlint-disable-next-line <rule> -- <why>); a file-level waiver is only colour-literal, shadcn/no-inline-styles or raw-scroll on a path in manifest.deepRender',
  next: 'Declare the file in manifest.deepRender, or fix the sites at source',
  fixture: 'structure-rest/waiver-needs-reason-file-level-scope.tsx',
}

export const waiverRules = defineRules({
  'waiver-needs-reason': {
    family: 'structure',
    profiles: ['bridge', 'parts', 'app'],
    defect:
      'linewatch disarmed a file by mentioning the directive token (I1); a bare waiver widened the guard (I2)',
    forms: [missingReason, fileLevelScope],
    schema: [
      {
        type: 'object',
        properties: { deepRender: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
})
