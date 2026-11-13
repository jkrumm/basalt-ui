// Blocks: see colour-literal.tsx.

// @invalid
async function follow(res) {
  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    handle(value)
  }
}

// @invalid
async function follow(res) {
  const reader = await res.clone().body.getReader()
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) return
  }
}

// @valid
async function follow(res) {
  const reader = res.body.getReader()
  const first = await reader.read()
  return first
}

// @valid
async function follow(socket) {
  while (socket.open) {
    const next = await queue.read()
    handle(next)
  }
}
