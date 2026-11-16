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

// @invalid
async function follow(res) {
  for await (const chunk of res.body) handle(chunk)
}

// @invalid
function follow(res) {
  const reader = res.body.getReader()
  return reader.read().then(function pump({ done, value }) {
    if (done) return
    handle(value)
    return reader.read().then(pump)
  })
}

// @invalid
async function follow(res) {
  const reader = res.body.getReader()
  async function pump() {
    const { done, value } = await reader.read()
    if (done) return
    handle(value)
    return pump()
  }
  return pump()
}

// @valid
async function follow(items) {
  for await (const item of items) handle(item)
}

// @valid
async function follow(res) {
  const reader = res.body.getReader()
  return reader.read().then(({ value }) => value)
}

// @invalid
// @ts
async function readAll(res) {
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) handle(chunk)
}

// @valid
async function first(res) {
  const reader = res.body.getReader()
  async function read() {
    const { value } = await reader.read()
    return value
  }
  return read()
}

// @invalid
// @ts
async function sink(res) {
  await res
    .body!.pipeThrough(new TextDecoderStream())
    .pipeTo(new WritableStream({ write: onChunk }))
}

// @valid
async function copy(src, dest) {
  await src.pipeTo(dest)
}

// @valid
async function toFile(res, file) {
  await res.blob().then((b) => b.stream().pipeTo(file))
}
