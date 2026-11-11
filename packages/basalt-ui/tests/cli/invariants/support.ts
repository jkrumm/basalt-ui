/**
 * Shared harness for the CLI invariant tests (docs/v3/concepts/skills-agent-layer.md section 6).
 * Each invariant test drives the CLI through `run()`, the one public dispatch, against a throwaway
 * repo on disk, and reads the result from the exit code, the printed text and the file tree.
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from '../../../src/cli/index'

export const PKG_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export type CliResult = { code: number; log: string }

/** Runs the CLI in-process with console captured; `env` is applied for the call only. */
export async function cli(
  argv: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<CliResult> {
  const saved = { log: console.log, error: console.error, env: { ...process.env } }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  Object.assign(process.env, env)
  try {
    return { code: await run(argv, cwd), log }
  } catch (error) {
    return { code: 1, log: `${log}${(error as Error).message}\n` }
  } finally {
    console.log = saved.log
    console.error = saved.error
    for (const key of Object.keys(env)) {
      if (saved.env[key] === undefined) delete process.env[key]
      else process.env[key] = saved.env[key]
    }
  }
}

const dirs: string[] = []

/** A fresh temp repo (a `.git` dir marks the root) holding the given files. */
export function makeRepo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-inv-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  write(
    dir,
    'package.json',
    JSON.stringify({ name: 'fixture', devDependencies: { 'basalt-ui': '^3.0.0' } }),
  )
  for (const [path, content] of Object.entries(files)) write(dir, path, content)
  return dir
}

export function cleanupRepos(): void {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
}

export function write(dir: string, path: string, content: string): void {
  const abs = join(dir, path)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

export function read(dir: string, path: string): string {
  return readFileSync(join(dir, path), 'utf8')
}

/** Every file under `root` as `relative path -> content`: the zero-writes oracle. */
export function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (name === '.git') continue
      if (statSync(abs).isDirectory()) walk(abs)
      else out.set(relative(root, abs), readFileSync(abs, 'utf8'))
    }
  }
  walk(root)
  return out
}

/** Every file under a directory of the package, as absolute paths. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name)
    return statSync(abs).isDirectory() ? filesUnder(abs) : [abs]
  })
}
