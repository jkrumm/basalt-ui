/**
 * check-literals: user-facing text lives in `src/core/messages`, not in a component.
 *
 * Flags, in `src/{ui,cards,page,data,router,core}/**` and in any file that imports `core/messages`:
 *  - a string literal as the value of `aria-label`, `title`, `placeholder` or `alt` (written
 *    `aria-label="Close"` or `aria-label={'Close'}`);
 *  - a string literal as a parameter's default (`function f(label = 'Close')`).
 * Skipped: `core/messages` itself, tests, type-guard fixtures, and every other directory (the 2.x
 * ones are skipped until the lane that replaces them is in).
 *
 * Usage: bun packages/basalt-ui/scripts/check-literals.ts [--root <package dir>]
 * Exit 0 clean, 1 with one `file:line  message` per finding.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const SCANNED_DIRS = ['ui', 'cards', 'page', 'data', 'router', 'core']
const ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt'])
const SOURCE = /\.(ts|tsx)$/
const SKIPPED = /\.(test|type-guard|golden)\.|\.d\.ts$/

export type Finding = { file: string; line: number; message: string }

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...walk(path))
    } else if (SOURCE.test(entry.name) && !SKIPPED.test(entry.name)) out.push(path)
  }
  return out
}

function isLiteral(node: ts.Node | undefined): node is ts.StringLiteral {
  return (
    node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  )
}

/** The initializer's string literal, looking through `{...}` and `as const`. */
function literalOf(node: ts.Node | undefined): ts.Node | undefined {
  if (node === undefined) return undefined
  if (ts.isJsxExpression(node)) return literalOf(node.expression)
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return literalOf(node.expression)
  return isLiteral(node) ? node : undefined
}

function importsMessages(source: ts.SourceFile, file: string, messagesDir: string): boolean {
  return source.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return false
    }
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) return false
    const target = resolve(dirname(file), specifier)
    return target === messagesDir || target.startsWith(messagesDir + sep)
  })
}

export function checkLiterals(packageRoot: string): Finding[] {
  const src = join(packageRoot, 'src')
  const messagesDir = join(src, 'core', 'messages')
  const scanned = SCANNED_DIRS.map((dir) => join(src, dir) + sep)
  const findings: Finding[] = []

  for (const file of walk(src)) {
    if (file.startsWith(messagesDir + sep)) continue
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    if (
      !scanned.some((dir) => file.startsWith(dir)) &&
      !importsMessages(source, file, messagesDir)
    ) {
      continue
    }
    const report = (node: ts.Node, message: string): void => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
      findings.push({ file: relative(packageRoot, file), line: line + 1, message })
    }
    const visit = (node: ts.Node): void => {
      if (ts.isJsxAttribute(node) && ATTRIBUTES.has(node.name.getText(source))) {
        const literal = literalOf(node.initializer)
        if (literal !== undefined) {
          report(node, `${node.name.getText(source)} is a string literal: use useMessages`)
        }
      }
      if (ts.isParameter(node)) {
        const literal = literalOf(node.initializer)
        if (literal !== undefined) {
          report(node, 'default string parameter: take the text from useMessages')
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

if (import.meta.main) {
  const flag = process.argv.indexOf('--root')
  const root = flag === -1 ? join(import.meta.dirname, '..') : resolve(process.argv[flag + 1] ?? '')
  const findings = checkLiterals(root)
  for (const f of findings) console.error(`${f.file}:${f.line}  ${f.message}`)
  if (findings.length > 0) {
    console.error(`check-literals: ${findings.length} string literal(s) outside core/messages`)
    process.exit(1)
  }
}
