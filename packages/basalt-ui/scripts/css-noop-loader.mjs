/** Module-customization hook: any `.css` URL loads as an empty default export. */
export async function load(url, context, nextLoad) {
  if (url.split('?')[0].endsWith('.css')) {
    return { format: 'module', source: 'export default {}', shortCircuit: true }
  }
  return nextLoad(url, context)
}
