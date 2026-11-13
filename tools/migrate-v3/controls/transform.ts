import { Node, Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type {
  CallExpression,
  ImportDeclaration,
  JsxAttribute,
  JsxElement,
  JsxOpeningElement,
  JsxSelfClosingElement,
  SourceFile,
} from 'ts-morph'

/** The reasons a worklist item can carry; the report is grouped by them. */
export type Reason =
  | 'parse'
  | 'create-search-store'
  | 'create-local-store'
  | 'url-persist'
  | 'link-search'
  | 'validate-search'
  | 'filterset-child'
  | 'filter-prop'
  | 'filter-label'
  | 'standalone-filter'
  | 'form-section-prop'
  | 'form-footer-props'
  | 'custom-picker'
  | 'rename-conflict'
  | 'manual-row'

export type WorklistItem = {
  file: string
  line: number
  reason: Reason
  /** The migration row that owns the site (`controls.json` or `state.json`). */
  row: string
  text: string
  /** The remembered-values recipe stub, on a `url-persist` item. */
  stub?: string
}

export type ControlsResult = {
  text: string
  /** `<FilterSet>` elements rewritten to `specs`. */
  filterSets: number
  /** `FormSection` and `FormActions` renames. */
  renames: number
  worklist: WorklistItem[]
  parseFailed?: true
}

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

const BASALT = /^basalt-ui(\/|$)/

/** The filters a `FilterSet` child can be, with the props each one hands to `spec(...)`. */
const FILTERS: Record<string, { row: string; props: readonly string[] }> = {
  SelectFilter: { row: 'ctl-SelectFilter', props: ['options', 'clearable', 'placeholder'] },
  MultiSelectFilter: {
    row: 'ctl-MultiSelectFilter',
    props: ['options', 'clearable', 'placeholder'],
  },
  ToggleFilter: { row: 'ctl-ToggleFilter', props: ['clearable'] },
  SearchFilter: { row: 'ctl-SearchFilter', props: ['placeholder', 'clearable'] },
  NumberFilter: { row: 'ctl-NumberFilter', props: ['placeholder', 'clearable'] },
  RangeFilter: { row: 'ctl-RangeFilter', props: ['clearable'] },
}
const SPEC_ORDER = ['options', 'clearable', 'placeholder'] as const

/** A removed symbol with a manual row: listed once at its import, never rewritten. */
const MANUAL: Record<string, { row: string; to: string; modules: readonly string[] }> = {
  createPersistedState: {
    row: 'st-createPersistedState',
    to: 'persisted(key, opts).use()',
    modules: ['basalt-ui/state'],
  },
  usePersistedOrLocal: {
    row: 'st-usePersistedOrLocal',
    to: 'persisted(key, opts).use()',
    modules: ['basalt-ui/state'],
  },
  externalField: {
    row: 'ctl-externalField',
    to: 'externalField(store, { key, kind, fallback })',
    modules: ['basalt-ui/state'],
  },
  SyncButton: {
    row: 'ctl-SyncButton',
    to: 'RefreshButton from basalt-ui/page',
    modules: ['basalt-ui/controls'],
  },
  FormGroup: {
    row: 'ctl-FormGroup',
    to: 'FormField rows in a fieldset or a Section',
    modules: ['basalt-ui/controls'],
  },
  FormStateProvider: {
    row: 'ctl-FormStateProvider',
    to: '<fieldset disabled>',
    modules: ['basalt-ui/forms'],
  },
  useFormSubmit: {
    row: 'ctl-useFormSubmit',
    to: 'toSubmitErrors(save)',
    modules: ['basalt-ui/forms'],
  },
  useFormDraft: {
    row: 'ctl-useFormDraft',
    to: 'useFormDraft(form, { key, version, schema, owner })',
    modules: ['basalt-ui/forms'],
  },
  useBasaltForm: {
    row: 'ctl-useBasaltForm',
    to: 'useForm from TanStack Form',
    modules: ['basalt-ui/forms'],
  },
  inputProps: {
    row: 'ctl-inputProps',
    to: 'FormField around form.Field',
    modules: ['basalt-ui/forms'],
  },
  fieldKey: {
    row: 'ctl-fieldKey',
    to: 'the TanStack Form field key',
    modules: ['basalt-ui/forms'],
  },
}

const FORM_SECTION_PROPS = new Set(['title', 'subtitle', 'icon', 'info', 'key'])

let fileCounter = 0
const noAdd = () => {}

const quote = (s: string) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`)

type Local = { module: string; imported: string; decl: ImportDeclaration }

/** Local binding name to where it came from, for every named import of a basalt-ui module. */
function basaltLocals(sf: SourceFile): Map<string, Local> {
  const out = new Map<string, Local>()
  for (const decl of sf.getImportDeclarations()) {
    const module = decl.getModuleSpecifierValue()
    if (!BASALT.test(module) || decl.isTypeOnly()) continue
    for (const spec of decl.getNamedImports()) {
      if (spec.isTypeOnly()) continue
      out.set(spec.getAliasNode()?.getText() ?? spec.getName(), {
        module,
        imported: spec.getName(),
        decl,
      })
    }
  }
  return out
}

const lineOf = (node: Node) => node.getStartLineNumber()

function tagName(el: JsxElement | JsxSelfClosingElement): string {
  return Node.isJsxElement(el)
    ? el.getOpeningElement().getTagNameNode().getText()
    : el.getTagNameNode().getText()
}

function attributesOf(el: JsxElement | JsxSelfClosingElement) {
  return Node.isJsxElement(el) ? el.getOpeningElement().getAttributes() : el.getAttributes()
}

/** `label="A"` to `'A'`, `label={x}` to `x`, a bare `clearable` to `true`; null when it has no value. */
function valueText(attr: JsxAttribute): string | null {
  const init = attr.getInitializer()
  if (init === undefined) return 'true'
  if (Node.isStringLiteral(init)) {
    // A JSX attribute decodes entities and takes no escapes; a JS string does the opposite.
    const text = init.getLiteralText()
    return /[&\\\n\r]/.test(text) ? null : quote(text)
  }
  if (Node.isJsxExpression(init)) {
    const e = init.getExpression()
    if (e !== undefined && Node.isStringLiteral(e)) return quote(e.getLiteralText())
    return e?.getText() ?? null
  }
  return null
}

function hasIdentifier(sf: SourceFile, name: string): boolean {
  return sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
    if (id.getText() !== name) return false
    const parent = id.getParent()
    if (Node.isImportSpecifier(parent)) return false
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return false
    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return false
    return true
  })
}

/** Whether `name` is bound in the file by anything other than a basalt-ui import. */
function boundElsewhere(sf: SourceFile, name: string, locals: Map<string, Local>): boolean {
  return !locals.has(name) && hasIdentifier(sf, name)
}

function propertyNames(o: Node | undefined): Map<string, Node> {
  const out = new Map<string, Node>()
  if (o === undefined || !Node.isObjectLiteralExpression(o)) return out
  for (const p of o.getProperties()) {
    if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
      out.set(p.getName(), p)
    }
  }
  return out
}

const initOf = (node: Node | undefined): Node | undefined =>
  node !== undefined && Node.isPropertyAssignment(node) ? node.getInitializer() : undefined

function literalOf(node: Node | undefined): unknown {
  const init = initOf(node)
  if (init === undefined) return undefined
  if (init.getKind() === SyntaxKind.TrueKeyword) return true
  if (init.getKind() === SyntaxKind.FalseKeyword) return false
  return undefined
}

type StoreField = { name: string; url: boolean; persist: boolean; fallback: string }

/** The fields of a store definition, with the lane flags 2.x resolved (`url` and `persist` default true). */
function storeFields(
  call: CallExpression,
  defaultUrl: boolean,
): { key: string | null; fields: StoreField[] } {
  const arg = call.getArguments()[0]
  const top = propertyNames(arg)
  const keyNode = initOf(top.get('key'))
  const key = keyNode && Node.isStringLiteral(keyNode) ? keyNode.getLiteralText() : null
  const fieldsObj = initOf(top.get('fields'))
  const fields: StoreField[] = []
  if (fieldsObj === undefined || !Node.isObjectLiteralExpression(fieldsObj)) {
    return { key, fields }
  }
  for (const p of fieldsObj.getProperties()) {
    if (!Node.isPropertyAssignment(p)) continue
    const init = p.getInitializer()
    if (init === undefined || !Node.isCallExpression(init)) continue
    let url = defaultUrl
    let persist = true
    let fallback = '<fallback>'
    const args = init.getArguments()
    for (const a of args) {
      const props = propertyNames(a)
      const lane = literalOf(props.get('url'))
      if (lane === false || lane === true) url = lane
      if (literalOf(props.get('persist')) === false) persist = false
      fallback = initOf(props.get('fallback'))?.getText() ?? fallback
    }
    const second = args[1]
    if (
      fallback === '<fallback>' &&
      second !== undefined &&
      !Node.isObjectLiteralExpression(second)
    ) {
      fallback = second.getText()
    }
    fields.push({ name: p.getName(), url, persist, fallback })
  }
  return { key, fields }
}

function recipeStub(key: string, fields: StoreField[]): string {
  // The 2.x envelope holds ONE record per store, `{ fieldName: value }`: one persisted() per store.
  const shape = fields.map((f) => `${f.name}?: unknown`).join('; ')
  return [
    '// remembered-values recipe: packages/basalt-ui/docs/recipes/remembered-values.md',
    `const remembered = persisted<{ ${shape} }>('${key}', { version: 1, initial: {} })`,
    ...fields.map(
      (f) => `// ${f.name}: validate remembered.get().${f.name}; fallback ${f.fallback}`,
    ),
    `// storage: basalt:${key} is read as it stands (same key, same version); delete it where no recipe is adopted`,
  ].join('\n')
}

/** The variable a store definition is assigned to, through a chained `.labels(...)`. */
function storeVariable(call: CallExpression): string | null {
  let node: Node = call
  for (;;) {
    const parent = node.getParent()
    if (parent === undefined) return null
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === node) {
      const outer = parent.getParent()
      if (outer !== undefined && Node.isCallExpression(outer)) {
        node = outer
        continue
      }
      return null
    }
    if (Node.isVariableDeclaration(parent) && parent.getInitializer() === node) {
      return parent.getName()
    }
    return null
  }
}

export type TransformOptions = { file: string }

export function transformSource(source: string, opts: TransformOptions): ControlsResult {
  const worklist: WorklistItem[] = []
  const add = (node: Node, reason: Reason, row: string, text: string, stub?: string) =>
    worklist.push({
      file: opts.file,
      line: lineOf(node),
      reason,
      row,
      text,
      ...(stub === undefined ? {} : { stub }),
    })

  const sf = project.createSourceFile(`/controls-${++fileCounter}.tsx`, source, {
    scriptKind: ScriptKind.TSX,
  })
  try {
    if (project.getProgram().getSyntacticDiagnostics(sf).length > 0) {
      worklist.push({
        file: opts.file,
        line: 1,
        reason: 'parse',
        row: '-',
        text: 'file does not parse; skipped',
      })
      return { text: source, filterSets: 0, renames: 0, worklist, parseFailed: true }
    }
    const first = basaltLocals(sf)
    if (first.size === 0) return { text: source, filterSets: 0, renames: 0, worklist }

    // Pass 1 reads the untouched file, so every line number is the input's. Pass 2 edits it.
    flagStores(sf, first, add)
    flagManualImports(first, add)
    flagCustomPicker(sf, first, add)
    convertFilterSets(sf, add, false)
    renameFormParts(sf, add, false)
    flagStandaloneFilters(sf, add)
    const filterSets = convertFilterSets(sf, noAdd, true)
    const renames = renameFormParts(sf, noAdd, true)
    return { text: sf.getFullText(), filterSets, renames, worklist }
  } finally {
    project.removeSourceFile(sf)
  }
}

type Add = (node: Node, reason: Reason, row: string, text: string, stub?: string) => void

function flagStores(sf: SourceFile, locals: Map<string, Local>, add: Add) {
  const stores = new Set<string>()
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression()
    if (!Node.isIdentifier(callee)) continue
    const local = locals.get(callee.getText())
    if (local === undefined) continue
    if (local.imported !== 'createSearchStore' && local.imported !== 'createLocalStore') continue
    // createLocalStore has no URL lane: only an explicit `url: true` declares one.
    const { key, fields } = storeFields(call, local.imported === 'createSearchStore')
    const v = storeVariable(call)
    if (v !== null) stores.add(v)
    const urlFields = fields.filter((f) => f.url)
    const name = key ?? '<computed key>'
    if (local.imported === 'createSearchStore') {
      add(
        call,
        'create-search-store',
        'ctl-createSearchStore',
        `createSearchStore '${name}' to defineControls({ id: '${name}', scope: 'page', fields }); ${fields.length} field(s)`,
      )
    } else if (urlFields.length === 0 && fields.length > 0) {
      add(
        call,
        'create-local-store',
        'st-createLocalStore',
        `createLocalStore '${name}' has no URL field: persisted('${name}', { version, initial }).use()`,
      )
    } else {
      add(
        call,
        'create-local-store',
        'ctl-createLocalStore',
        `createLocalStore '${name}' declares a URL field: defineControls({ id: '${name}', fields })`,
      )
    }
    const mirrored = fields.filter((f) => f.url && f.persist)
    if (mirrored.length > 0 && key !== null) {
      add(
        call,
        'url-persist',
        'ctl-url-persist',
        `${mirrored.map((f) => f.name).join(', ')}: the 2.x persist mirror (basalt:${key}) is removed; adopt the recipe or drop it, never both silently`,
        recipeStub(key, mirrored),
      )
    }
  }
  if (stores.size === 0) return
  for (const access of sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const target = access.getExpression()
    if (!Node.isIdentifier(target) || !stores.has(target.getText())) continue
    if (access.getName() === 'linkSearch') {
      add(
        access,
        'link-search',
        'ctl-linkSearch',
        `${access.getText()}: a link by reference is the typed Link`,
      )
    }
    if (access.getName() === 'validateSearch') {
      add(
        access,
        'validate-search',
        'ctl-validateSearch',
        `${access.getText()}: extend() on the route, aliases for a migrating wrapper`,
      )
    }
  }
}

function flagManualImports(locals: Map<string, Local>, add: Add) {
  for (const [, local] of locals) {
    const entry = MANUAL[local.imported]
    if (entry === undefined || !entry.modules.includes(local.module)) continue
    const spec = local.decl.getNamedImports().find((s) => s.getName() === local.imported)
    add(spec ?? local.decl, 'manual-row', entry.row, `${local.imported} to ${entry.to}`)
  }
}

function flagCustomPicker(sf: SourceFile, locals: Map<string, Local>, add: Add) {
  const picker = [...locals].find(([, l]) => l.imported === 'DateRangePicker')
  if (picker === undefined) return
  const tag = picker[0]
  for (const el of [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ]) {
    if (el.getTagNameNode().getText() !== tag) continue
    const hit = el
      .getAttributes()
      .find((a) => Node.isJsxAttribute(a) && a.getNameNode().getText() === 'customPicker')
    if (hit) add(hit, 'custom-picker', 'ctl-customPicker', 'customPicker is removed')
  }
}

type FilterEl = JsxSelfClosingElement | JsxElement

function filterChildren(set: JsxElement): { children: FilterEl[]; blocker: Node | null } {
  const children: FilterEl[] = []
  for (const child of set.getJsxChildren()) {
    if (Node.isJsxText(child)) {
      if (child.getText().trim() === '') continue
      return { children, blocker: child }
    }
    if (Node.isJsxSelfClosingElement(child)) {
      children.push(child)
      continue
    }
    if (
      Node.isJsxElement(child) &&
      child.getJsxChildren().every((c) => Node.isJsxText(c) && c.getText().trim() === '')
    ) {
      children.push(child)
      continue
    }
    return { children, blocker: child }
  }
  return { children, blocker: null }
}

function convertFilterSets(sf: SourceFile, add: Add, apply: boolean): number {
  const locals = basaltLocals(sf)
  const setLocal = [...locals].find(
    ([, l]) => l.imported === 'FilterSet' && l.module === 'basalt-ui/controls',
  )
  if (setLocal === undefined) return 0
  if (boundElsewhere(sf, 'spec', locals) && !hasSpecImport(locals)) {
    add(
      sf,
      'rename-conflict',
      'ctl-FilterSet-children',
      "an identifier named 'spec' is already bound in this file; rename it, then re-run",
    )
    return 0
  }
  const filterNames = new Map<string, string>()
  for (const [local, l] of locals) {
    if (l.module === 'basalt-ui/controls' && l.imported in FILTERS)
      filterNames.set(local, l.imported)
  }
  const sets = sf
    .getDescendantsOfKind(SyntaxKind.JsxElement)
    .filter((el) => tagName(el) === setLocal[0])
  // Last first: replacing a late element never moves an early one.
  let converted = 0
  const edits: { start: number; end: number; text: string }[] = []
  for (const set of sets) {
    const { children, blocker } = filterChildren(set)
    if (blocker !== null) {
      add(
        blocker,
        'filterset-child',
        'ctl-FilterSet-children',
        `${blocker.getText().trim().slice(0, 60)} is not a plain filter element; the FilterSet stays`,
      )
      continue
    }
    if (children.length === 0) continue
    const specs: string[] = []
    let ok = true
    for (const child of children) {
      const name = filterNames.get(tagName(child))
      if (name === undefined) {
        add(
          child,
          'filterset-child',
          'ctl-FilterSet-children',
          `<${tagName(child)}> is not a basalt filter; the FilterSet stays`,
        )
        ok = false
        continue
      }
      const spec = specFor(child, FILTERS[name]!, add)
      if (spec === null) ok = false
      else specs.push(spec)
    }
    if (!ok) continue
    converted++
    if (!apply) continue
    const opening = set.getOpeningElement()
    const kept = opening.getAttributes().map((a) => a.getText())
    const indent = /^[ \t]*/.exec(sf.getFullText().slice(opening.getStartLinePos()))![0]
    const lines = [
      `<${setLocal[0]}`,
      ...kept.map((a) => `${indent}  ${a}`),
      `${indent}  specs={[`,
      ...specs.map((s) => `${indent}    ${s},`),
      `${indent}  ]}`,
      `${indent}/>`,
    ]
    edits.push({ start: set.getStart(), end: set.getEnd(), text: lines.join('\n') })
  }
  // Spliced last to first, as text: a node-level replace would re-indent and forget siblings.
  if (apply) {
    let text = sf.getFullText()
    for (const e of edits.toReversed()) text = text.slice(0, e.start) + e.text + text.slice(e.end)
    sf.replaceWithText(text)
  }
  if (!apply || converted === 0) return converted
  // Imports: the filters nobody uses any more go, `spec` comes in.
  const after = basaltLocals(sf)
  for (const [local, l] of after) {
    if (l.module !== 'basalt-ui/controls' || !(l.imported in FILTERS)) continue
    if (hasIdentifier(sf, local)) continue
    const spec = l.decl
      .getNamedImports()
      .find((s) => (s.getAliasNode()?.getText() ?? s.getName()) === local)
    spec?.remove()
  }
  const controlsDecl = [...after].find(
    ([, l]) => l.imported === 'FilterSet' && l.module === 'basalt-ui/controls',
  )![1].decl
  if (!hasSpecImport(after)) controlsDecl.addNamedImport('spec')
  for (const decl of sf.getImportDeclarations()) {
    if (
      BASALT.test(decl.getModuleSpecifierValue()) &&
      decl.getNamedImports().length === 0 &&
      decl.getDefaultImport() === undefined &&
      decl.getNamespaceImport() === undefined &&
      decl !== controlsDecl
    ) {
      decl.remove()
    }
  }
  return converted
}

const hasSpecImport = (locals: Map<string, Local>) =>
  [...locals].some(([name, l]) => name === 'spec' && l.imported === 'spec')

/** One `spec(handle, 'Label', { ... })` for a filter element, or null with the reason listed. */
function specFor(
  el: FilterEl,
  filter: { row: string; props: readonly string[] },
  add: Add,
): string | null {
  const values = new Map<string, string>()
  const unmapped: string[] = []
  for (const attr of attributesOf(el)) {
    if (!Node.isJsxAttribute(attr)) {
      unmapped.push('{...spread}')
      continue
    }
    const name = attr.getNameNode().getText()
    const text = valueText(attr)
    if (text === null) {
      unmapped.push(name)
      continue
    }
    if (name === 'field' || name === 'label' || filter.props.includes(name)) {
      values.set(name, text)
    } else unmapped.push(name)
  }
  if (unmapped.length > 0) {
    add(
      el,
      'filter-prop',
      filter.row,
      `<${tagName(el)}> has ${unmapped.join(', ')}, which spec() does not take; the FilterSet stays`,
    )
    return null
  }
  const handle = values.get('field')
  const label = values.get('label')
  if (handle === undefined) {
    add(el, 'filter-prop', filter.row, `<${tagName(el)}> has no field; the FilterSet stays`)
    return null
  }
  if (label === undefined) {
    add(el, 'filter-label', filter.row, `<${tagName(el)}> has no label; spec() requires one`)
    return null
  }
  const options = SPEC_ORDER.filter((p) => values.has(p)).map((p) =>
    p === 'clearable' && values.get(p) === 'true' ? 'clearable: true' : `${p}: ${values.get(p)}`,
  )
  const tail = options.length > 0 ? `, { ${options.join(', ')} }` : ''
  return `spec(${handle}, ${label}${tail})`
}

function renameFormParts(sf: SourceFile, add: Add, apply: boolean): number {
  let renames = 0
  const locals = basaltLocals(sf)
  for (const [local, l] of locals) {
    if (l.module !== 'basalt-ui/controls') continue
    if (l.imported !== 'FormSection' && l.imported !== 'FormActions') continue
    const isSection = l.imported === 'FormSection'
    const target = isSection ? 'Section' : 'FormFooter'
    const row = isSection ? 'ctl-FormSection' : 'ctl-FormActions'
    const tags = [
      ...sf
        .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
        .map((e) => ({ e, node: e.getTagNameNode() })),
      ...sf
        .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
        .map((e) => ({ e, node: e.getTagNameNode() })),
      ...sf
        .getDescendantsOfKind(SyntaxKind.JsxClosingElement)
        .map((e) => ({ e, node: e.getTagNameNode() })),
    ].filter(({ node }) => node.getText() === local)
    const aliased = l.decl.getNamedImports().some((s) => s.getAliasNode()?.getText() === local)
    const bound =
      boundElsewhere(sf, target, locals) ||
      (locals.has(target) && locals.get(target)!.imported !== target)
    const otherRefs = sf
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((id) => id.getText() === local && !Node.isImportSpecifier(id.getParent()))
      .filter((id) => !tags.some(({ node }) => node === id))
    if (!aliased && (bound || otherRefs.length > 0)) {
      add(
        l.decl,
        'rename-conflict',
        row,
        `${l.imported} is not renamed: ${bound ? `'${target}' is already bound here` : 'it is referenced outside JSX tags'}`,
      )
      continue
    }
    if (!apply) {
      for (const { e } of tags) {
        if (Node.isJsxClosingElement(e)) continue
        if (isSection) noteSectionProps(e, row, add)
        else
          add(
            e,
            'form-footer-props',
            row,
            'FormFooter takes form and actions (BarAction data, max five, one primary)',
          )
      }
      renames++
      continue
    }
    // Last tag first: a rewrite never moves an earlier one.
    if (!aliased) for (const { node } of tags.toReversed()) node.replaceWithText(target)
    // The import: one specifier moves or is renamed.
    const spec = l.decl.getNamedImports().find((s) => s.getName() === l.imported)!
    if (isSection) {
      spec.remove()
      moveToPage(sf, aliased ? `Section as ${local}` : 'Section')
    } else if (aliased) {
      spec.setName('FormFooter')
    } else {
      const already = l.decl.getNamedImports().some((s) => s.getName() === 'FormFooter')
      if (already) spec.remove()
      else spec.setName('FormFooter')
    }
    if (l.decl.getNamedImports().length === 0 && l.decl.getDefaultImport() === undefined) {
      l.decl.remove()
    }
    renames++
  }
  return renames
}

function noteSectionProps(e: JsxOpeningElement | JsxSelfClosingElement, row: string, add: Add) {
  const names = e
    .getAttributes()
    .map((a) => (Node.isJsxAttribute(a) ? a.getNameNode().getText() : '{...spread}'))
  const odd = names.filter((n) => !FORM_SECTION_PROPS.has(n))
  const hasTitle = names.includes('title')
  if (odd.length === 0 && hasTitle) return
  add(
    e,
    'form-section-prop',
    row,
    `Section ${hasTitle ? `does not take ${odd.join(', ')}` : 'requires a title'}`,
  )
}

function moveToPage(sf: SourceFile, specifier: string) {
  const [name, alias] = specifier.split(' as ')
  const page = sf
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === 'basalt-ui/page' && !d.isTypeOnly())
  if (page) {
    if (!page.getNamedImports().some((s) => s.getName() === name)) {
      page.addNamedImport(alias ? { name: name!, alias } : { name: name! })
    }
    return
  }
  const anchor = sf
    .getImportDeclarations()
    .findLast((d) => BASALT.test(d.getModuleSpecifierValue()))
  const semi = anchor?.getText().endsWith(';') ? ';' : ''
  const clause = alias ? `${name} as ${alias}` : name
  sf.insertStatements(
    anchor ? anchor.getChildIndex() + 1 : 0,
    `import { ${clause} } from 'basalt-ui/page'${semi}`,
  )
}

function flagStandaloneFilters(sf: SourceFile, add: Add) {
  const locals = basaltLocals(sf)
  const names = new Map<string, string>()
  let setTag = ''
  for (const [local, l] of locals) {
    if (l.module === 'basalt-ui/controls' && l.imported in FILTERS) names.set(local, l.imported)
    if (l.module === 'basalt-ui/controls' && l.imported === 'FilterSet') setTag = local
  }
  if (names.size === 0) return
  const seen = new Set<Node>()
  for (const el of [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ]) {
    const imported = names.get(el.getTagNameNode().getText())
    if (imported === undefined || seen.has(el)) continue
    const inSet = el.getFirstAncestor((a) => Node.isJsxElement(a) && tagName(a) === setTag)
    if (inSet !== undefined) continue
    seen.add(el)
    add(
      el,
      'standalone-filter',
      FILTERS[imported]!.row,
      `<${el.getTagNameNode().getText()}> stays: it is not an only-filter child of a FilterSet, so there is no specs array to move it into`,
    )
  }
}
