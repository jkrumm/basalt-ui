/**
 * The peers a profile needs beyond the lint tools: what `init` installs and what `doctor` check 3
 * names, one table so the two cannot drift. Runtime peers go in `dependencies`, build peers in
 * `devDependencies`. `react` and `react-dom` are the app's own and `init` never installs them.
 */
import type { Profile } from './manifest'

const FRAME = ['tailwindcss', '@base-ui/react'] as const
const APP_RUNTIME = ['@tanstack/react-query', '@tanstack/react-router'] as const

export const RUNTIME_PEERS: Readonly<Record<Profile, readonly string[]>> = {
  tokens: [],
  bridge: FRAME,
  parts: FRAME,
  app: [...FRAME, ...APP_RUNTIME],
}

export const BUILD_PEERS: Readonly<Record<Profile, readonly string[]>> = {
  tokens: [],
  bridge: ['@tailwindcss/vite'],
  parts: ['@tailwindcss/vite'],
  app: ['@tailwindcss/vite', '@tanstack/router-plugin'],
}
