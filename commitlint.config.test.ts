import { spawnSync } from 'node:child_process'

import { describe, expect, test } from 'bun:test'

const lint = (message: string) =>
  spawnSync('./node_modules/.bin/commitlint', ['--config', 'commitlint.config.ts'], {
    cwd: import.meta.dir,
    input: message,
    encoding: 'utf8',
    timeout: 30_000,
  })

const rejected = (message: string) => {
  const { status, stdout } = lint(message)
  expect(status).not.toBe(0)
  expect(stdout).toContain('no-breaking')
}

describe('no-breaking', () => {
  test.each(['feat!: x', 'fix(a)!: x'])('rejects the header marker in %p', (header) => {
    // fix(a)!: also trips scope-empty; the rule itself must still be named
    rejected(header)
  })

  test.each(['BREAKING CHANGE', 'BREAKING-CHANGE'])('rejects a %s footer', (keyword) => {
    rejected(`feat: x\n\nbody line\n\n${keyword}: drops the old surface`)
  })

  test.each([
    '  BREAKING CHANGE: x',
    '* BREAKING-CHANGE: x',
    'breaking change: x',
    'BREAKING CHANGE drops x',
  ])('rejects the parser-equivalent footer spelling %p', (line) => {
    rejected(`feat: x\n\nbody line\n\n${line}`)
  })

  test.each(['feat: x', 'fix: x', 'Revert "feat: x"'])('accepts %p', (message) => {
    expect(lint(message).status).toBe(0)
  })

  test('accepts a body that only mentions the phrase mid-line', () => {
    expect(lint('feat: x\n\nthe BREAKING CHANGE: marker is banned here').status).toBe(0)
  })
})
