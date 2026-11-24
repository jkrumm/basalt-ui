/**
 * `basalt/waiver-needs-reason` (guardrails sections 4 and 8, row 15): a plain plugin rule over
 * `sourceCode.getAllComments()`. Native directives stay the waiver dialect; this rule keeps them
 * honest. A directive counts only at the start of its comment, so a comment that merely mentions
 * the token neither disables anything nor trips the rule (lint-edges S4).
 *
 * - `missing-reason`: a `disable`, `disable-next-line` or `disable-line` directive (oxlint or
 *   eslint spelling) with no `-- <why>`, or whose reason is only a placeholder (`TODO`, `FIXME`,
 *   `TBD`, `XXX`, any case, with trailing punctuation): a reason that says nothing is missing. The
 *   reason text is never read as rule ids.
 * - `file-level-scope`: a file-level `disable` on any rule but `color-literal`,
 *   `shadcn/no-inline-styles` or `raw-scroll`, naming no rule at all, or in a file outside the
 *   `deepRender` option (the paths `manifest.deepRender` declares). A line directive
 *   (`disable-next-line`, `disable-line`) must name a rule id too: with none, even a reasoned one
 *   (`// oxlint-disable-next-line -- the markup is fixed`) silences every rule on the line. Known limit: a `disable-line` naming no rule also silences this
 *   report on its own line in the host, so only the `disable-next-line` spelling is caught.
 *
 * - `renamed-id`: a directive naming a rule id 3.0 renamed (`basalt/colour-literal`); it silences
 *   nothing, so the report names the new id. Held for the whole 3.x line.
 *
 * Option: `{ deepRender: string[] }`, path suffixes or globs (`*`, `**`) matched against the file.
 */
import type { FormContext, Node } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'
import { RENAMED_RULES } from '../../renamed-rules'

type Comment = Node & { readonly value: string }

type HostContext = FormContext['context'] & {
  readonly filename?: string
  readonly physicalFilename?: string
  readonly sourceCode?: { getAllComments(): readonly Comment[] }
}

/** Rules a deep-rendering file may waive file-wide (guardrails section 6, E3). */
export const FILE_WAIVABLE: ReadonlySet<string> = new Set([
  'basalt/color-literal',
  'shadcn/no-inline-styles',
  'basalt/raw-scroll',
  'raw-scroll',
])

const DIRECTIVE = /^\s*(?:oxlint|eslint)-(disable-next-line|disable-line|disable)(?=\s|$)([\s\S]*)$/
/** A prose dash where `--` belongs: oxlint reads every word after it as a rule id. */
const EM_DASH = /\s[\u2013\u2014]\s/
const REASON_SEPARATOR = /(?:^|\s)--+(?:\s|$)/

/** A reason that is only a placeholder tag, `TODO` or `fixme:` and the like. */
const PLACEHOLDER_REASON = /^(?:todo|fixme|tbd|xxx)[\s.:!?,;-]*$/i

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
        if (!directive) continue
        if (directive.reason !== '' && !PLACEHOLDER_REASON.test(directive.reason)) continue
        report(
          comment,
          EM_DASH.test(comment.value) ? 'disable directive with an em dash' : 'disable directive',
        )
      }
    },
  }),
  fix: 'End the directive with `-- <why>` (two hyphens, not an em dash: oxlint reads every word after an em dash as a rule id), e.g. // oxlint-disable-next-line basalt/x -- <why>',
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
        if (!directive) continue
        if (directive.kind !== 'disable') {
          if (directive.rules.length === 0) report(comment, `${directive.kind} naming no rule`)
          continue
        }
        const unlisted = directive.rules.filter((rule) => !FILE_WAIVABLE.has(rule))
        if (directive.rules.length > 0 && unlisted.length === 0 && deep) continue
        report(comment, directive.rules.length > 0 ? directive.rules.join(', ') : 'all rules')
      }
    },
  }),
  fix: 'Name the rule in every directive and waive the line (oxlint-disable-next-line <rule> -- <why>); a file-level waiver is only color-literal, shadcn/no-inline-styles or raw-scroll on a path in manifest.deepRender',
  next: 'Declare the file in manifest.deepRender, or fix the sites at source',
  fixture: 'structure-rest/waiver-needs-reason-file-level-scope.tsx',
}

export const renamedId: AstForm = {
  id: 'renamed-id',
  detect: ({ context, report }) => ({
    'Program:exit'() {
      for (const comment of commentsOf(context as HostContext)) {
        const directive = parseDirective(comment.value)
        if (!directive) continue
        const renamed = directive.rules.flatMap((rule) => {
          const now = RENAMED_RULES[rule]
          return now === undefined ? [] : [`${rule} is now ${now}`]
        })
        if (renamed.length > 0) report(comment, renamed.join(', '))
      }
    },
  }),
  fix: 'Name the rule by its 3.x id: basalt/colour-literal is basalt/color-literal, basalt/fixed-colour is basalt/fixed-color, basalt/app-colour is basalt/app-color; `bun tools/migrate-v3/run.ts names <app>` rewrites them',
  next: 'Fix the finding at its source instead of waiving it',
  fixture: 'structure-rest/waiver-needs-reason-renamed-id.tsx',
}

export const waiverRules = defineRules({
  'waiver-needs-reason': {
    family: 'structure',
    profiles: ['bridge', 'parts', 'app', 'site'],
    defect:
      'linewatch disarmed a file by mentioning the directive token (I1); a bare waiver widened the guard (I2)',
    forms: [missingReason, fileLevelScope, renamedId],
    schema: [
      {
        type: 'object',
        properties: { deepRender: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
})

type Located = { readonly file: string; readonly line: number; readonly id: string }

/**
 * A directive whose reason is not set off with `--` (an em dash, say) makes oxlint read every word
 * of the reason as a rule id and report each as an unused directive. This rule already reports that
 * line once and names the fix, so `basalt-ui lint` drops the per-word noise on the same line.
 */
export function dropMisreadDirectives<T extends Located>(findings: readonly T[]): T[] {
  const at = (f: Located): string => `${f.file}:${f.line}`
  const waived = new Set(findings.filter((f) => f.id === 'basalt/waiver-needs-reason').map(at))
  return findings.filter((f) => f.id !== 'oxlint/unused-directive' || !waived.has(at(f)))
}
