import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateLlmsTxt, outPath } from './gen-llms'

const text = generateLlmsTxt()
const surface = JSON.parse(
  readFileSync(join(import.meta.dir, 'export-surface.json'), 'utf8'),
) as Record<string, string[]>

/** The `Signature:` names listed under one `## basalt-ui/<sub>` heading. */
function signatureNames(subpath: string): string[] {
  const heading = subpath === '.' ? '## basalt-ui\n' : `## basalt-ui${subpath.slice(1)}\n`
  const section = text.split(heading)[1]?.split('\n\n')[0] ?? ''
  return section
    .split('\n')
    .filter((l) => l.startsWith('Signature: '))
    .map((l) => /^Signature: ([\w$]+)/.exec(l)?.[1] ?? '')
}

describe('gen-llms signatures', () => {
  test('every published value export of every JS subpath has exactly one signature line', () => {
    for (const [subpath, names] of Object.entries(surface)) {
      expect(signatureNames(subpath).toSorted(), subpath).toEqual(names.toSorted())
    }
  })

  test('signatures are one clipped line, with no destructured-parameter placeholders', () => {
    const lines = text.split('\n').filter((l) => l.startsWith('Signature: '))
    expect(lines.length).toBeGreaterThan(100)
    expect(lines.every((l) => l.length <= 'Signature: '.length + 170)).toBe(true)
    expect(text).not.toContain('__0')
  })

  test('reads real parameter and return types', () => {
    expect(text).toContain('Signature: alpha(token: string, a: number): string')
  })

  test('the committed llms.txt is in sync', () => {
    expect(readFileSync(outPath, 'utf8')).toBe(text)
  })
})
