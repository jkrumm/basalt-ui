#!/usr/bin/env bun
/**
 * The legacy-name gate (Issues 1703, 3201): fails on a `vx` token spelling, a `mantine` mention or a British
 * spelling (`colour`, `favourite`) outside the allowlist
 * in `scripts/legacy-names.ts`, in the source tree and in the packed tarball.
 *
 * Usage: bun scripts/check-legacy-names.ts                      every tracked file of the repo
 *        bun scripts/check-legacy-names.ts --package <dir>      an unpacked tarball (`package/`): every file in it,
 *                                                               judged as `packages/basalt-ui/<path>`
 * A finding prints `path:line: <kind>: <text>`; the fix is the codemod (`bun scripts/rename-legacy.ts`) for a `vx`
 * spelling, a rewrite for a Mantine mention, or an allowlist entry with its reason.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileAllows, lineAllows, spelled } from './legacy-names.ts'
import type { Kind } from './legacy-names.ts'

const ROOT = resolve(import.meta.dirname, '..')
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|tgz|gz|zip|pdf|mp4|webm)$/i

export type Finding = { path: string; line: number; kind: Kind; text: string }

/** The findings of one file's text, judged as repo path `path`. */
export function scan(path: string, text: string): Finding[] {
  const findings: Finding[] = []
  text.split('\n').forEach((line, i) => {
    for (const kind of spelled(line)) {
      if (fileAllows(path, kind) || lineAllows(path, kind, line)) continue
      findings.push({ path, line: i + 1, kind, text: line.trim().slice(0, 160) })
    }
  })
  return findings
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function trackedFiles(): [string, string][] {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`git ls-files: ${r.stderr}`)
  return r.stdout
    .split('\0')
    .filter((p) => p !== '' && !BINARY.test(p))
    .map((p): [string, string] => [p, join(ROOT, p)])
}

function packageFiles(dir: string): [string, string][] {
  return walk(dir)
    .filter((p) => !BINARY.test(p))
    .map((p): [string, string] => [`packages/basalt-ui/${relative(dir, p)}`, p])
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--package')
  const files = at === -1 ? trackedFiles() : packageFiles(resolve(args[at + 1] ?? '.'))
  const findings: Finding[] = []
  for (const [path, abs] of files) {
    let text: string
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      continue // a tracked file deleted in the working tree
    }
    findings.push(...scan(path, text))
  }
  const where = at === -1 ? 'the source tree' : 'the packed tarball'
  if (findings.length === 0) {
    console.log(
      `✓ legacy names: no vx spelling, Mantine mention or British spelling in ${where} outside the allowlist`,
    )
    process.exit(0)
  }
  for (const f of findings) console.error(`${f.path}:${f.line}: ${f.kind}: ${f.text}`)
  console.error(
    `✖ legacy names: ${findings.length} finding(s) in ${where}. A vx spelling: run \`bun scripts/rename-legacy.ts\`; ` +
      'a Mantine mention: rewrite it; a British spelling (colour, favourite): the American one; history that must keep its words: an entry in scripts/legacy-names.ts.',
  )
  process.exit(1)
}
