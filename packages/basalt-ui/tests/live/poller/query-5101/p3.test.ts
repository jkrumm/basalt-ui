/**
 * P3 on Query 5.101.2, argo's locked version. This directory is its own package (package.json and
 * bun.lock): setup installs it with `--frozen-lockfile`, then the core is imported from it. The
 */
import { p3Matrix } from '../support/p3-matrix'
import type { Core } from '../support/harness'

const dir = import.meta.dir
const install = Bun.spawnSync(['bun', 'install', '--frozen-lockfile'], { cwd: dir })
if (install.exitCode !== 0) throw new Error(`query-5101 install failed: ${install.stderr}`)

const core = (await import(
  `${dir}/node_modules/@tanstack/query-core/build/modern/index.js`
)) as Core

p3Matrix(core, '5.101.2')
