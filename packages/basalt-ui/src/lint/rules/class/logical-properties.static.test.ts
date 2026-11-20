/**
 * The site parts under src/static carry no physical inline-axis class: the logical-properties rule
 * runs over every .tsx there and finds nothing. The positive control proves the harness is not
 * silent by construction.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ESLint } from 'eslint'
import { Linter } from 'eslint'
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import { createPlugin } from '../../factory'
import { CLASS_RULES } from './table'

const STATIC_DIR = resolve(import.meta.dirname, '../../../static')
const plugin = createPlugin(CLASS_RULES)
const linter = new Linter()

/** Types erased, JSX kept: espree reads the module the rule sees, with no TypeScript parser installed. */
const javascript = (code: string): string =>
  transpileModule(code, {
    compilerOptions: {
      jsx: JsxEmit.Preserve,
      target: ScriptTarget.ESNext,
      module: ModuleKind.ESNext,
    },
    fileName: 'input.tsx',
  }).outputText

const findings = (code: string): string[] =>
  linter
    .verify(
      javascript(code),
      [
        {
          files: ['**/*.tsx'],
          plugins: { basalt: plugin as unknown as ESLint.Plugin },
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          rules: { 'basalt/logical-properties': 'error' },
        },
      ],
      'input.tsx',
    )
    .map(({ line, message }) => `${line}: ${message}`)

const files = readdirSync(STATIC_DIR, { recursive: true, encoding: 'utf8' }).filter((file) =>
  file.endsWith('.tsx'),
)

describe('logical-properties over the site parts', () => {
  it('is not silent: a physical class is found', () => {
    expect(findings('export const a = <div className="ml-2" />')).toHaveLength(1)
  })

  it('finds at least one site part to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file} has no physical inline-axis class`, () => {
      expect(findings(readFileSync(join(STATIC_DIR, file), 'utf8'))).toEqual([])
    })
  }
})
