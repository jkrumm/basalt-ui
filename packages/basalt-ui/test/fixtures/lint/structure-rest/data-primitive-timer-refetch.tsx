// Blocks: see color-literal.tsx.

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

// @invalid
setInterval(() => void router.invalidate(), 15_000)

// @invalid
window.setTimeout(() => {
  router.invalidate()
}, 1000)

// @valid
router.invalidate()

// @invalid
useInterval(() => void qc.invalidateQueries({ queryKey: ['runs'] }), 10_000)

// @invalid
useInterval(function () {
  void query.refetch()
}, 5000)

// @valid
useInterval(() => setTick((n) => n + 1), 1000)

// @valid
useInterval(refresh, 5000)

// @valid
useTimeout(() => qc.invalidateQueries({ queryKey: ['runs'] }), 5000)

// @invalid
setInterval(refetch, 5000)

// @invalid
setInterval(query.refetch, 5000)

// @invalid
window.setTimeout(router.invalidate, 1000)

// @invalid
useInterval(refetch, 5000)

// @valid
setInterval(tick, 5000)

// @valid
setInterval(query.poll, 5000)
