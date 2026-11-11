/**
 * The output format of the docs extractor (skills-agent-layer 3.1), as a pure function.
 *
 * Types and formatting only: the TypeScript-compiler walk that produces an `ExportInfo` is a later
 * lane's. Fixing the format first lets that lane, the `gen --check` gate and the skills read the
 * same six frontmatter keys. JSDoc is required on every public export, so an export that lacks it
 * is reported rather than rendered with an empty field.
 */

/** The JSDoc an export carries: the summary line and the two routing tags. */
export interface ExportJsdoc {
  /** First paragraph of the comment. */
  summary: string
  /** `@useWhen`: the situation this export is for. */
  useWhen: string
  /** `@neverWhen`: the situation that wants a different export. */
  neverWhen: string
}

/** What the extractor learned about one public export. */
export interface ExportInfo {
  /** Export name, e.g. `Button`. */
  name: string
  /** Import specifier, e.g. `basalt-ui/ui/button`. */
  subpath: string
  /** Optional peer packages a consumer must install to use it. */
  peers: readonly string[]
  /** `data-slot` names the component renders. */
  slots: readonly string[]
  /** Null when the export has no JSDoc at all. */
  jsdoc: ExportJsdoc | null
}

/** A rule an export broke; `field` names what is missing. */
export interface DocProblem {
  name: string
  field: 'jsdoc' | 'summary' | 'useWhen' | 'neverWhen'
  message: string
}

/** The frontmatter keys, in output order. `use when` and `never when` keep their spaces. */
export const FRONTMATTER_KEYS = [
  'name',
  'use when',
  'never when',
  'subpath',
  'peers',
  'slots',
] as const

/** The rendered `docs/<export>.md` text, plus every rule the export broke (empty when clean). */
export interface FormattedDoc {
  markdown: string
  problems: DocProblem[]
}

/** One line, quoted unless it is a plain YAML word: `@`, `:`, `,`, `]` and spaces all force quotes. */
function scalar(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  // Single quotes, the form oxfmt writes, so the formatter never rewrites a generated doc.
  return /^[\w][\w./-]*$/.test(flat) ? flat : `'${flat.replaceAll("'", "''")}'`
}

const list = (items: readonly string[]): string => `[${items.map(scalar).join(', ')}]`

/** Problems for one export. A missing JSDoc is one problem; a partial one is a problem per gap. */
export function checkExport(info: ExportInfo): DocProblem[] {
  if (info.jsdoc === null) {
    return [{ name: info.name, field: 'jsdoc', message: `${info.name}: JSDoc is required` }]
  }
  const gaps: Array<[DocProblem['field'], string, string]> = [
    ['summary', info.jsdoc.summary, 'a summary'],
    ['useWhen', info.jsdoc.useWhen, '@useWhen'],
    ['neverWhen', info.jsdoc.neverWhen, '@neverWhen'],
  ]
  return gaps
    .filter(([, text]) => text.trim() === '')
    .map(([field, , what]) => ({
      name: info.name,
      field,
      message: `${info.name}: JSDoc lacks ${what}`,
    }))
}

/** Render one export as `docs/<export>.md`: six frontmatter keys, then the summary. */
export function formatExportDoc(info: ExportInfo): FormattedDoc {
  const jsdoc = info.jsdoc
  const frontmatter = [
    `name: ${scalar(info.name)}`,
    `use when: ${scalar(jsdoc?.useWhen ?? '')}`,
    `never when: ${scalar(jsdoc?.neverWhen ?? '')}`,
    `subpath: ${scalar(info.subpath)}`,
    `peers: ${list(info.peers)}`,
    `slots: ${list(info.slots)}`,
  ]
  const body = jsdoc?.summary.trim() ?? ''
  const markdown = `---\n${frontmatter.join('\n')}\n---\n\n# ${info.name}\n${body === '' ? '' : `\n${body}\n`}`
  return { markdown, problems: checkExport(info) }
}
