# node:25.9.0-slim
FROM node@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build

# Node 25 ships without corepack.
RUN npm install -g pnpm@12.18.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY api api
COPY web web
RUN pnpm build

# Production dependencies of the api only, in a clean tree.
RUN rm -rf node_modules api/node_modules web/node_modules && pnpm install --frozen-lockfile --prod --filter api

FROM node@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/api/node_modules api/node_modules
COPY --from=build /app/api/package.json api/
COPY --from=build /app/api/dist api/dist
COPY --from=build /app/web/dist web/dist

# The SQLite file is created in api/data on start.
RUN mkdir api/data && chown node:node api/data

USER node
WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
