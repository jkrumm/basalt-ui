/**
 * `basalt/untrusted-markdown` (guardrails section 4, row 13, as amended by ai-mdx exception 5):
 * `contentTrust` is a required type, but a literal `"trusted"` on model text, `rehype-raw` and MDX
 * evaluation each bypass it. Four forms, none scoped to files that import `basalt-ui/ai`:
 *
 * - `dangerous-html`: `dangerouslySetInnerHTML` whose `__html` is not a string literal.
 * - `rehype-raw`: an import or require of `rehype-raw`.
 * - `mdx-evaluate`: `evaluate`/`run` (and their Sync twins) of `@mdx-js/mdx`, `evaluate` of
 *   `next-mdx-remote`, by name import, namespace member or require.
 * - `trusted-content`: `contentTrust="trusted"` unless every child is a string literal, an
 *   imported binding, or the file matches a glob of the `authoredContent` option (the manifest's
 *   list of source files that render authored text).
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

const MDX_NAMES: Readonly<Record<string, ReadonlySet<string>>> = {
  '@mdx-js/mdx': new Set(['evaluate', 'evaluateSync', 'run', 'runSync']),
  'next-mdx-remote': new Set(['evaluate']),
  'next-mdx-remote/rsc': new Set(['evaluate']),
}

const dangerousHtml: AstForm = {
  id: 'dangerous-html',
  detect: ({ report }) => ({
    JSXAttribute(node) {
      if (nameOf(child(node, 'name')) !== 'dangerouslySetInnerHTML') return
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
  }),
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/dangerous-html.tsx',
}

const rehypeRaw: AstForm = {
  id: 'rehype-raw',
  detect: ({ report }) => ({
    ImportDeclaration(node) {
      if (text(child(node, 'source')) === 'rehype-raw') report(node, 'rehype-raw')
    },
    ImportExpression(node) {
      if (loadedModule(node) === 'rehype-raw') report(node, 'rehype-raw')
    },
    CallExpression(node) {
      if (loadedModule(node) === 'rehype-raw') report(node, 'rehype-raw')
    },
  }),
  fix: FIX,
  next: NEXT,
  fixture: 'untrusted/rehype-raw.tsx',
}

const mdxEvaluate: AstForm = {
  id: 'mdx-evaluate',
  detect: ({ report }) => {
    const namespaces = new Map<string, ReadonlySet<string>>()
    return {
      ImportDeclaration(node) {
        const names = MDX_NAMES[text(child(node, 'source')) ?? '']
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
        if (module && MDX_NAMES[module]) report(node, `import('${module}')`)
      },
      CallExpression(node) {
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
        if (module && MDX_NAMES[module]) {
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
    return {
      ImportDeclaration(node) {
        for (const specifier of children(node, 'specifiers')) {
          const local = nameOf(child(specifier, 'local'))
          if (local) imported.add(local)
        }
      },
      JSXOpeningElement(node) {
        const attributes = children(node, 'attributes')
        const trust = attributes.find(
          (attribute) =>
            attribute.type === 'JSXAttribute' &&
            nameOf(child(attribute, 'name')) === 'contentTrust',
        )
        if (!trust) return
        const value = child(trust, 'value')
        const literal =
          text(value) ??
          (value?.type === 'JSXExpressionContainer' ? text(child(value, 'expression')) : undefined)
        if (literal === 'trusted') pending.push(node)
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
