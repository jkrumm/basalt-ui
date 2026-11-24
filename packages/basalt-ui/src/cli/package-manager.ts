/**
 * The consumer's package manager, read from the lockfile in the install directory or the nearest
 * one above it (up to the git root), npm without one. Every fix-it line that names an install renders
 * from here, so an npm, pnpm or yarn project is never told to run `bun add`. A leaf module.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'

const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
]

/** The directory holding the lockfile `dir` installs with: `dir` itself, else the nearest one above it. */
function lockDir(dir: string): { at: string; pm: PackageManager } | null {
  for (let at = resolve(dir); ; at = dirname(at)) {
    const hit = LOCKFILES.find(([file]) => existsSync(resolve(at, file)))
    if (hit !== undefined) return { at, pm: hit[1] }
    if (existsSync(resolve(at, '.git')) || dirname(at) === at) return null
  }
}

export function packageManager(dir: string): PackageManager {
  return lockDir(dir)?.pm ?? 'npm'
}

/** `add` (`--dev` for tools), saving the resolved version exactly unless `exact` is false, as argv, for the package manager `dir` installs with. */
export function addCommand(
  dir: string,
  specs: readonly string[],
  dev = true,
  exact = true,
): string[] {
  const found = lockDir(dir)
  const pm = found?.pm ?? 'npm'
  const [x, sx] = exact ? [['--exact'], ['--save-exact']] : [[], []]
  if (pm === 'bun') return ['bun', 'add', ...(dev ? ['--dev'] : []), ...x, ...specs]
  if (pm === 'pnpm') {
    const workspace = existsSync(resolve(found?.at ?? dir, 'pnpm-workspace.yaml')) ? ['-w'] : []
    return ['pnpm', 'add', ...(dev ? ['--save-dev'] : []), ...sx, ...workspace, ...specs]
  }
  if (pm === 'yarn') return ['yarn', 'add', ...(dev ? ['--dev'] : []), ...x, ...specs]
  return ['npm', 'install', ...(dev ? ['--save-dev'] : ['--save']), ...sx, ...specs]
}

/** The line that installs what the lockfile already names: `npm install`, `bun install`, ... */
export const installAllCommand = (dir: string): string => `${packageManager(dir)} install`

/** The runner of a package bin the project installs: `npx`, `bunx`, `pnpm exec`, `yarn`. */
export function execCommand(dir: string): string {
  const pm = packageManager(dir)
  return pm === 'bun' ? 'bunx' : pm === 'pnpm' ? 'pnpm exec' : pm === 'yarn' ? 'yarn' : 'npx'
}

/** The two commands `shot` needs: Playwright as a dev dependency, then its Chromium. */
export const playwrightInstall = (dir: string): string =>
  `${addCommand(dir, ['playwright']).join(' ')} && ${execCommand(dir)} playwright install chromium`
