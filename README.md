# nest-caching

A hands-on demo of Redis with NestJS and Kubernetes. Each topic is a page in the web app: an explanation of the pattern, example buttons, and a "Redis commands" panel that lists the exact commands the backend ran for the request (args, reply, duration).

- `api/` — NestJS (Node 25), SQLite via built-in `node:sqlite`, Redis via `redis` (node-redis)
- `web/` — React + Vite, one page per topic, hash navigation
- `deploy/` — Docker Compose now, Kubernetes (kind) later

## Prerequisites

- Node 25 (`nvm use`)
- pnpm (the version pinned in `packageManager` is picked up automatically)
- Docker with Compose

## Run

```sh
pnpm install
docker compose -f deploy/compose.yaml up -d --wait
pnpm dev
```

- API: http://localhost:3000/api/health
- Web: http://localhost:5173

To open the web app from another machine, start it on a reachable address, e.g. `DEV_HOST=<tailscale-ip> pnpm dev`, then open `http://<tailscale-ip>:5173`.

The first API start creates `api/data/demo.db` and seeds 5 000 products and 300 000 reviews.

Environment: `PORT` (API, default 3000), `REDIS_URL` (default `redis://localhost:6379`), `DEV_HOST` (Vite host, default `localhost`).

Other scripts: `pnpm build`, `pnpm typecheck`.

## Supply chain

`pnpm-workspace.yaml` only installs package versions that are at least 7 days old, blocks dependency build scripts, rejects trust downgrades and exotic transitive sources, and saves exact versions.

## Phases

0. Skeleton: workspace, Redis in Compose, health check, command log
1. Cache-aside with a latency chart and a "flush cache" button
2. Every Redis data type
3. Rate limiter and distributed lock
4. Replication and Sentinel
5. Redis Cluster and resharding
6. Kubernetes deploy with kind
