import { Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type { ImportSpecifier } from 'ts-morph'

/** One pure-rename row (codemod "imports"): `pkg#Symbol` to `pkg/sub#Symbol`. */
export type RenameRow = {
  id: string
  from: { module: string; name: string }
  to: { module: string; name: string }
}

export type ImportChange = { file: string; row: string; from: string; to: string }

export type ImportsResult = { text: string; changes: ImportChange[]; parseFailed?: true }

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

export function parseRef(ref: string): { module: string; name: string } | null {
  const at = ref.lastIndexOf('#')
  if (at <= 0 || at === ref.length - 1) return null
  const module = ref.slice(0, at)
  const name = ref.slice(at + 1)
  return /^[A-Za-z_$][\w$]*$/.test(name) ? { module, name } : null
}

type Spec = {
  imported: string
  alias?: string | undefined
  typeOnly: boolean
  node?: ImportSpecifier
}
type DeclState = {
  module: string
  typeOnly: boolean
  start: number
  end: number
  def?: string | undefined
  ns?: string | undefined
  specs: Spec[]
  dirty: boolean
}

const render = (s: Spec) =>
  `${s.typeOnly ? 'type ' : ''}${s.alias ? `${s.imported} as ${s.alias}` : s.imported}`

function renderDecl(d: Pick<DeclState, 'typeOnly' | 'def' | 'ns' | 'specs' | 'module'>): string {
  const clauses = [
    d.def,
    d.ns ? `* as ${d.ns}` : undefined,
    d.specs.length ? `{ ${d.specs.map(render).join(', ')} }` : undefined,
  ].filter(Boolean)
  return `import ${d.typeOnly ? 'type ' : ''}${clauses.join(', ')} from '${d.module}'`
}

/** Scope-aware uses of an import binding, resolved by the language service (shadowing, exports, destructuring). */
function referenceEdits(node: ImportSpecifier, from: string, to: string) {
  return node
    .getNameNode()
    .asKindOrThrow(SyntaxKind.Identifier)
    .findReferencesAsNodes()
    .filter((id) => id.getParent()?.getKind() !== SyntaxKind.ImportSpecifier)
    .map((id) => {
      const parent = id.getParent()
      // `{ X }` keeps its key; `export { X }` keeps its public name.
      const text =
        parent?.getKind() === SyntaxKind.ShorthandPropertyAssignment
          ? `${from}: ${to}`
          : parent?.getKind() === SyntaxKind.ExportSpecifier &&
              !parent.asKindOrThrow(SyntaxKind.ExportSpecifier).getAliasNode()
            ? `${to} as ${from}`
            : to
      return { start: id.getStart(), end: id.getEnd(), text }
    })
}

let fileCounter = 0

export function transformImports(
  source: string,
  opts: { file: string; rows: RenameRow[] },
): ImportsResult {
  const rowsByFrom = new Map(opts.rows.map((r) => [`${r.from.module}#${r.from.name}`, r]))
  // `<T>expr` casts are legal in .ts and a syntax error in TSX.
  const scriptKind =
    /\.[cm]?tsx?$/.test(opts.file) && !opts.file.endsWith('x') ? ScriptKind.TS : ScriptKind.TSX
  // A path never reused: the language service would otherwise answer from a previous file's program.
  const sf = project.createSourceFile(`/migrate-${++fileCounter}.tsx`, source, { scriptKind })
  try {
    if (project.getProgram().getSyntacticDiagnostics(sf).length > 0)
      return { text: source, changes: [], parseFailed: true }

    const decls: DeclState[] = sf.getImportDeclarations().map((d) => ({
      module: d.getModuleSpecifierValue(),
      typeOnly: d.isTypeOnly(),
      start: d.getStart(),
      end: d.getEnd(),
      def: d.getDefaultImport()?.getText(),
      ns: d.getNamespaceImport()?.getText(),
      specs: d.getNamedImports().map((n) => ({
        imported: n.getName(),
        alias: n.getAliasNode()?.getText(),
        typeOnly: n.isTypeOnly(),
        node: n,
      })),
      dirty: false,
    }))

    const changes: ImportChange[] = []
    const added: { after: DeclState; decl: DeclState }[] = []
    const renames: { node: ImportSpecifier; from: string; to: string }[] = []

    for (const d of decls.slice()) {
      for (const spec of d.specs.slice()) {
        const row = rowsByFrom.get(`${d.module}#${spec.imported}`)
        if (!row) continue
        const to = row.to
        if (to.module === d.module && to.name === spec.imported) continue

        d.specs = d.specs.filter((s) => s !== spec)
        d.dirty = true
        const moved: Spec = { imported: to.name, alias: spec.alias, typeOnly: spec.typeOnly }
        if (!spec.alias && to.name !== spec.imported && spec.node) {
          renames.push({ node: spec.node, from: spec.imported, to: to.name })
        }

        let target = decls.find((t) => t.module === to.module && t.typeOnly === d.typeOnly && !t.ns)
        if (!target) {
          target = {
            module: to.module,
            typeOnly: d.typeOnly,
            start: d.start,
            end: d.end,
            specs: [],
            dirty: true,
          }
          added.push({ after: d, decl: target })
          decls.push(target)
        }
        if (!target.specs.some((s) => render(s) === render(moved))) target.specs.push(moved)
        target.dirty = true
        changes.push({
          file: opts.file,
          row: row.id,
          from: `${d.module}#${spec.imported}`,
          to: `${to.module}#${to.name}`,
        })
      }
    }
    if (changes.length === 0) return { text: source, changes }

    const edits: { start: number; end: number; text: string }[] = []
    for (const d of decls) {
      if (!d.dirty || added.some((a) => a.decl === d)) continue
      const extra = added
        .filter((a) => a.after === d)
        .map((a) => `\n${renderDecl(a.decl)}`)
        .join('')
      const own = d.specs.length || d.def || d.ns ? renderDecl(d) : ''
      const text = own + (own ? extra : extra.slice(1))
      // A declaration that emptied out takes its line break with it.
      const end = text === '' && source[d.end] === '\n' ? d.end + 1 : d.end
      edits.push({ start: d.start, end, text })
    }
    // New declarations whose source declaration is itself unchanged cannot occur: a move dirties it.

    // A changed symbol name is rewritten at every use of the binding.
    for (const { node, from, to } of renames) edits.push(...referenceEdits(node, from, to))

    let text = source
    for (const e of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, e.start) + e.text + text.slice(e.end)
    return { text, changes }
  } finally {
    project.removeSourceFile(sf)
  }
}
