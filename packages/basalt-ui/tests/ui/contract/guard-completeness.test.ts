import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  checkGuardCompleteness,
  importedModules,
  stubFromGuard,
} from '../../../src/ui/guard-completeness'

const fixture = join(import.meta.dirname, 'fixtures', 'composite-calls-missing-axis.tsx')

describe('guard-completeness', () => {
  test('passes on the shipped tree', () => {
    expect(checkGuardCompleteness()).toEqual([])
  })

  test('fails on a composite calling an axis the guard lacks', () => {
    const violations = checkGuardCompleteness({ files: [fixture] })
    expect(violations).toHaveLength(1)
    expect(violations[0]?.file).toBe(fixture)
    expect(violations[0]?.message).toContain('"danger"')
  })

  test('the stub of a guard names its components and called axes', () => {
    const result = stubFromGuard(
      [
        '// basalt:guard requires',
        "type Called = { size?: 'md' }",
        'export const requires = (c: Called): Pick<WidgetProps, "size"> => c',
        '// basalt:guard closed',
      ].join('\n'),
    )
    expect('stub' in result && result.stub).toContain('export declare function Widget')
  })

  test('a guard without the requires marker is an error', () => {
    expect(stubFromGuard('export const x = 1')).toHaveProperty('error')
  })

  test('importedModules reads the specifier', () => {
    expect(importedModules(`import { A } from 'basalt-ui/ui/card'`)).toEqual(['card'])
  })
})
