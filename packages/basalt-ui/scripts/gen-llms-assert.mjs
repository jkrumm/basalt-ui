#!/usr/bin/env node
/**
 * Tarball assertion for the generated llms.txt (it is no longer committed, so there is no file to
 * diff): every key of the packed `package.json` `exports` map must have its `## basalt-ui<subpath>`
 * heading in the packed llms.txt. A subpath that ships without a section is invisible to an agent
 * reading the file.
 *
 * Usage: node scripts/gen-llms-assert.mjs <llms.txt> <package.json>
 */
import { readFileSync } from 'node:fs'

/** Subpaths of `exports` whose `## basalt-ui…` heading is absent from `llmsText`. */
export function missingSubpaths(llmsText, exportsMap) {
  const headings = new Set(llmsText.split('\n'))
  // A null key publishes nothing; the eject paths (`./core/<module>`) are one `./core/*` section.
  const keys = Object.entries(exportsMap)
    .filter(([, target]) => target !== null)
    .map(([key]) => (key.startsWith('./core/') ? './core/*' : key))
  return [...new Set(keys)]
    .map((key) => (key === '.' ? '## basalt-ui' : `## basalt-ui${key.slice(1)}`))
    .filter((heading) => !headings.has(heading))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [llmsPath, pkgPath] = process.argv.slice(2)
  if (!llmsPath || !pkgPath) {
    console.error('usage: gen-llms-assert.mjs <llms.txt> <package.json>')
    process.exit(2)
  }
  const exportsMap = JSON.parse(readFileSync(pkgPath, 'utf8')).exports ?? {}
  const missing = missingSubpaths(readFileSync(llmsPath, 'utf8'), exportsMap)
  if (missing.length > 0) {
    console.error(`llms.txt in the tarball has no section for ${missing.length} export(s):`)
    for (const heading of missing) console.error(`  missing: ${heading}`)
    process.exit(1)
  }
  console.log('llms.txt names every package.json export')
}
