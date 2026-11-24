# syntax=docker/dockerfile:1
FROM oven/bun:1.4.1-slim AS builder
WORKDIR /app

# Every workspace member (packages/*, apps/*) must be present or bun re-resolves
# the tree and drifts from bun.lock — marketing needs the playground's and the expression app's manifests
# only, and builds basalt-ui from source: the site renders basalt-ui/static.
COPY package.json bun.lock ./
COPY apps/marketing/package.json ./apps/marketing/package.json
COPY apps/playground/package.json ./apps/playground/package.json
COPY apps/expression/package.json ./apps/expression/package.json
COPY apps/playground-astro/package.json ./apps/playground-astro/package.json
COPY packages/basalt-ui/package.json ./packages/basalt-ui/package.json
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json tsconfig.base.json ./
COPY packages/basalt-ui ./packages/basalt-ui
RUN cd packages/basalt-ui && bun run build

COPY apps/marketing ./apps/marketing
RUN cd apps/marketing && bun run build

FROM nginx:1.30-alpine
COPY --from=builder /app/apps/marketing/dist /usr/share/nginx/html
COPY apps/marketing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
