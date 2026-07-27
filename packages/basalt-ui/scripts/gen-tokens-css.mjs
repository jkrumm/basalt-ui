#!/usr/bin/env bun
/**
 * Emit `dist/tokens.css` — the whole `--vx-*` token system as a plain stylesheet, published as the
 * `basalt-ui/tokens.css` subpath.
 *
 * `./styles.css` is the framework's base layer and assumes Mantine underneath it. This file assumes
 * nothing: it is `buildPaletteCss()` with no options, so a consumer with no bundler, no React and no
 * Mantine can `<link>` the token system and read `var(--vx-*)` in hand-written CSS. A consumer that
 * wants a different color-scheme selector or the core-only spacing set runs `basalt-ui tokens:css`
 * with flags instead — same emitter, same guarantees.
 *
 * Byte-identical to `tests/fixtures/palette-default.css` by construction (no options passed), which
 * is what makes the golden fixture a gate on the SHIPPED artifact and not just on the function.
 *
 * Reads `src/` rather than the freshly built `dist/`, so it does not care where it sits in the build
 * chain — Bun transpiles the TS import in place.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildPaletteCss } from '../src/tokens/index.ts'

const DIST = resolve(import.meta.dirname, '..', 'dist')
mkdirSync(DIST, { recursive: true })

const out = resolve(DIST, 'tokens.css')
const css = buildPaletteCss()
writeFileSync(out, css)
console.log(`gen-tokens-css: ${css.split('\n').length} lines → dist/tokens.css`)
