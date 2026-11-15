/**
 * `bun test` preload — registered via `[test].preload` in bunfig.toml.
 *
 * A test that builds a throwaway repo (`git init`, `git commit`) and removes it afterwards raced git's own
 * detached auto-maintenance: `git commit` forks `gc --auto` / `maintenance run --auto` into the background, it
 * rewrites `.git` while the test's recursive `rmSync` walks it, and the removal fails with
 * `ENOENT … lstat '<dir>/.git'`. Measured 2026-11-15: 28 of 40 `init` + `commit` + `rmSync` rounds failed, and 0 of 40
 * with both settings below, on an idle host. Turning maintenance off for every git a test spawns (config rides the
 * environment, so it reaches each `spawnSync('git', …)` without a flag at each call site) removes the race.
 * A fixture repo is a few objects; there is nothing to collect.
 */
const settings: Record<string, string> = {
  'gc.auto': '0',
  'maintenance.auto': 'false',
}

const start = Number(process.env.GIT_CONFIG_COUNT ?? '0')
Object.entries(settings).forEach(([key, value], index) => {
  process.env[`GIT_CONFIG_KEY_${start + index}`] = key
  process.env[`GIT_CONFIG_VALUE_${start + index}`] = value
})
process.env.GIT_CONFIG_COUNT = String(start + Object.keys(settings).length)
