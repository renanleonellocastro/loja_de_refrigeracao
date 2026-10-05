# syntax=docker/dockerfile:1
# Production image of the site (Nuxt server output). NUXT_PUBLIC_API_BASE is read when the container starts.
# Build from the repository root: docker build -f infra/docker/web.Dockerfile -t refrigeracao-castro-web .

FROM node:24-alpine AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@rc/web..."
RUN pnpm --filter "@rc/web^..." run build && pnpm --filter @rc/web run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    HOST=0.0.0.0 \
    PORT=3000
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt > /dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
