import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

const major = (version: string): string => version.split('.')[0]

describe('plugin version lockstep', () => {
  it('plugin.json and package.json share a major version (one doctrine generation)', () => {
    const pluginJson = JSON.parse(
      readFileSync(join(root, 'plugins/basalt/.claude-plugin/plugin.json'), 'utf8'),
    )
    const packageJson = JSON.parse(
      readFileSync(join(root, 'packages/basalt-ui/package.json'), 'utf8'),
    )

    // Major-version, NOT exact: semantic-release bumps packages/basalt-ui/package.json on every
    // patch/minor release and commits it back (.releaserc.json exec + git), but the
    // isolated-basalt-ui lefthook guard forbids that release commit from also staging the
    // non-package plugin.json. Exact lockstep would therefore break CI on the second release.
    // Majors are rare and bumped by hand, so a shared major still answers "which doctrine
    // generation am I on?" without coupling the plugin manifest to every npm patch.
    expect(major(pluginJson.version)).toBe(major(packageJson.version))
  })
})
