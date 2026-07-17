FROM oven/bun:1.3.9-slim AS builder
WORKDIR /app

# Every workspace member (packages/*, apps/*) must be present or bun re-resolves
# the tree and drifts from bun.lock — marketing itself needs neither playground
# nor the package source, only their manifests.
COPY package.json bun.lock ./
COPY apps/marketing/package.json ./apps/marketing/package.json
COPY apps/playground/package.json ./apps/playground/package.json
COPY packages/basalt-ui/package.json ./packages/basalt-ui/package.json
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY apps/marketing ./apps/marketing

RUN cd apps/marketing && bun run build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/marketing/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
  > /etc/nginx/conf.d/default.conf
EXPOSE 80
