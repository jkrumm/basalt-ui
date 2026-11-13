// Blocks: see colour-literal.tsx.

// @invalid
setInterval(() => queryClient.invalidateQueries({ queryKey: ['gyms'] }), 5000)

// @invalid
const timer = window.setInterval(function () {
  void query.refetch()
}, 30_000)

// @invalid
setTimeout(() => {
  if (stale) refetch()
}, 1000)

// @invalid
setInterval(async () => {
  await queryClient.refetchQueries({ queryKey: ['jobs'] })
}, 5000)

// @valid
setInterval(() => tick(Date.now()), 1000)

// @valid
setInterval(poll, 5000)

// @valid
const id = setTimeout(() => setOpen(false), 300)

// @valid
queryClient.invalidateQueries({ queryKey: ['gyms'] })
