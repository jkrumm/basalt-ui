/** Hydration entry: dehydrated router state first, then `hydrateRoot` over the whole document. */
import { hydrate } from '@tanstack/react-router/ssr/client'
import { hydrateRoot } from 'react-dom/client'
import 'basalt-ui/styles.css'
import '@mantine/dates/styles.layer.css'
import { FixtureApp, createFixtureRouter } from './app'
import { MARK_HYDRATE_START } from './contract'

const router = createFixtureRouter()
await hydrate(router)
performance.mark(MARK_HYDRATE_START)
hydrateRoot(document, <FixtureApp router={router} />)
