// Blocks: a `// @valid` or `// @invalid` header starts one (see structure-rest/color-literal.tsx).

// @invalid
const a = <Link to="/runs" search={{ range: '30d' }} />

// @invalid
const a = <Link to="/runs" search={(prev) => ({ ...prev, range: '30d' })} />

// @invalid
const a = (
  <Link
    to="/runs"
    search={function (prev) {
      return { range: '30d' }
    }}
  />
)

// @invalid
const go = () => navigate({ to: '/runs', search: { status: 'failed' } })

// @invalid
const go = () => router.navigate({ to: '/runs', search: (prev) => ({ ...prev, status: 'failed' }) })

// @valid
const go = () => navigate({ to: '/runs', search: store.field.status.link('failed') })

// @valid
const go = () => navigate({ to: '/runs' })

// @valid
const go = () => navigate({ to: '/runs', search })

// @valid
const go = () => other({ to: '/runs', search: { status: 'failed' } })

// @valid
const a = <Link to="/runs" search={store.field.range.link()} />

// @valid
const a = <Link to="/runs" search={search} />

// @valid
const a = <Link to="/runs" search={(prev) => prev} />

// @valid
const a = <Link to="/runs" />

// @valid
const a = <a href="/runs" search={{ range: '30d' }} />

// @invalid
const route = {
  beforeLoad: () => {
    throw redirect({ to: '/runs', search: { status: 'all' } })
  },
}

// @invalid
const route = {
  beforeLoad: () => router.redirect({ to: '/runs', search: (prev) => ({ ...prev }) }),
}

// @valid
const route = {
  beforeLoad: () => {
    throw redirect({ to: '/runs', search: store.field.status.link('all') })
  },
}

// @valid
const route = {
  beforeLoad: () => {
    throw redirect({ to: '/login' })
  },
}

// @invalid
const a = <Navigate to="/runs" search={{ status: 'all' }} />

// @invalid
const a = <Navigate to="/runs" search={(prev) => ({ ...prev, status: 'all' })} />

// @valid
const a = <Navigate to="/runs" search={store.field.status.link('all')} />

// @valid
const a = <Navigate to="/runs" search={(prev) => prev} />

// @valid
const a = <Navigate to="/runs" />

// @invalid
const a = <Link to="/runs?status=failed" />

// @invalid
const a = <Link to={`/runs?status=${status}`} />

// @invalid
const go = () => navigate({ to: '/runs?status=failed' })

// @invalid
const go = () => redirect({ to: `/runs?tab=${tab}` })

// @invalid
const go = (name) => window.history.pushState({}, '', `?tab=${name}`)

// @invalid
const go = () => history.replaceState(null, '', '/runs?status=failed')

// @valid
const a = <Link to="/runs/$id" />

// @valid
const a = <Link to={`/runs/${id}`} />

// @valid
const go = () => window.history.pushState({}, '', '/runs')

// @valid
const go = () => window.history.pushState({}, '', url)

// @valid
const go = () => other.pushState({}, '', '/runs?a=1')

// @valid
const a = <a href="/runs?status=failed" />
