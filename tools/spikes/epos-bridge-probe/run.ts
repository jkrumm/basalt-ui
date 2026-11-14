/**
 * Spike: the epos read-only bridge probe (docs/v3/concepts/migration-release.md section 5, G0;
 * DPO 16 in docs/v3/DIRECTION.md). Copies the epos UI into an OS-temp directory (no .git, .env*,
 * node_modules, dist), installs a `bun pm pack` tarball of packages/basalt-ui from this checkout,
 * runs `init --profile bridge`, `doctor`, `lint` and `tokens:css` with a hue-only `--accent` from
 * epos's brand navy, and prints ONE JSON object. Numbers and rule ids only: no employer source,
 * path, host or name is printed or committed. Exit 0 means the harness ran, not that a hypothesis
 * held; exit 1 when the epos checkout moved or a step could not run.
 *
 *   bun tools/spikes/epos-bridge-probe/run.ts            (EPOS=<epos checkout> overrides the default)
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { hctToHex, hexToHct } from '../../../packages/basalt-ui/src/tokens/hct'

const ROOT = resolve(import.meta.dir, '../../..')
const PKG = join(ROOT, 'packages/basalt-ui')
const EPOS = process.env['EPOS'] ?? join(homedir(), 'IuRoot/epos-ai-teamchat-athena')
const TONE_MARGIN = 10

type Run = { status: number; out: string }
const sh = (argv: string[], cwd: string, env: Record<string, string> = {}): Run => {
  const r = spawnSync(argv[0] ?? '', argv.slice(1), {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, ...env },
  })
  return { status: r.status ?? 1, out: `${r.stdout}${r.stderr}` }
}
const sha = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 12)
const eposState = (): string =>
  sha(sh(['git', 'status', '--porcelain'], EPOS).out + sh(['git', 'rev-parse', 'HEAD'], EPOS).out)

if (!existsSync(join(EPOS, 'ui/package.json'))) throw new Error('set EPOS to the epos checkout')
const before = eposState()
const work = mkdtempSync(join(tmpdir(), 'epos-bridge-probe-'))
const copy = join(work, 'ui')
const problems: string[] = []

try {
  // 1. The scratch copy: the one place anything is written.
  mkdirSync(copy)
  const rsync = sh(
    [
      'rsync',
      '-a',
      '--exclude=.git',
      '--exclude=.env*',
      '--exclude=node_modules',
      '--exclude=dist',
      '--exclude=package-lock.json',
      `${join(EPOS, 'ui')}/`,
      `${copy}/`,
    ],
    work,
  )
  if (rsync.status !== 0) throw new Error('copy failed')

  // 2. The tarball of this checkout.
  const packDir = join(work, 'pack')
  mkdirSync(packDir)
  const pack = sh(['bun', 'pm', 'pack', '--destination', packDir], PKG)
  const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'))
  if (pack.status !== 0 || tarball === undefined) throw new Error('bun pm pack failed')
  const tgz = join(packDir, tarball)
  const shipped = JSON.parse(sh(['tar', '-xzOf', tgz, 'package/package.json'], work).out) as {
    version: string
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }

  // 3. peersAdded: the tarball's required peers the copy's package.json does not carry.
  const own = JSON.parse(readFileSync(join(copy, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const have = { ...own.dependencies, ...own.devDependencies }
  const peers = shipped.peerDependencies ?? {}
  const optional = shipped.peerDependenciesMeta ?? {}
  const peersAdded = Object.keys(peers)
    .filter((n) => optional[n]?.optional !== true && !(n in have))
    .sort()

  // 4. Install the tarball (public npm only, peers legacy: a frozen install is not claimed).
  const npmEnv = {
    npm_config_legacy_peer_deps: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_registry: 'https://registry.npmjs.org/',
  }
  const install = sh(['npm', 'install', '--ignore-scripts', tgz], copy, npmEnv)
  if (install.status !== 0) throw new Error('tarball install failed')
  const bin = join(copy, 'node_modules/basalt-ui/bin/basalt-ui.mjs')
  const env = { ...npmEnv, PATH: `${join(copy, 'node_modules/.bin')}:${process.env['PATH'] ?? ''}` }
  const basalt = (...args: string[]): Run => sh(['bun', bin, ...args], copy, env)

  // 5. The navy: epos's own brand token, light scheme. Only its hue enters the seed.
  const tokens = readFileSync(join(copy, 'src/tokens.css'), 'utf8')
  const navyHex = /--brand:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1]
  if (navyHex === undefined) throw new Error('no brand token in the copy')
  const navy = hexToHct(navyHex)
  const seed = hctToHex({ hue: navy.hue, chroma: 48, tone: 50 })

  // tenantSets: distinct selections of a brand token set in epos's own CSS, read BEFORE `init`
  // (which regenerates src/tokens.css in the copy). A selection is a selector with its scheme part
  // (data-theme, prefers-color-scheme) removed; 1 means one brand and no tenant.
  const SCHEME = /:not\(\[data-theme[^\]]*\]\)|\[data-theme[^\]]*\]/g
  const selections = new Set<string>()
  const css = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? css(join(dir, e.name))
        : e.name.endsWith('.css')
          ? [readFileSync(join(dir, e.name), 'utf8')]
          : [],
    )
  for (const text of css(join(copy, 'src'))) {
    const flat = text.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/--(brand|accent|accent-fill)\s*:/.test(m[2] ?? '')) continue
      selections.add((m[1] ?? '').replace(SCHEME, '').replace(/\s+/g, ' ').trim())
    }
  }
  const tenantSets = selections.size

  const init = basalt('init', '--profile', 'bridge', '--root', 'src', '--accent', seed)
  const doctor = basalt('doctor')
  const checks = [...doctor.out.matchAll(/^(✓|✖|⚠ SKIPPED) (\d+) ([\w-]+)/gm)].map((m) => ({
    id: m[3] ?? '',
    result: m[1] === '✓' ? 'pass' : m[1] === '✖' ? 'fail' : 'skipped',
  }))
  const lint = basalt('lint')
  const lintFindingsByRule: Record<string, number> = {}
  for (const m of lint.out.matchAll(/^\S+:\d+ ([\w/-]+):/gm)) {
    const rule = m[1] ?? ''
    lintFindingsByRule[rule] = (lintFindingsByRule[rule] ?? 0) + 1
  }
  const tokensOut = join(work, 'tokens.json')
  const tokensRun = basalt('tokens:css', '--accent', seed, '--format', 'json', '--out', tokensOut)
  const emitted = existsSync(tokensOut)
    ? (JSON.parse(readFileSync(tokensOut, 'utf8')) as {
        schemes: Record<string, Record<string, string>>
      })
    : null
  const fillTone: Record<string, number> = {}
  for (const scheme of ['light', 'dark']) {
    const fill = emitted?.schemes[scheme]?.['brand-fill']
    if (fill !== undefined) fillTone[scheme] = Math.round(hexToHct(fill).tone * 10) / 10
  }
  const navyTone = Math.round(navy.tone * 10) / 10
  const gateRefused = tokensRun.status !== 0 && /3\.0|contrast|gate/i.test(tokensRun.out)
  const navyNeedsFillTone =
    gateRefused || Object.values(fillTone).some((tone) => tone - navyTone > TONE_MARGIN)

  const tenant = tenantSets >= 2
  const flags = tenant ? 'keep' : 'delete-at-G2'

  const after = eposState()
  if (after !== before) problems.push('the epos checkout moved')
  if (init.status !== 0) problems.push('init exited non-zero')
  if (emitted === null) problems.push('tokens:css wrote nothing')

  console.log(
    JSON.stringify(
      {
        base: sh(['git', 'rev-parse', '--short', 'HEAD'], ROOT).out.trim(),
        basaltVersion: shipped.version,
        peersAdded,
        peerCounts: {
          declared: Object.keys(peers).length,
          optional: Object.values(optional).filter((m) => m.optional === true).length,
          requiredAdded: peersAdded.length,
        },
        frozenInstallRun: false,
        initExit: init.status,
        doctorExit: doctor.status,
        doctorChecks: checks,
        lintExit: lint.status,
        lintFindingsByRule,
        lintFindingsTotal: Object.values(lintFindingsByRule).reduce((a, b) => a + b, 0),
        tokensExit: tokensRun.status,
        navyTone,
        fillTone,
        toneMargin: TONE_MARGIN,
        navyNeedsFillTone,
        tenantSets,
        tenant,
        flags,
        eposStatusUnchanged: after === before,
        problems,
      },
      null,
      2,
    ),
  )
} finally {
  if (process.env['KEEP'] !== '1') rmSync(work, { recursive: true, force: true })
}
process.exit(problems.length === 0 ? 0 : 1)
