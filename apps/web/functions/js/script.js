export async function onRequest(_context) {
  // Fetch the script from your self-hosted Plausible instance
  const response = await fetch('https://plausible.jkrumm.com/js/script.js')
  const script = await response.text()

  // Return it as if it's a local file
  return new Response(script, {
    headers: {
      'content-type': 'application/javascript',
      'cache-control': 'public, max-age=86400', // Cache for 24h
    },
  })
}
