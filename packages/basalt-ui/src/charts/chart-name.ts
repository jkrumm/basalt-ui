/** The accessible name a chart carries: `label`, else the deprecated `ariaLabel` (removed in the next minor). */
export function chartName(props: {
  label?: string | undefined
  ariaLabel?: string | undefined
}): string {
  return props.label ?? props.ariaLabel ?? ''
}
