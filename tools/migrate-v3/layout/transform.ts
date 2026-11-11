import { Project, ScriptKind, SyntaxKind, ts } from 'ts-morph'
import type { JsxAttribute, JsxOpeningElement, JsxSelfClosingElement, SourceFile } from 'ts-morph'
import { convert } from './convert.ts'
import type { Conversion, Prop } from './convert.ts'
import { readAttribute } from './read.ts'
import type { Value } from './read.ts'
import { STYLE_PROPS, TARGETS, isPassThrough } from './tables.ts'

export type WorklistKind =
  | 'unconverted-target'
  | 'composite-style-prop'
  | 'responsive-prop'
  | 'latent-bug'
  | 'parse'
export type WorklistItem = {
  file: string
  line: number
  tag: string
  prop: string
  reason: string
  kind: WorklistKind
}
export type TransformResult = {
  text: string
  /** Elements rewritten. */
  converted: number
  /** Target elements seen (converted plus left in place). */
  targets: number
  worklist: WorklistItem[]
}
export type TransformOptions = { file: string; cnImport: string }

type Edit = { start: number; end: number; text: string }

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { jsx: ts.JsxEmit.Preserve },
})

/** Local name to imported name for every named import from `@mantine/core`. */
function mantineImports(sf: SourceFile): Map<string, string> {
  const locals = new Map<string, string>()
  for (const decl of sf.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue() !== '@mantine/core') continue
    for (const n of decl.getNamedImports()) {
      locals.set(n.getAliasNode()?.getText() ?? n.getName(), n.getName())
    }
  }
  return locals
}

function isResponsive(v: Value): boolean {
  return v.kind === 'resp'
}

type ExistingClass = { literal: string } | { expression: string }

function classAttribute(res: Conversion, existing: ExistingClass | null) {
  const literal = res.classes.join(' ')
  const parts: string[] = []
  if (literal) parts.push(JSON.stringify(literal))
  for (const c of res.conds)
    parts.push(`${c.test} ? ${JSON.stringify(c.a)} : ${JSON.stringify(c.b)}`)

  // A static className next to static classes is one string, no helper needed.
  if (existing && 'literal' in existing && res.conds.length === 0) {
    const joined = [literal, existing.literal].filter(Boolean).join(' ')
    return { attribute: joined ? `className=${JSON.stringify(joined)}` : '', usesCn: false }
  }
  if (existing)
    parts.push('expression' in existing ? existing.expression : JSON.stringify(existing.literal))
  if (parts.length === 0) return { attribute: '', usesCn: false }
  if (parts.length === 1 && !existing) {
    return {
      attribute: res.conds.length ? `className={${parts[0]}}` : `className=${parts[0]}`,
      usesCn: false,
    }
  }
  if (parts.length === 1) return { attribute: `className={${parts[0]}}`, usesCn: false }
  return { attribute: `className={cn(${parts.join(', ')})}`, usesCn: true }
}

function propsOf(el: JsxOpeningElement | JsxSelfClosingElement) {
  const props: Prop[] = []
  const attrs = new Map<string, JsxAttribute>()
  let spread = false
  let existing: ExistingClass | null = null
  for (const a of el.getAttributes()) {
    if (a.getKind() === SyntaxKind.JsxSpreadAttribute) {
      spread = true
      continue
    }
    const attr = a as JsxAttribute
    const name = attr.getNameNode().getText()
    const value = readAttribute(attr)
    attrs.set(name, attr)
    props.push({ name, value })
    if (name === 'className') {
      const expression = attr
        .getInitializer()
        ?.asKind(SyntaxKind.JsxExpression)
        ?.getExpression()
        ?.getText()
      existing =
        value.kind === 'lit'
          ? { literal: String(value.v) }
          : { expression: expression ?? 'undefined' }
    }
  }
  return { props, attrs, spread, existing }
}

let fileCounter = 0

export function transformSource(source: string, opts: TransformOptions): TransformResult {
  const worklist: WorklistItem[] = []
  const sf = project.createSourceFile(`/migrate-${++fileCounter}.tsx`, source, {
    scriptKind: ScriptKind.TSX,
  })
  try {
    const syntactic = project.getProgram().getSyntacticDiagnostics(sf)
    if (syntactic.length > 0) {
      worklist.push({
        file: opts.file,
        line: 1,
        tag: '-',
        prop: '-',
        reason: 'file does not parse; skipped',
        kind: 'parse',
      })
      return { text: source, converted: 0, targets: 0, worklist }
    }

    const locals = mantineImports(sf)
    if (locals.size === 0) return { text: source, converted: 0, targets: 0, worklist }

    const edits: Edit[] = []
    let usesCn = false
    let converted = 0
    let targets = 0

    // Outer elements first, so an element nested in a converted tag's attributes is seen as nested.
    const elements = [
      ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ].toSorted((a, b) => a.getStart() - b.getStart())
    const convertedTags: { start: number; end: number }[] = []
    const replacedNames = new Set<number>() // tag-name identifiers that no longer exist after the rewrite
    for (const el of elements) {
      const tagText = el.getTagNameNode().getText()
      const root = tagText.split('.')[0]!
      const imported = locals.get(root)
      if (imported === undefined) continue
      const line = el.getStartLineNumber()
      const add = (prop: string, reason: string, kind: WorklistKind) =>
        worklist.push({ file: opts.file, line, tag: tagText, prop, reason, kind })

      const isTarget = tagText === root && TARGETS.has(imported)
      const { props, spread, existing } = propsOf(el)

      if (!isTarget) {
        // A composite takes no className, so its style props cannot be rewritten in place.
        for (const { name, value } of props) {
          if (isPassThrough(name)) continue
          if (STYLE_PROPS.has(name)) {
            add(
              name,
              `style prop on a composite, which takes no className: move it to a wrapping layout element, Inset, Section or a Card slot`,
              'composite-style-prop',
            )
          }
          if (isResponsive(value)) {
            add(name, `responsive ${name} on a composite: no class can carry it`, 'responsive-prop')
          }
        }
        continue
      }

      targets++
      const res = convert(imported, props)
      if (spread)
        res.human.push({
          prop: '{...spread}',
          why: 'prop spread: unknown props may include style props',
        })
      if (res.human.length > 0) {
        for (const h of res.human)
          add(h.prop, h.why, h.why.startsWith('latent bug') ? 'latent-bug' : 'unconverted-target')
        continue
      }

      // The opening tag is rewritten whole, so an element inside one of its attributes cannot be
      // edited in the same pass; it is listed and converted by the next run.
      if (convertedTags.some((t) => el.getStart() >= t.start && el.getStart() < t.end)) {
        add(
          '-',
          'inside an attribute of a converted element: run the codemod again',
          'unconverted-target',
        )
        continue
      }
      convertedTags.push({ start: el.getStart(), end: el.getEnd() })
      replacedNames.add(el.getTagNameNode().getStart())
      converted++
      const { attribute, usesCn: needsCn } = classAttribute(res, existing)
      if (needsCn) usesCn = true
      const kept = props
        .filter((p) => isPassThrough(p.name) && p.name !== 'className')
        .map((p) => (el.getAttribute(p.name) as JsxAttribute).getText())
      const attrText = [attribute, ...kept]
        .filter(Boolean)
        .map((x) => ` ${x}`)
        .join('')
      const selfClosing = el.getKind() === SyntaxKind.JsxSelfClosingElement
      edits.push({
        start: el.getStart(),
        end: el.getEnd(),
        text: `<${res.tagName}${attrText}${selfClosing ? ' />' : '>'}`,
      })
      if (!selfClosing) {
        const closing = el
          .getParentOrThrow()
          .asKindOrThrow(SyntaxKind.JsxElement)
          .getClosingElement()
        replacedNames.add(closing.getTagNameNode().getStart())
        edits.push({ start: closing.getStart(), end: closing.getEnd(), text: `</${res.tagName}>` })
      }
    }

    if (converted === 0) return { text: source, converted, targets, worklist }

    // Import cleanup: drop target imports nothing references any more, then add `cn` once.
    const importEdits = rewriteImports(sf, usesCn, opts.cnImport, replacedNames)
    const all = [...edits, ...importEdits].sort((x, y) => y.start - x.start)
    let text = source
    for (const e of all) text = text.slice(0, e.start) + e.text + text.slice(e.end)
    return { text, converted, targets, worklist }
  } finally {
    project.removeSourceFile(sf)
  }
}

function rewriteImports(
  sf: SourceFile,
  usesCn: boolean,
  cnImport: string,
  replacedNames: Set<number>,
): Edit[] {
  const out: Edit[] = []
  // An identifier is still used unless it was a tag name this run rewrote; one inside a kept attribute stays.
  const stillUsed = (local: string) =>
    sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
      if (id.getText() !== local || replacedNames.has(id.getStart())) return false
      const parent = id.getParent()
      if (!parent || parent.getKind() === SyntaxKind.ImportSpecifier) return false
      return !(
        parent.getKind() === SyntaxKind.PropertyAccessExpression &&
        parent.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getNameNode() === id
      )
    })

  for (const decl of sf.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue() !== '@mantine/core' || decl.getNamespaceImport()) continue
    const named = decl.getNamedImports()
    const keep = named.filter((n) => {
      const local = n.getAliasNode()?.getText() ?? n.getName()
      return !TARGETS.has(n.getName()) || stillUsed(local)
    })
    if (keep.length === named.length) continue
    const def = decl.getDefaultImport()?.getText()
    if (keep.length === 0 && !def) {
      // Remove the line with the declaration.
      const full = sf.getFullText()
      let next = decl.getEnd()
      // Eat the line break; at the top of the file eat the blank lines after it too.
      const first = decl.getStart() === sf.getStatements()[0]?.getStart()
      while (full[next] === '\n' && (first || next === decl.getEnd())) next++
      out.push({ start: decl.getStart(), end: next, text: '' })
      continue
    }
    const clauses = [
      def,
      keep.length ? `{ ${keep.map((n) => n.getText()).join(', ')} }` : undefined,
    ].filter(Boolean)
    out.push({
      start: decl.getStart(),
      end: decl.getEnd(),
      text: `import ${decl.isTypeOnly() ? 'type ' : ''}${clauses.join(', ')} from '@mantine/core'`,
    })
  }

  if (usesCn) {
    const hasCn = sf
      .getImportDeclarations()
      .some((d) =>
        d.getNamedImports().some((n) => (n.getAliasNode()?.getText() ?? n.getName()) === 'cn'),
      )
    if (!hasCn) {
      const decls = sf.getImportDeclarations()
      const last = decls[decls.length - 1]
      const line = `import { cn } from '${cnImport}'`
      const lastEdit = last ? out.find((e) => e.start === last.getStart()) : undefined
      if (lastEdit) lastEdit.text = lastEdit.text === '' ? `${line}\n` : `${lastEdit.text}\n${line}`
      else
        out.push(
          last
            ? { start: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
            : { start: 0, end: 0, text: `${line}\n` },
        )
    }
  }
  return out
}
