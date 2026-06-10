/**
 * Typed CSS-module declaration (the S4 CSS-modules path). Named string props — not an index
 * signature — so dot access (`classes.link`) stays verbatim under the package's strict flags
 * (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`).
 * `collapseBtn` is referenced by the component for parity with argo though it has no CSS rule.
 */
declare const classes: {
  readonly root: string
  readonly link: string
  readonly brand: string
  readonly brandLead: string
  readonly collapseBtn: string
  readonly footerBtn: string
  readonly footerText: string
  readonly sectionLabel: string
  readonly sectionHeader: string
}
export default classes
