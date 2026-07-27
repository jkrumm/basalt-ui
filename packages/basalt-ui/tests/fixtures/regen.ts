#!/usr/bin/env bun
/**
 * Regenerate the golden palette fixture after an INTENDED change to the emitter or the palette
 * data. Review the resulting diff — `tests/palette-css.test.ts` exists precisely so an unintended
 * change to this file has to be looked at by a human first.
 *
 * Run: cd packages/basalt-ui && bun tests/fixtures/regen.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPaletteCss } from '../../src/tokens'

const out = join(import.meta.dir, 'palette-default.css')
writeFileSync(out, buildPaletteCss())
console.log(`palette fixture regenerated → ${out}`)
