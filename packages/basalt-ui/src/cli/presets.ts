/**
 * The generated preset files `sync` places (and `init` first writes) for a manifest:
 * `.stylelintrc.basalt.json` for every profile and `.oxlintrc.basalt.json` for `bridge` and above.
 * The oxlint preset is `buildPreset` (src/lint/preset.ts) over the manifest's roots and ejected
 * paths and bespoke directories: the same builder `scripts/gen-oxlint.ts` writes `configs/oxlint-<profile>.json` with, so a
 * root at another profile, a bridge root's vendored zone and an ejected file's zone all come out
 * as they do there.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import plugin from '../lint'
import { tableOf } from '../lint/factory'
import type { Contract } from '../lint/preset'
import { buildPreset } from '../lint/preset'
import { renderStylelintConfig } from '../lint/stylelint/render'
import { rootsOf } from './doctor/types'
import { PRESET_FILE } from '../lint/weakened'
import { SLOTS } from '../ui/slots'
import { readRow } from './eject/ledger'
import { packageRoot } from './index'
import type { Manifest, Profile } from './manifest'
import type { PresetFiles, Unit } from './sync/render'

export const STYLELINT_PRESET_FILE = '.stylelintrc.basalt.json'
export const OXLINT_PRESET_FILE = PRESET_FILE

type Preset = {
  rules?: Record<string, unknown>
  overrides?: { files: string[]; rules: Record<string, unknown> }[]
  settings?: { basalt?: { pins?: Record<string, string> } }
}

/** The shipped preset of a profile above `tokens`, parsed. */
export function readShippedPreset(pkgRoot: string, profile: Exclude<Profile, 'tokens'>): Preset {
  const file = resolve(pkgRoot, `configs/oxlint-${profile}.json`)
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Preset
  } catch {
    throw new Error(`${pkgRoot} ships no usable configs/oxlint-${profile}.json`)
  }
}

type Contracts = readonly Contract[]

/** The no-restyle contracts the shipped `parts`/`app` presets carry; `bridge` ships none. */
function shippedContracts(pkgRoot: string): Contracts {
  for (const profile of ['app', 'parts'] as const) {
    try {
      const restyle = readShippedPreset(pkgRoot, profile).rules?.['shadcn/no-restyle']
      const options = Array.isArray(restyle) ? (restyle[1] as { contracts?: Contracts }) : undefined
      if (options?.contracts) return options.contracts
    } catch {
      // A package that ships only some profiles has no contracts to carry from the others.
    }
  }
  return []
}

/** `manifest.ejected[*].path`; a malformed row is left to `eject`/`doctor` to name. */
function ejectedPaths(manifest: Manifest): string[] {
  return Object.values(manifest.ejected).flatMap((row) => {
    const parsed = readRow(row)
    return parsed === null ? [] : [parsed.path]
  })
}

/**
 * The oxlint preset text for a manifest, or null when every declared file lints at `tokens`. The
 * base is the default profile's preset (the highest declared one when the default is `tokens`).
 * It is built by `buildPreset`, the one builder the shipped files come from, so a root's rules
 * block, zone V (a bridge root's `components/ui`) and zone E (`manifest.ejected`) are the same
 * blocks the shipped presets lay out.
 */
export function renderOxlintPreset(manifest: Manifest, pkgRoot: string): string | null {
  const above = [manifest.profile, ...Object.values(manifest.roots)].filter(
    (p): p is Exclude<Profile, 'tokens'> => p !== 'tokens',
  )
  const [base] = above
  if (base === undefined) return null
  const pins = readShippedPreset(pkgRoot, base).settings?.basalt?.pins
  const roots = Object.fromEntries(
    Object.entries(manifest.roots).filter(([, profile]) => profile !== 'tokens'),
  )
  const preset = buildPreset({
    table: tableOf(plugin),
    pins: { oxlint: pins?.['oxlint'] ?? '', shadcnLint: pins?.['@shadcn/lint'] ?? '' },
    contracts: shippedContracts(pkgRoot),
    uiSlots: SLOTS,
    profile: base,
    roots,
    ejected: ejectedPaths(manifest),
    classPrefixes: manifest.classPrefixes ?? [],
    bespoke: manifest.bespoke ?? [],
  })
  return preset === undefined ? null : `${JSON.stringify(preset, null, 2)}\n`
}

const scrolls = (profile: Profile): boolean => profile !== 'tokens' && profile !== 'bridge'

/**
 * The stylelint preset text for a manifest. The scroll-container ban needs `ui/scroll-area`, which
 * ships from `parts` up, so a `tokens` or `bridge` root renders without it; files outside every
 * root follow the manifest's own profile.
 */
export function renderStylelintPreset(manifest: Manifest): string {
  return renderStylelintConfig({
    ignoreFiles: manifest.tokens.map((t) => t.out),
    scroll: {
      base: scrolls(manifest.profile),
      roots: Object.fromEntries(
        rootsOf(manifest).map(([root, profile]) => [root, scrolls(profile)]),
      ),
    },
  })
}

/** The `presetFiles` seam of `sync`: both presets as generated units. */
export function presetFilesFor(pkgRoot: string = packageRoot()): PresetFiles {
  return (manifest: Manifest): Unit[] => {
    const units: Unit[] = [
      {
        path: STYLELINT_PRESET_FILE,
        content: renderStylelintPreset(manifest),
      },
    ]
    const oxlint = renderOxlintPreset(manifest, pkgRoot)
    if (oxlint !== null) units.push({ path: OXLINT_PRESET_FILE, content: oxlint })
    return units
  }
}

/** `presetFiles(manifest)`: the preset units of the package that is running. */
export const presetFiles: PresetFiles = (manifest) => presetFilesFor()(manifest)
