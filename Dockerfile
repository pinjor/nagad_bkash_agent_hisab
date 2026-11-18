# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/server/sql ./server/sql
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
