/**
 * No colored bar on one edge anywhere in the package: the `side-stripe` form of `basalt/tw-off-law`
 * guards app code, but the package's own source is linted on the repo config, which loads no basalt
 * rule. This reads every class-like string literal and template text in `src/` and runs the same
 * detector over its tokens.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { classTokens } from '../src/lint/factory'
import { sideStripe } from '../src/lint/rules/class/detect'

const SRC = join(import.meta.dirname, '..', 'src')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

function stripes(path: string): string[] {
  const text = readFileSync(path, 'utf8')
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const subject = sideStripe(classTokens(node.text))
      if (subject !== undefined) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        found.push(`${relative(SRC, path)}:${line + 1} ${subject}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('side stripes', () => {
  test('no class string in src/ draws a colored bar on one edge', () => {
    expect(files(SRC).flatMap(stripes)).toEqual([])
  })
})
