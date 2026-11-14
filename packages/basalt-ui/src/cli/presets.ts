/**
 * The generated preset files `sync` places (and `init` first writes) for a manifest:
 * `.stylelintrc.basalt.json` for every profile and `.oxlintrc.basalt.json` for `bridge` and above.
 * The oxlint bytes come from the shipped `configs/oxlint-<profile>.json` (generated from the rule
 * table by `scripts/gen-oxlint.ts`); a root declared at another profile adds one `overrides` block
 * carrying that profile's `rules`, the way `buildPreset` (src/lint/preset.ts) lays them out.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderStylelintConfig } from '../lint/stylelint/render'
import { PRESET_FILE } from '../lint/weakened'
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

const rootGlob = (root: string): string => `${root.replace(/\/+$/, '')}/**`

/**
 * The oxlint preset text for a manifest, or null when every declared file lints at `tokens`. The
 * base is the default profile's preset (the highest declared one when the default is `tokens`).
 */
export function renderOxlintPreset(manifest: Manifest, pkgRoot: string): string | null {
  const above = [manifest.profile, ...Object.values(manifest.roots)].filter(
    (p): p is Exclude<Profile, 'tokens'> => p !== 'tokens',
  )
  const [base] = above
  if (base === undefined) return null
  const preset = readShippedPreset(pkgRoot, base)
  const overrides = Object.entries(manifest.roots)
    .filter(([, profile]) => profile !== 'tokens' && profile !== base)
    .map(([root, profile]) => ({
      files: [rootGlob(root)],
      rules: readShippedPreset(pkgRoot, profile as Exclude<Profile, 'tokens'>).rules ?? {},
    }))
  const next = { ...preset, overrides: [...(preset.overrides ?? []), ...overrides] }
  return `${JSON.stringify(next, null, 2)}\n`
}

/** The `presetFiles` seam of `sync`: both presets as generated units. */
export function presetFilesFor(pkgRoot: string = packageRoot()): PresetFiles {
  return (manifest: Manifest): Unit[] => {
    const units: Unit[] = [
      {
        path: STYLELINT_PRESET_FILE,
        content: renderStylelintConfig({ ignoreFiles: manifest.tokens.map((t) => t.out) }),
      },
    ]
    const oxlint = renderOxlintPreset(manifest, pkgRoot)
    if (oxlint !== null) units.push({ path: OXLINT_PRESET_FILE, content: oxlint })
    return units
  }
}

/** `presetFiles(manifest)`: the preset units of the package that is running. */
export const presetFiles: PresetFiles = (manifest) => presetFilesFor()(manifest)
