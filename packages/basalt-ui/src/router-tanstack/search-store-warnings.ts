/**
 * `createSearchStore`'s dev diagnostics and the once-only bookkeeping behind them, so the store
 * body is the lane logic only. Every function is silent in production except `patchOwned`, which
 * keeps the write and logs it.
 */

const isProd = (): boolean => process.env['NODE_ENV'] === 'production'

function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function patchOwnsFieldMessage(input: {
  key: string
  name: string
  owner: string
  param: string
}): string {
  const { key, name, owner, param } = input
  return (
    `basalt-ui: createSearchStore('${key}'): set('${name}', …, { patch }) carries \`${param}\`, ` +
    `which this store's field '${owner}' owns — the URL would take it while the localStorage ` +
    'mirror kept the old value, so the next paramless visit and every `linkSearch` link disagree ' +
    `with the page the write happened on. Write it through \`field.${owner}.use()[1]\` instead; ` +
    'a `patch` is for keys the store does NOT own.'
  )
}

export function createStoreWarnings(key: string) {
  let pinned = false
  const nowhere = new Set<string>()
  const patchDropped = new Set<string>()
  const patchOwner = new Set<string>()
  const foreign = new Set<string>()

  const warn = (message: string): void =>
    // oxlint-disable-next-line no-console -- a dev-time wiring warning has no other channel
    console.warn(`[basalt-ui] createSearchStore('${key}'): ${message}`)

  return {
    /**
     * Once per store: the URL pins `fallback` while something else is persisted and no reader was
     * ever called — almost always a nav link declaring the param as a module-scope literal.
     */
    linkPinsFallback(input: {
      readerWired: boolean
      param: string
      urlValue: unknown
      storedValue: unknown
    }): void {
      if (pinned || input.readerWired || isProd()) return
      pinned = true
      const { param } = input
      const urlValue = describeValue(input.urlValue)
      warn(
        `the URL pinned \`${param}=${urlValue}\` (the fallback) while '${describeValue(input.storedValue)}' ` +
          'was persisted, and nothing has read this store back. A nav link is almost certainly ' +
          `declaring \`search: { ${param}: '${urlValue}' }\` at module scope, which overrides the ` +
          "stored value on every click — pass the store's own reader instead: " +
          '`search: <store>.linkSearch`. (dev only)',
      )
    },
    /** Once per field: a `persist: false` write from a route that does not validate it goes nowhere. */
    writeHasNowhereToGo(input: { name: string; param: string }): void {
      if (isProd() || nowhere.has(input.name)) return
      nowhere.add(input.name)
      warn(
        `wrote field '${input.name}' from a route that does not validate \`${input.param}\`, and ` +
          'the field is `persist: false` — so the write was dropped. Either render this control on ' +
          'the route wired to `validateSearch`, or give the field the localStorage lane (drop ' +
          '`persist: false`) so a write from elsewhere survives until the owning route reads it. ' +
          '(dev only)',
      )
    },
    /** Once per field: a patched write from a route that does not validate the field. */
    patchWasDropped(input: { name: string; param: string }): void {
      if (isProd() || patchDropped.has(input.name)) return
      patchDropped.add(input.name)
      warn(
        `wrote field '${input.name}' with a \`patch\` from a route that does not validate ` +
          `\`${input.param}\` — the field's value persisted (A1), but the patch was DROPPED: there ` +
          'is no navigate to merge it into. Render the control on the route wired to ' +
          '`validateSearch`, or apply that sibling param on the route that owns it. (dev only)',
      )
    },
    /**
     * A `patch` named a param another field of this store owns: thrown in dev (one-line fix, silent
     * damage), kept and logged once in production so a stale param cannot take a page down.
     */
    patchOwned(input: { name: string; owner: string; param: string }): void {
      const message = patchOwnsFieldMessage({ key, ...input })
      if (!isProd()) throw new Error(message)
      if (patchOwner.has(input.param)) return
      patchOwner.add(input.param)
      // oxlint-disable-next-line no-console -- production keeps the write; the log is the record
      console.error(message)
    },
    /**
     * Once per field: the param is in the URL, yet this store's `validateSearch` has never run — so
     * a different store or a hand-rolled schema owns it, and presence-based ownership will let this
     * store's setter navigate on its behalf.
     */
    foreignParam(input: { name: string; param: string }): void {
      if (isProd() || foreign.has(input.name)) return
      foreign.add(input.name)
      warn(
        `\`${input.param}\` (field '${input.name}') is in the URL but this store's ` +
          '`validateSearch` has never run — another store or schema owns the param, and a write ' +
          'here will navigate for it. Wire `validateSearch: <store>.validateSearch` (or spread it ' +
          'into your own) on the route that owns the param. (dev only)',
      )
    },
  }
}
