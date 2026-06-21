/**
 * Asserts that the committed packages/basalt-ui/llms.txt matches what gen-llms.ts would emit.
 * Run: bun test packages/basalt-ui/tests/llms-sync.test.ts
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'

import { generateLlmsTxt, outPath } from '../scripts/gen-llms'

describe('llms-sync', () => {
  it('committed llms.txt matches gen-llms.ts output', () => {
    const committed = readFileSync(outPath, 'utf8')
    const generated = generateLlmsTxt()
    expect(generated).toBe(committed)
  })
})
