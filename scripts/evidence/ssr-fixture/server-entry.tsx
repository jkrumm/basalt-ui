/**
 * The fixture's request handler, bundled for Bun by `build.ts` (`serve.ts` imports the bundle). `/` is
 * the streaming SSR response: `createRequestHandler` + `renderRouterToStream`, the pair
 * `defaultStreamHandler` composes, with `FixtureApp` as the children instead of `RouterServer`.
 */
import {
  createRequestHandler,
  defineHandlerCallback,
  renderRouterToStream,
} from '@tanstack/react-router/ssr/server'
import { FixtureApp, createFixtureRouter } from './app'
import type { FixtureRouter } from './app'

const stream = defineHandlerCallback(({ request, router, responseHeaders }) =>
  renderRouterToStream({
    request,
    router,
    responseHeaders,
    children: <FixtureApp router={router as FixtureRouter} />,
  }),
)

export const render = (request: Request): Promise<Response | unknown> =>
  createRequestHandler({ createRouter: createFixtureRouter, request })(stream)
