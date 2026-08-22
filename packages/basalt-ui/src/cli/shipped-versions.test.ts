/**
 * No shipped artifact may name a basalt version npm never served.
 *
 * Three rounds running, the newest `MIGRATING.md` heading named a phantom — `1.20.1` (shipped as
 * 1.21.0), then `1.21.1` (shipped as 1.22.0) — because the docs pass runs BEFORE semantic-release
 * computes the number, so whatever is written is a guess. That would be a docs problem alone if it
 * stayed in docs. It does not: `sync` copies `agent/rules/**` and `agent/skills/**` verbatim into
 * every consumer, so "Since 1.21.1" is currently shipped, as fact, into seven repos.
 *
 * This is the gate that ends it, and it is mechanical rather than editorial: every basalt-shaped
 * version literal in a file a consumer receives must appear as a release heading in CHANGELOG.md —
 * the one file `semantic-release` writes AFTER the number exists. A guessed version fails here
 * before it can ship.
 *
 * Deliberately NOT a ban on version literals: `agent/rules/**` is release-history prose and
 * "widened at 1.21.0, promoted at 1.22.0" is exactly the sentence a consumer needs. What it may
 * not do is name a release that does not exist.
 *
 * The complementary half — no version stamped into a file nothing ever rewrites — lives in
 * `toolchain-wiring.test.ts` ("DESIGN.md carries no version").
 *
 * Run: bun test packages/basalt-ui/src/cli/shipped-versions.test.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Every version CHANGELOG.md records, plus the one package.json currently declares. */
const RELEASED = new Set<string>([
  ...(
    readFileSync(resolve(PKG_ROOT, 'CHANGELOG.md'), 'utf8').match(/^#+\s*\[?(\d+\.\d+\.\d+)/gm) ??
    []
  ).map((h) => h.replace(/^#+\s*\[?/, '')),
  (JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as { version: string })
    .version,
])

/**
 * basalt's own version line is 0.x / 1.x, so a literal with any other major belongs to a peer
 * (visx 4.0.0, motion 12.42.0, the fontsource 5.2.x trio) and is none of this gate's business. A
 * `^`/`~`/`@`-prefixed literal is a dependency RANGE for the same reason — `vite-plugin-pwa
 * (^1.3.0)` shares a major with basalt and is still not a claim about basalt.
 */
const BASALT_VERSION_LITERAL = /(^|[^-~^@\w.])([01]\.\d+\.\d+)(?![\w.])/g

function versionsIn(content: string): string[] {
  return [...content.matchAll(BASALT_VERSION_LITERAL)].map((m) => m[2] as string)
}

/** Every file under `dir`, recursively. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name)
    return statSync(abs).isDirectory() ? filesUnder(abs) : [abs]
  })
}

// Everything `init`/`sync` place in a consumer repo, plus the presets they `extends` into.
const SHIPPED = [
  ...filesUnder(resolve(PKG_ROOT, 'agent')),
  resolve(PKG_ROOT, 'configs/check.yml'),
  resolve(PKG_ROOT, 'configs/lefthook.yml'),
]

describe('shipped agent assets name only versions that exist', () => {
  it.each(SHIPPED.map((abs) => [relative(PKG_ROOT, abs), abs] as const))(
    '%s',
    (_rel, abs: string) => {
      const unreleased = [...new Set(versionsIn(readFileSync(abs, 'utf8')))].filter(
        (v) => !RELEASED.has(v),
      )
      expect(unreleased).toEqual([])
    },
  )

  it('reads a real changelog, so an empty RELEASED set can never make this vacuous', () => {
    expect(RELEASED.size).toBeGreaterThan(20)
    expect(RELEASED.has('1.21.1')).toBe(false)
  })
})
