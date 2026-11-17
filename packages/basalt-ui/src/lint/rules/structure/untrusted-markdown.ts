/**
 * `basalt/untrusted-markdown` (guardrails section 4, row 13, as amended by ai-mdx exception 5):
 * `contentTrust` is a required type, but a literal `"trusted"` on model text, `rehype-raw` and MDX
 * evaluation each bypass it. Four forms, none scoped to files that import `basalt-ui/ai`:
 *
 * - `dangerous-html`: `dangerouslySetInnerHTML` whose `__html` is not a string literal, and the DOM
 *   sinks `el.innerHTML = x`, `el.outerHTML = x`, `el.insertAdjacentHTML(pos, x)`,
 *   `el.setHTMLUnsafe(x)` and `Document.parseHTMLUnsafe(x)` with a non-literal value. `<iframe srcDoc={x} />` with a non-literal `srcDoc` (a string literal or a
 *   hole-free template is legal, and so is a frame whose `sandbox` leaves out
 *   `allow-same-origin`) and `x.createContextualFragment(html)` with a non-literal argument
 *   (`document.createRange().createContextualFragment(m.html)`) report too, as does
 *   `document.write` / `writeln` on any `….document` chain (`w?.document.write(m.html)`). A sink reached through
 *   a computed key (`el['innerHTML']`) is not read, nor is `createContextualFragment` called bare.
 *   `new DOMParser().parseFromString(x, 'text/html')` with a non-literal `x` reports too (also
 *   `application/xhtml+xml`): the result is not traced to its insertion (`replaceChildren`,
 *   `append`, `innerHTML`), because parsing alone runs nothing yet every use of the parsed
 *   nodes in the page is the sink (an `onerror` runs once adopted), so the parse of model text is the
 *   site that names it. A literal `x`, or a `text/xml` or `image/svg+xml` parse, passes.
 * - `rehype-raw`: an import, require or re-export (`export { default as x } from 'rehype-raw'`,
 *   `export * from 'rehype-raw'`) of `rehype-raw`, and `allowDangerousHtml: true` in a
 *   `[remarkRehype, { … }]` tuple (`remarkRehype` the default import of `remark-rehype`).
 * - `mdx-evaluate`: `evaluate`/`run` (and their Sync twins) of `@mdx-js/mdx`, by name
 *   import, namespace member or require, and any import of `next-mdx-remote`,
 *   `next-mdx-remote-client` or a subpath of either (`next-mdx-remote-client/rsc`), and
 *   `mdx-bundler/client`.
 *   `compile`/`compileSync` report only in a file that also runs code from a string
 *   (`new Function(code)`, `Function(code)`, `eval`): a build step or a test that compiles authored
 *   MDX into a module is not an evaluation. Known limit: compiled code run in another file passes.
 *   `new Function(…)`, `Function(…)` and `eval(…)` report themselves when any argument is not a
 *   string literal or a hole-free template (`new Function(code)`, `eval(props.source)`); known limit:
 *   `window.eval`, `globalThis.Function` and an aliased `Function` are not read.
 * - `trusted-content`: `contentTrust="trusted"`, or a non-literal `contentTrust={trust}` (a
 *   variable, a conditional, a call: the tier cannot be read, so it is treated as `trusted`),
 *   unless every child is a string literal, an imported binding, or the file matches a glob of
 *   the `authoredContent` option (the manifest's list of source files that render authored text).
 *   A wrapper that forwards its own `contentTrust` prop is a report too: pass the literal at the
 *   call site that knows the source of the text. `<Markdown {...trusted}>` is read when `trusted`
 *   is an object declared in the same file with a `contentTrust` other than the literal
 *   `'untrusted'`; known limit: a spread of props, an import or a call (`{...props}`) cannot be
 *   read by syntax, so it passes.
 *
 * Option: `{ authoredContent: string[] }`, path suffixes or globs (`*`, `**`) matched on the file.
 */
import type { FormContext, Node } from '../../factory'
import type { AstForm } from '../../rule-table'
import { defineRules } from '../../rule-table'

type HostContext = FormContext['context'] & {
  readonly filename?: string
  readonly physicalFilename?: string
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'
const child = (node: Node, key: string): Node | undefined => {
  const value = node[key]
  return isNode(value) ? value : undefined
}
const children = (node: Node, key: string): Node[] => {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}
const text = (node: Node | undefined): string | undefined =>
  node?.type === 'Literal' && typeof node['value'] === 'string' ? node['value'] : undefined
const nameOf = (node: Node | undefined): string | undefined =>
  node?.type === 'Identifier' || node?.type === 'JSXIdentifier'
    ? (node['name'] as string)
    : undefined

const FIX =
  'Render model or agent text with <Markdown contentTrust="untrusted">; contentTrust="trusted" is for text the app authors (a literal, an import or a path in manifest authoredContent), and the untrusted tier shows no raw HTML and no images'
const NEXT =
  'Declare the file in manifest.authoredContent when it renders authored text only, or fix the site at source'

/** A string literal, or a template without holes. */
function isLiteralText(node: Node): boolean {
  if (text(node) !== undefined) return true
  return node.type === 'TemplateLiteral' && children(node, 'expressions').length === 0
}

/** The string a literal or hole-free template holds. */
function literalValue(node: Node): string | undefined {
  const direct = text(node)
  if (direct !== undefined) return direct
  if (node.type !== 'TemplateLiteral' || children(node, 'expressions').length > 0) return undefined
  const [quasi] = children(node, 'quasis')
  const cooked = (quasi?.['value'] as { cooked?: unknown } | undefined)?.cooked
  return typeof cooked === 'string' ? cooked : undefined
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

function inAuthoredContent(context: FormContext['context']): boolean {
  const host = context as HostContext
  const config = context.options[0] as { authoredContent?: readonly string[] } | undefined
  const file = (host.physicalFilename ?? host.filename ?? '').replaceAll('\\', '/')
  return (config?.authoredContent ?? []).some((glob) => globPattern(glob).test(file))
}

/** The module a `require('x')` or `import('x')` names, for a node that is one. */
function loadedModule(node: Node): string | undefined {
  if (node.type === 'ImportExpression') return text(child(node, 'source'))
  if (node.type !== 'CallExpression') return undefined
  if (nameOf(child(node, 'callee')) !== 'require') return undefined
  return text(children(node, 'arguments')[0])
}

/** `compile` returns code a caller runs (`new Function(code)`); it reports beside such a run. */
const MDX_NAMES: Readonly<Record<string, ReadonlySet<string>>> = {
  '@mdx-js/mdx': new Set(['evaluate', 'evaluateSync', 'run', 'runSync', 'compile', 'compileSync']),
}
const COMPILE_NAMES: ReadonlySet<string> = new Set(['compile', 'compileSync'])

/** `new Function(code)`, `Function(code)` or `eval(code)`: a string run as code. */
const runsString = (node: Node): boolean => {
  const name = nameOf(child(node, 'callee'))
  return node.type === 'NewExpression'
    ? name === 'Function'
    : name === 'Function' || name === 'eval'
}

/** Every `next-mdx-remote`, `next-mdx-remote-client` and `mdx-bundler/client` (`getMDXComponent`) entry runs MDX at render: any import reports. */
const NEXT_MDX_REMOTE: readonly string[] = [
  'next-mdx-remote',
  'next-mdx-remote-client',
  'mdx-bundler/client',
]
const isNextMdxRemote = (source: string | undefined): boolean =>
  source !== undefined &&
  NEXT_MDX_REMOTE.some((name) => source === name || source.startsWith(`${name}/`))

const isMdxModule = (source: string | undefined): boolean =>
  source !== undefined && (MDX_NAMES[source] !== undefined || isNextMdxRemote(source))

/** DOM properties that parse a string as markup. */
const HTML_SINKS: ReadonlySet<string> = new Set(['innerHTML', 'outerHTML'])

/**
 * An iframe whose `sandbox` is bare or a literal that leaves out `allow-same-origin`: the document
 * runs in an opaque origin and cannot reach the app, which is how the ai-artifacts recipe previews
 * model HTML. A `sandbox` held in a variable is not read.
 */
function isIsolatedFrame(opening: Node): boolean {
  const sandbox = children(opening, 'attributes').find(
    (attribute) => nameOf(child(attribute, 'name')) === 'sandbox',
  )
  if (!sandbox) return false
  const value = child(sandbox, 'value')
  if (value === undefined) return true
  const tokens = text(value)
  return tokens !== undefined && !tokens.toLowerCase().split(/\s+/).includes('allow-same-origin')
}

const dangerousHtml: AstForm = {
  id: 'dangerous-html',
  detect: ({ report }) => {
    /** `<iframe srcDoc={x} />` parses x as a document; a literal or hole-free template is legal. */
    const reportSrcDoc = (node: Node): void => {
      const opening = node['parent'] as Node | undefined
      if (opening?.type !== 'JSXOpeningElement' || nameOf(child(opening, 'name')) !== 'iframe') {
        return
      }
      const value = child(node, 'value')
      if (value && text(value) !== undefined) return
      const expression =
        value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
      if (expression && isLiteralText(expression)) return
      if (isIsolatedFrame(opening)) return
      report(node, 'iframe srcDoc without a sandbox')
    }
    return {
      JSXAttribute(node) {
        const attribute = nameOf(child(node, 'name'))
        if (attribute === 'srcDoc') return reportSrcDoc(node)
        if (attribute !== 'dangerouslySetInnerHTML') return
        const container = child(node, 'value')
        const value =
          container?.type === 'JSXExpressionContainer' ? child(container, 'expression') : undefined
        if (value?.type === 'ObjectExpression') {
          const html = children(value, 'properties').find((property) => {
            const key = child(property, 'key')
            return property.type === 'Property' && (nameOf(key) ?? text(key)) === '__html'
          })
          const body = html ? child(html, 'value') : undefined
          if (body && isLiteralText(body)) return
        }
        report(node, 'dangerouslySetInnerHTML')
      },
      AssignmentExpression(node) {
        const left = child(node, 'left')
        if (left?.type !== 'MemberExpression' || left['computed'] === true) return
        const property = nameOf(child(left, 'property'))
        const right = child(node, 'right')
        if (property === undefined || !HTML_SINKS.has(property) || !right) return
        if (!isLiteralText(right)) report(node, `.${property} =`)
      },
      CallExpression(node) {
        const callee = child(node, 'callee')
        if (callee?.type !== 'MemberExpression' || callee['computed'] === true) return
        const method = nameOf(child(callee, 'property'))
        if (method === 'write' || method === 'writeln') {
          // `document.write(x)`, `w.document.write(x)`, `w?.document.write(x)`
          const holder = child(callee, 'object')
          const isDocument =
            nameOf(holder) === 'document' ||
            (holder?.type === 'MemberExpression' &&
              holder['computed'] !== true &&
              nameOf(child(holder, 'property')) === 'document')
          const markup = children(node, 'arguments')[0]
          if (isDocument && markup && !isLiteralText(markup)) report(node, `.document.${method}()`)
          return
        }
        if (method === 'parseFromString') {
          const [markup, mime] = children(node, 'arguments')
          const type = mime ? literalValue(mime) : undefined
          if (
            markup &&
            !isLiteralText(markup) &&
            (type === 'text/html' || type === 'application/xhtml+xml')
          ) {
            report(node, `.parseFromString(…, '${type}')`)
          }
          return
        }
        if (method === 'setHTMLUnsafe' || method === 'parseHTMLUnsafe') {
          // `el.setHTMLUnsafe(x)` and `Document.parseHTMLUnsafe(x)` parse x as innerHTML does
          const markup = children(node, 'arguments')[0]
          if (markup && !isLiteralText(markup)) report(node, `.${method}()`)
          return
        }
        if (method === 'createContextualFragment') {
          const markup = children(node, 'arguments')[0]
          if (markup && !isLiteralText(markup)) report(node, '.createContextualFragment()')
          return
        }
        if (method !== 'insertAdjacentHTML') return
        const html = children(node, 'arguments')[1]
        if (html && !isLiteralText(html)) report(node, '.insertAdjacentHTML()')
      },
    }
  },
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/dangerous-html.tsx',
}

/** `{ allowDangerousHtml: true }`: the option that keeps raw HTML nodes for rehype-raw or a stringify. */
const allowsDangerousHtml = (node: Node | undefined): boolean =>
  node?.type === 'ObjectExpression' &&
  children(node, 'properties').some((property) => {
    if (property.type !== 'Property' || property['computed'] === true) return false
    const key = child(property, 'key')
    const value = child(property, 'value')
    return (
      (nameOf(key) ?? text(key)) === 'allowDangerousHtml' &&
      value?.type === 'Literal' &&
      value['value'] === true
    )
  })

const rehypeRaw: AstForm = {
  id: 'rehype-raw',
  detect: ({ report }) => {
    // The default import of `remark-rehype`, whatever it is called, with the options it is given
    // as the tuple `[remarkRehype, { allowDangerousHtml: true }]` or to unified's
    // `.use(remarkRehype, { allowDangerousHtml: true })`.
    const remarkRehype = new Set<string>()
    const options: { node: Node; callee: string | undefined; options: Node | undefined }[] = []
    return {
      ArrayExpression(node) {
        const [plugin, config] = children(node, 'elements')
        if (plugin?.type === 'Identifier')
          options.push({ node, callee: nameOf(plugin), options: config })
      },
      'Program:exit'() {
        for (const found of options) {
          if (
            found.callee &&
            remarkRehype.has(found.callee) &&
            allowsDangerousHtml(found.options)
          ) {
            report(found.node, 'remark-rehype allowDangerousHtml')
          }
        }
      },
      ImportDeclaration(node) {
        const source = text(child(node, 'source'))
        if (source === 'rehype-raw') report(node, 'rehype-raw')
        if (source !== 'remark-rehype') return
        for (const specifier of children(node, 'specifiers')) {
          const local = nameOf(child(specifier, 'local'))
          if (specifier.type === 'ImportDefaultSpecifier' && local) remarkRehype.add(local)
        }
      },
      // `export { default as rehypeRawPlugin } from 'rehype-raw'`, `export * from 'rehype-raw'`
      ExportNamedDeclaration(node) {
        if (text(child(node, 'source')) === 'rehype-raw') report(node, 'rehype-raw')
      },
      ExportAllDeclaration(node) {
        if (text(child(node, 'source')) === 'rehype-raw') report(node, 'rehype-raw')
      },
      ImportExpression(node) {
        if (loadedModule(node) === 'rehype-raw') report(node, 'rehype-raw')
      },
      CallExpression(node) {
        if (loadedModule(node) === 'rehype-raw') report(node, 'rehype-raw')
        const callee = child(node, 'callee')
        if (callee?.type !== 'MemberExpression' || nameOf(child(callee, 'property')) !== 'use') {
          return
        }
        const [plugin, config] = children(node, 'arguments')
        if (plugin?.type === 'Identifier')
          options.push({ node, callee: nameOf(plugin), options: config })
      },
    }
  },
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/rehype-raw.tsx',
}

const mdxEvaluate: AstForm = {
  id: 'mdx-evaluate',
  detect: ({ report: reportNow }) => {
    const namespaces = new Map<string, ReadonlySet<string>>()
    const compiles: { node: Node; subject: string }[] = []
    let runs = false
    const report = (node: Node, subject: string): void => {
      const name = subject.split('.').at(-1) ?? subject
      if (COMPILE_NAMES.has(name)) compiles.push({ node, subject })
      else reportNow(node, subject)
    }
    /** A string run as code: reported itself when any argument is not a literal. */
    const reportRun = (node: Node): void => {
      runs = true
      const name = nameOf(child(node, 'callee')) as string
      if (!children(node, 'arguments').every(isLiteralText)) {
        reportNow(node, node.type === 'NewExpression' ? `new ${name}(…)` : `${name}(…)`)
      }
    }
    return {
      NewExpression(node) {
        if (runsString(node)) reportRun(node)
      },
      'Program:exit'() {
        if (runs) for (const { node, subject } of compiles) reportNow(node, subject)
      },
      ImportDeclaration(node) {
        const source = text(child(node, 'source'))
        if (isNextMdxRemote(source)) return report(node, source as string)
        const names = MDX_NAMES[source ?? '']
        if (!names) return
        for (const specifier of children(node, 'specifiers')) {
          if (specifier.type === 'ImportSpecifier') {
            const imported =
              nameOf(child(specifier, 'imported')) ?? text(child(specifier, 'imported'))
            if (imported && names.has(imported)) report(specifier, imported)
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            const local = nameOf(child(specifier, 'local'))
            if (local) namespaces.set(local, names)
          }
        }
      },
      ImportExpression(node) {
        const module = loadedModule(node)
        if (isMdxModule(module)) report(node, `import('${module}')`)
      },
      CallExpression(node) {
        if (runsString(node)) reportRun(node)
        const callee = child(node, 'callee')
        if (callee?.type === 'MemberExpression' && callee['computed'] !== true) {
          const object = nameOf(child(callee, 'object'))
          const property = nameOf(child(callee, 'property'))
          if (object && property && namespaces.get(object)?.has(property)) {
            report(node, `${object}.${property}`)
          }
          return
        }
        const module = loadedModule(node)
        if (isMdxModule(module)) {
          // `require('@mdx-js/mdx')` yields the whole module; the name comes from the access.
          report(node, `require('${module}')`)
        }
      },
    }
  },
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/mdx-evaluate.tsx',
}

const trustedContent: AstForm = {
  id: 'trusted-content',
  detect: ({ context, report }) => {
    const imported = new Set<string>()
    const pending: Node[] = []
    const importedRoot = (node: Node): boolean => {
      let current: Node | undefined = node
      while (current?.type === 'MemberExpression') current = child(current, 'object')
      const name = nameOf(current)
      return name !== undefined && imported.has(name)
    }
    const authored = (node: Node): boolean => {
      if (node.type === 'JSXText' || isLiteralText(node)) return true
      if (node.type !== 'JSXExpressionContainer') return false
      const expression = child(node, 'expression')
      if (!expression || expression.type === 'JSXEmptyExpression') return true
      return isLiteralText(expression) || importedRoot(expression)
    }
    const trustProps = new Set<string>()
    return {
      ImportDeclaration(node) {
        for (const specifier of children(node, 'specifiers')) {
          const local = nameOf(child(specifier, 'local'))
          if (local) imported.add(local)
        }
      },
      VariableDeclarator(node) {
        const name = nameOf(child(node, 'id'))
        let init = child(node, 'init')
        while (init?.type === 'TSAsExpression' || init?.type === 'TSSatisfiesExpression') {
          init = child(init, 'expression')
        }
        if (name === undefined || init?.type !== 'ObjectExpression') return
        const trust = children(init, 'properties').find((property) => {
          const key = child(property, 'key')
          return property.type === 'Property' && (nameOf(key) ?? text(key)) === 'contentTrust'
        })
        const value = trust ? child(trust, 'value') : undefined
        if (value && literalValue(value) !== 'untrusted') trustProps.add(name)
      },
      JSXOpeningElement(node) {
        const attributes = children(node, 'attributes')
        const trust = attributes.find(
          (attribute) =>
            attribute.type === 'JSXAttribute' &&
            nameOf(child(attribute, 'name')) === 'contentTrust',
        )
        if (!trust) {
          // `<Markdown {...trusted}>` where this file's `trusted` object carries a `contentTrust`
          // that is not the literal untrusted tier.
          const carriesTrust = attributes.some((attribute) => {
            if (attribute.type !== 'JSXSpreadAttribute') return false
            return trustProps.has(nameOf(child(attribute, 'argument')) ?? '')
          })
          if (nameOf(child(node, 'name')) === 'Markdown' && carriesTrust) pending.push(node)
          return
        }
        const value = child(trust, 'value')
        const expression =
          value?.type === 'JSXExpressionContainer' ? child(value, 'expression') : undefined
        // `contentTrust={trust}` hides the tier from the reader: it counts as trusted
        const literal = text(value) ?? (expression && literalValue(expression))
        if (literal === 'trusted' || (expression && literal === undefined)) pending.push(node)
      },
      'Program:exit'() {
        if (inAuthoredContent(context) || pending.length === 0) return
        for (const opening of pending) {
          const element = (opening['parent'] as Node | undefined) ?? opening
          const kids = element.type === 'JSXElement' ? children(element, 'children') : []
          const childrenProp = children(opening, 'attributes').find(
            (attribute) =>
              attribute.type === 'JSXAttribute' && nameOf(child(attribute, 'name')) === 'children',
          )
          const spread = children(opening, 'attributes').some(
            (attribute) => attribute.type === 'JSXSpreadAttribute',
          )
          if (spread && kids.length === 0 && !childrenProp) {
            report(opening, 'contentTrust="trusted"')
            continue
          }
          const propOk = !childrenProp || authored(child(childrenProp, 'value') ?? childrenProp)
          if (propOk && kids.every(authored)) continue
          report(opening, 'contentTrust="trusted"')
        }
      },
    }
  },
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/trusted-content.tsx',
}

export const untrustedMarkdownRules = defineRules({
  'untrusted-markdown': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'contentTrust defaulted to trusted; //attacker.example passed the prefix check (self-agent-content, gap-perf)',
    forms: [dangerousHtml, rehypeRaw, mdxEvaluate, trustedContent],
    schema: [
      {
        type: 'object',
        properties: { authoredContent: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
})
