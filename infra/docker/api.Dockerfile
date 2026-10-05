# syntax=docker/dockerfile:1
# Production image of the API. The same image runs the worker: `node dist/worker.js` (see compose.production.yaml).
# Build from the repository root: docker build -f infra/docker/api.Dockerfile -t refrigeracao-castro-api .

FROM node:24-alpine AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@rc/api..."
RUN pnpm --filter "@rc/api^..." run build && pnpm --filter @rc/api run build
# Self contained folder with dist, migrations (drizzle/) and only the production dependencies.
RUN pnpm --filter @rc/api deploy --prod /out \
  && rm -r /out/src /out/test /out/scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    HOST=0.0.0.0 \
    PORT=3001 \
    STORAGE_PATH=/data/storage
RUN apk add --no-cache tzdata \
  && mkdir -p /data/storage \
  && chown node:node /data/storage
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
VOLUME ["/data/storage"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
# The API applies pending migrations when it starts.
CMD ["node", "dist/server.js"]
