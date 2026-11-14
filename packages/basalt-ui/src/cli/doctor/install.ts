/**
 * Checks 1-3: the install itself. The manifest and what it declares against what the code imports,
 * the installed version against the declared one, and the peers the profile needs.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { readBudget } from '../budget'
import { findBasaltInstall } from '../index'
import type { Profile } from '../manifest'
import {
  compareVersions,
  fail,
  filesUnder,
  majorOf,
  need,
  pass,
  PROFILE_RANK,
  readJson,
  readText,
  rootsOf,
  verdictOf,
} from './types'
import type { Check } from './types'

/** The oldest `version` a manifest may record: below it the shape is not the v3 one. */
export const VERSION_FLOOR = '2.29.0'

/** The lowest profile each subpath needs (primitives-distribution L4): `ui/*` parts, `shell` app. */
const SUBPATH_PROFILE: readonly (readonly [RegExp, Profile])[] = [
  [/^basalt-ui\/shell(?:\/|$)/, 'app'],
  [/^basalt-ui\/ui(?:\/|$)/, 'parts'],
]

const IMPORT_SPECIFIER =
  /(?:from\s*|import\s*\(?\s*|@import\s+(?:url\(\s*)?)['"](basalt-ui\/[^'"]+)['"]/g

const check1 = (name: string): Check => ({
  id: 1,
  name,
  run: (ctx) => {
    if (ctx.manifest === null) return fail(ctx.manifestError ?? '.basalt/manifest.json is missing')
    const manifest = ctx.manifest
    const findings: string[] = []

    if (manifest.version === '' || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      findings.push('`version` is not a semver: run `basalt-ui sync`')
    } else if (compareVersions(manifest.version, VERSION_FLOOR) < 0) {
      findings.push(`version ${manifest.version} is below the gate floor ${VERSION_FLOOR}`)
    }

    const budget = readBudget(ctx.root)
    const floor = 'budget' in budget ? budget.budget.profileFloor : null
    for (const [root, profile] of rootsOf(manifest)) {
      if (floor !== null && PROFILE_RANK[profile] < PROFILE_RANK[floor]) {
        findings.push(`${root} declares ${profile}, below the profileFloor ${floor}`)
      }
      let needed: Profile = 'tokens'
      let named = ''
      for (const file of filesUnder(ctx.root, root, /\.(?:[cm]?[jt]sx?|css|astro)$/)) {
        const text = readText(ctx.root, file) ?? ''
        for (const [, spec = ''] of text.matchAll(IMPORT_SPECIFIER)) {
          for (const [pattern, minimum] of SUBPATH_PROFILE) {
            if (pattern.test(spec) && PROFILE_RANK[minimum] > PROFILE_RANK[needed]) {
              needed = minimum
              named = `${spec} in ${file}`
            }
          }
        }
      }
      if (PROFILE_RANK[profile] < PROFILE_RANK[needed]) {
        findings.push(`${root} declares ${profile} but imports ${named}, which needs ${needed}`)
      }
    }
    return verdictOf(findings, `profile ${manifest.profile}, version ${manifest.version}`)
  },
})

const check2 = (name: string): Check => ({
  id: 2,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const install = findBasaltInstall(ctx.root)
    if (install.dir === null) return fail('basalt-ui does not resolve from here: run `bun install`')
    if (install.version === null) return fail(`${install.dir}/package.json has no version`)
    return install.version === manifest.version
      ? pass(`installed ${install.version} at ${install.dir}`)
      : fail(
          `installed ${install.version}, manifest records ${manifest.version}: ` +
            'run `bun install`, then `basalt-ui sync`',
        )
  },
})

/** Peers every profile above `tokens` needs; `app` adds the router and the query client. */
const BASE_PEERS = ['react', 'react-dom', 'tailwindcss', '@base-ui/react'] as const
const APP_PEERS = ['@tanstack/react-router', '@tanstack/react-query'] as const
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const

type Declared = { dir: string; deps: Record<string, string> }

/** The `package.json` at the install root and at the package of every declared root. */
function declaredDeps(root: string, roots: readonly string[]): Declared[] {
  const dirs = new Set<string>([root])
  for (const rel of roots) {
    for (let dir = resolve(root, rel); dir.startsWith(root) && dir !== root; dir = dirname(dir)) {
      if (existsSync(resolve(dir, 'package.json'))) {
        dirs.add(dir)
        break
      }
    }
  }
  return [...dirs].map((dir) => {
    const pkg = readJson(dir, 'package.json') ?? {}
    const deps: Record<string, string> = {}
    for (const field of DEP_FIELDS) {
      const block = pkg[field]
      if (typeof block !== 'object' || block === null) continue
      for (const [name, range] of Object.entries(block)) {
        if (typeof range === 'string') deps[name] = range
      }
    }
    return { dir, deps }
  })
}

/** The installed version of `name`, resolving upward from `dir` the way node does. */
function installedVersion(dir: string, name: string): string | null {
  for (let at = dir; ; at = dirname(at)) {
    const version = readJson(resolve(at, 'node_modules', name), 'package.json')?.['version']
    if (typeof version === 'string') return version
    if (dirname(at) === at) return null
  }
}

/** True when `installed` meets `range`: equal for a pin, else the same major at or above the base. */
function meets(installed: string, range: string): boolean {
  if (/^\d+\.\d+\.\d+$/.test(range)) return installed === range
  const base = /\d+\.\d+\.\d+/.exec(range)?.[0] ?? `${majorOf(range) ?? 0}.0.0`
  return majorOf(installed) === majorOf(range) && compareVersions(installed, base) >= 0
}

/** `@ai-sdk/react` 4 pairs with `ai` 7 (docs/v3/DIRECTION.md); the react major is the `ai` major minus 3. */
const AI_REACT_OFFSET = 3

/** ai-major-parity: one `ai` major across packages (unless a reason is written), react paired to it. */
function aiParity(packages: readonly Declared[]): string[] {
  const findings: string[] = []
  const majors = new Map<number, string>()
  for (const { dir, deps } of packages) {
    const ai = [majorOf(deps['ai']), majorOf(installedVersion(dir, 'ai') ?? undefined)]
    const react = [
      majorOf(deps['@ai-sdk/react']),
      majorOf(installedVersion(dir, '@ai-sdk/react') ?? undefined),
    ]
    for (const major of ai) if (major !== null) majors.set(major, dir)
    for (const [i, major] of react.entries()) {
      const paired = ai[i] ?? ai[0] ?? ai[1]
      if (
        major !== null &&
        paired !== null &&
        paired !== undefined &&
        major !== paired - AI_REACT_OFFSET
      ) {
        findings.push(
          `ai-major-parity: @ai-sdk/react ${major} does not pair with ai ${paired} in ${dir} ` +
            `(expected @ai-sdk/react ${paired - AI_REACT_OFFSET})`,
        )
        break
      }
    }
  }
  // The root package.json is first: the reason is recorded there and nowhere else.
  const root = packages[0]
  const written = (
    root === undefined ? undefined : readJson(root.dir, 'package.json')?.['basalt']
  ) as { aiMajorSkewReason?: unknown } | undefined
  const reason = written?.aiMajorSkewReason
  if (majors.size > 1 && !(typeof reason === 'string' && reason.trim() !== '')) {
    findings.push(
      `ai-major-parity: \`ai\` is on majors ${[...majors.keys()].toSorted().join(' and ')} across packages; ` +
        'align them or record `basalt.aiMajorSkewReason` in the root package.json',
    )
  }
  return findings
}

const check3 = (name: string): Check => ({
  id: 3,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const packages = declaredDeps(
      ctx.root,
      rootsOf(manifest).map(([r]) => r),
    )
    const findings: string[] = []

    if (manifest.profile !== 'tokens') {
      const ranges = readJson(ctx.pkgRoot, 'package.json')?.['peerDependencies'] as
        | Record<string, string>
        | undefined
      const required = [...BASE_PEERS, ...(manifest.profile === 'app' ? APP_PEERS : [])]
      for (const peer of required) {
        const declared = packages.find((p) => peer in p.deps)
        if (declared === undefined) {
          findings.push(`${peer} is not declared (needed by profile ${manifest.profile})`)
          continue
        }
        const installed = installedVersion(declared.dir, peer)
        const range = ranges?.[peer]
        if (installed === null)
          findings.push(`${peer} is declared but not installed: run bun install`)
        else if (range !== undefined && !meets(installed, range)) {
          findings.push(`${peer} ${installed} does not meet ${range}`)
        }
      }
    }

    findings.push(...aiParity(packages))
    return verdictOf(findings, `peers for profile ${manifest.profile} resolve; ai majors agree`)
  },
})

export const installChecks: Check[] = [
  check1('manifest'),
  check2('install-parity'),
  check3('peers'),
]
