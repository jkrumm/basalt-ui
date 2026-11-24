import { Node, Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type { SourceFile } from 'ts-morph'

/**
 * The 3.0 naming pass on a consumer's code (Issue 3201): a prop a part renamed, a value word a type
 * renamed, and a lint rule id a waiver or a config names. Every rule comes from a row in
 * `packages/basalt-ui/migrations/areas`; nothing here names a part.
 *
 * - a `renamed-prop` row with codemod `props` (`basalt-ui/cards#StatCell.label` to `title`) renames the
 *   attribute on every JSX element whose tag is that import, under any local alias;
 * - a `map` row with codemod `values` (`basalt-ui/table#RowHeight 'compact'` to `'dense'`) rewrites the
 *   string literal where the type's property, attribute or setter takes it (`VALUE_SITES`);
 * - a `rules` entry (`basalt/colour-literal` to `basalt/color-literal`) rewrites the id in any text.
 */

/** A prop rename: `<module>#<Part>.<from>` becomes `<to>`. */
export type PropRow = { id: string; module: string; part: string; from: string; to: string }

/** A value rename: a literal of `<module>#<type>` that reads `from` becomes `to`. */
export type ValueRow = { id: string; module: string; type: string; from: string; to: string }

/** A lint rule id rename, as `basalt/<id>`. */
export type RuleRow = { old: string; new: string }

export type NameChange = { file: string; row: string; line: number; from: string; to: string }

export type NamesResult = { text: string; changes: NameChange[]; parseFailed?: true }

/** Where a value type is written: the property or attribute that takes it, and the setter that does. */
export const VALUE_SITES: Readonly<
  Record<string, { keys: readonly string[]; calls: readonly string[] }>
> = {
  RowHeight: { keys: ['rowHeight'], calls: ['setRowHeight'] },
}

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

/** `basalt-ui/cards#StatCell.label` as its parts, or null for a nested path (`PageBar.tabs.handle`). */
export function parsePropRef(ref: string): { module: string; part: string; prop: string } | null {
  const m = /^([^#]+)#([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(ref)
  return m ? { module: m[1]!, part: m[2]!, prop: m[3]! } : null
}

/** `basalt-ui/table#RowHeight 'compact'` as its parts. */
export function parseValueRef(ref: string): { module: string; type: string; value: string } | null {
  const m = /^([^#]+)#([A-Za-z_$][\w$]*) '([^']*)'$/.exec(ref)
  return m ? { module: m[1]!, type: m[2]!, value: m[3]! } : null
}

/** Local binding name to `<module>#<imported>`, for the named imports of a file. */
function bindings(sf: SourceFile): Map<string, string> {
  const out = new Map<string, string>()
  for (const d of sf.getImportDeclarations()) {
    const module = d.getModuleSpecifierValue()
    for (const n of d.getNamedImports()) {
      out.set(n.getAliasNode()?.getText() ?? n.getName(), `${module}#${n.getName()}`)
    }
  }
  return out
}

function renameProps(
  sf: SourceFile,
  file: string,
  rows: readonly PropRow[],
  changes: NameChange[],
): void {
  if (rows.length === 0) return
  const local = bindings(sf)
  const elements = [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
  for (const el of elements) {
    const ref = local.get(el.getTagNameNode().getText())
    if (ref === undefined) continue
    const attrs = el.getAttributes().filter(Node.isJsxAttribute)
    for (const row of rows) {
      if (`${row.module}#${row.part}` !== ref) continue
      const attr = attrs.find((a) => a.getNameNode().getText() === row.from)
      if (attr === undefined) continue
      // Both names given: the part reads only the new one, so the old one is left for a person.
      if (attrs.some((a) => a.getNameNode().getText() === row.to)) continue
      changes.push({
        file,
        row: row.id,
        line: attr.getStartLineNumber(),
        from: row.from,
        to: row.to,
      })
      attr.getNameNode().replaceWithText(row.to)
    }
  }
}

function renameValues(
  sf: SourceFile,
  file: string,
  rows: readonly ValueRow[],
  changes: NameChange[],
): void {
  const modules = new Set(sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue()))
  for (const literal of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    const parent = literal.getParent()
    let key: string | undefined
    let call: string | undefined
    if (Node.isPropertyAssignment(parent) && parent.getInitializer() === literal)
      key = parent.getName()
    else if (Node.isJsxAttribute(parent)) key = parent.getNameNode().getText()
    else if (Node.isCallExpression(parent)) {
      const callee = parent.getExpression()
      call = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText()
    }
    for (const row of rows) {
      const sites = VALUE_SITES[row.type]
      if (sites === undefined || !modules.has(row.module)) continue
      const at =
        (key !== undefined && sites.keys.includes(key)) ||
        (call !== undefined && sites.calls.includes(call))
      if (!at || literal.getLiteralValue() !== row.from) continue
      changes.push({
        file,
        row: row.id,
        line: literal.getStartLineNumber(),
        from: row.from,
        to: row.to,
      })
      literal.setLiteralValue(row.to)
      break
    }
  }
}

/** Rewrite every rule id an entry renames; `basalt/app-colour` never matches inside `basalt/app-colour-arbitrary`. */
export function renameRuleIds(
  text: string,
  file: string,
  rules: readonly RuleRow[],
): { text: string; changes: NameChange[] } {
  const changes: NameChange[] = []
  let out = text
  for (const rule of rules) {
    const pattern = new RegExp(
      `(?<![\\w/-])${rule.old.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\w-])`,
      'g',
    )
    out = out.replace(pattern, (match, offset: number) => {
      const line = out.slice(0, offset).split('\n').length
      changes.push({ file, row: `rule ${rule.old}`, line, from: rule.old, to: rule.new })
      return rule.new
    })
  }
  return { text: out, changes }
}

let fileCounter = 0

/** One file's text through the prop, value and rule-id renames. */
export function transformNames(
  source: string,
  opts: {
    file: string
    props: readonly PropRow[]
    values: readonly ValueRow[]
    rules: readonly RuleRow[]
  },
): NamesResult {
  const changes: NameChange[] = []
  let text = source
  if (/\.[cm]?[jt]sx?$/.test(opts.file)) {
    const scriptKind =
      /\.[cm]?tsx?$/.test(opts.file) && !opts.file.endsWith('x') ? ScriptKind.TS : ScriptKind.TSX
    const sf = project.createSourceFile(`/names-${++fileCounter}.tsx`, source, { scriptKind })
    try {
      if (project.getProgram().getSyntacticDiagnostics(sf).length > 0)
        return { text: source, changes, parseFailed: true }
      renameProps(sf, opts.file, opts.props, changes)
      renameValues(sf, opts.file, opts.values, changes)
      text = sf.getFullText()
    } finally {
      project.removeSourceFile(sf)
    }
  }
  const ruled = renameRuleIds(text, opts.file, opts.rules)
  return { text: ruled.text, changes: [...changes, ...ruled.changes] }
}
