/**
 * `eject`, `migrate` and `lint` are registered before they are built: each says so and exits 1, and
 * any verb rejects an unknown flag with exit 1.
 */
import { describe, expect, it } from 'bun:test'

import { run } from './index'

function capture(argv: string[]): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  console.log = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.error = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  try {
    const result = run(argv, process.cwd())
    if (result instanceof Promise) throw new TypeError('run() returned a Promise in a sync test')
    return { code: result, log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

describe('v3 verb stubs', () => {
  for (const verb of ['eject', 'migrate', 'lint']) {
    it(`${verb} prints "not implemented" and exits 1`, () => {
      const { code, log } = capture([verb])
      expect(code).toBe(1)
      expect(log).toContain('not implemented in this build')
    })

    it(`${verb} --bogus exits 1 naming the flag, not "not implemented"`, () => {
      const { code, log } = capture([verb, '--bogus'])
      expect(code).toBe(1)
      expect(log).toContain('--bogus')
      expect(log).not.toContain('not implemented')
    })
  }

  it('accepts the contract flags before reporting not implemented', () => {
    expect(capture(['migrate', '--from', '2.0.0', '--profile', 'full', '--json']).log).toContain(
      'not implemented',
    )
    expect(capture(['lint', '--file', 'a.ts', '--file', 'b.ts', '--hook', 'pre']).log).toContain(
      'not implemented',
    )
  })

  it('every existing verb rejects --bogus with exit 1', () => {
    for (const verb of ['init', 'sync', 'doctor', 'tokens:css', 'shot']) {
      expect(capture([verb, '--bogus']).code).toBe(1)
    }
  })
})
