export async function onRequest(context) {
  const request = context.request

  // Forward the request to your VPS Plausible instance
  // Critical: Pass the original client IP so Plausible counts unique visitors correctly
  const modifiedRequest = new Request('https://plausible.jkrumm.com/api/event', {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'X-Forwarded-For': request.headers.get('cf-connecting-ip'), // Critical for accurate stats
      Host: 'plausible.jkrumm.com',
    },
    body: request.body,
  })

  return await fetch(modifiedRequest)
}
