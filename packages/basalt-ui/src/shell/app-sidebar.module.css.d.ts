/**
 * Typed CSS-module declaration (the S4 CSS-modules path). Named string props — not an index
 * signature — so dot access (`classes.link`) stays verbatim under the package's strict flags
 * (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`).
 * `collapseBtn` is referenced by the component for parity with argo though it has no CSS rule.
 */
declare const classes: {
  readonly root: string
  readonly link: string
  readonly navItem: string
  readonly brand: string
  readonly brandLead: string
  readonly nav: string
  readonly collapseBtn: string
  readonly footer: string
  readonly footerBtn: string
  readonly footerText: string
  readonly accountRow: string
  readonly accountText: string
  readonly accountBadges: string
  readonly sectionLabel: string
  readonly sectionBand: string
  readonly sectionHeader: string
  readonly subnavDropdown: string
  readonly childList: string
}
export default classes
