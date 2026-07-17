// Fixture for the shipped preset's `eqeqeq: ["error", "smart"]`. Not linted by the repo's own
// oxlint run (tests/fixtures is ignored) — it exists only to be linted BY a test, so the two
// comparisons below are deliberate.
export function nullish(value: string | null | undefined): boolean {
  // The deliberate nullish idiom — `smart` must allow this.
  return value != null
}

export function loose(a: string, b: number): boolean {
  // A genuine loose comparison — `smart` must still flag this.
  return a == b
}
