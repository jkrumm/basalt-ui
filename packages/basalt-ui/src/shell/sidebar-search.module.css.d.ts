/**
 * Typed CSS-module declaration (the S4 CSS-modules path). Named string props — not an index
 * signature — so dot access (`classes.trigger`) stays verbatim under the package's strict flags
 * (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`).
 */
declare const classes: {
  readonly trigger: string
  readonly label: string
  readonly railBtn: string
}
export default classes
