// fallow-ignore-file unused-file unused-export
/**
 * One metric with its label.
 *
 * @useWhen a page shows a single number
 * @neverWhen the number needs a chart
 */
export const StatCard = (props: { label: string; value: number }) => ({
  'data-slot': 'stat-card',
  text: `${props.label}: ${props.value}`,
})
