/** Dev-mode gate. Bundlers constant-fold `process.env.NODE_ENV` so the branch disappears in production builds. */
export function isDev(): boolean {
  return process.env['NODE_ENV'] !== 'production'
}
