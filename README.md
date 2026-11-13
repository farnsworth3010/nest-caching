# nest-caching

A hands-on demo of Redis with NestJS and Kubernetes. Each topic is a page in the web app: an explanation of the pattern, example buttons, and a "Redis commands" panel that lists the exact commands the backend ran for the request (args, reply, duration).

- `api/` — NestJS (Node 25), SQLite via built-in `node:sqlite`, Redis via `redis` (node-redis)
- `web/` — React + Vite, one page per topic, hash navigation, English and Russian (i18next)
- `deploy/` — Docker Compose, and Kubernetes manifests for kind

## Screenshots

Cache-aside: flow diagram, a latency chart of cache hits vs. database misses, and the Redis commands behind the last request.

![Cache-aside page](docs/screenshots/cache-aside.png)

Health: Redis and SQLite connectivity check.

![Health page](docs/screenshots/health.png)

Data types, sorted set: a leaderboard drawn from `ZRANGE … REV WITHSCORES`, next to the command cheat sheet.

![Data types: sorted set](docs/screenshots/types-sorted-set.png)

Data types, stream: one consumer group, two workers, entries shown as new, pending or acknowledged.

![Data types: stream](docs/screenshots/types-stream.png)

Data types, HyperLogLog: 100 000 visitor ids counted to within about 1% in 14 KB, against an exact Set of several MB.

![Data types: HyperLogLog](docs/screenshots/types-hll.png)

Rate limiter: a fixed window of 5 requests per 10 s; 20 requests sent across a window edge, and 10 of them pass, twice the limit.

![Rate limiter](docs/screenshots/rate-limit.png)

Distributed lock: 30 concurrent buyers and 10 units in stock. Without the lock all 30 buy; with `SET NX PX` and a token-checked Lua release, exactly 10 do.

![Distributed lock](docs/screenshots/lock.png)

Replication and Sentinel: the master container stopped by hand during a 30 s probe; writes fail for about 6 s until the Sentinels promote `:6381`.

![Replication: master stopped](docs/screenshots/replication-failover.png)

Replication: `INCR` on the master, `GET` on each replica right away and after `WAIT 2 100`, then reads spread over the replicas; every command is tagged with the node that ran it.

![Replication: write, WAIT and replica reads](docs/screenshots/replication-write.png)

Redis Cluster: the 16384-slot map colored by master after 200 slots moved to the added node 7006, node cards with key counts, and where 500 keys landed.

![Cluster: slot map and key distribution](docs/screenshots/cluster-slots.png)

Redis Cluster: hash tags put `user:{42}:*` in one slot, an untagged `COPY` fails with `CROSSSLOT`; resharding catches a real `-ASK` mid-migration and a `-MOVED` afterwards, and the moved values read back intact.

![Cluster: hash tags and resharding redirects](docs/screenshots/cluster-reshard.png)

Kubernetes, HPA: 60 s of CPU load from the page scaled the api from 2 to 5 pods; the pod list comes from Redis heartbeats. The new pods got no load, because the browser keeps its connections to the old ones.

![Kubernetes: HPA scale-up](docs/screenshots/k8s-hpa.png)

Kubernetes, Redis failover: the master pod deleted during a 30 s probe; 2 pings fail (about 4 s) until Sentinel promotes `redis-0`, and every command is tagged with the Redis pod that ran it.

![Kubernetes: Redis master pod deleted](docs/screenshots/k8s-failover.png)

Real world, semantic cache: paraphrases of a cached question come back in 1–3 ms with a VSIM score above 0.9; other questions miss and wait for the simulated model (1.5 s). The model is fake; the vector set and commands are real.

![Real world: semantic cache hits and misses](docs/screenshots/real-world-semantic-cache.png)

Real world, job queue: worker-a crashes before XACK, and worker-b takes the job over with XAUTOCLAIM once it has been idle for 3 s.

![Real world: job queue reclaim](docs/screenshots/real-world-job-queue.png)

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

The web app is in English and Russian: the EN/RU button in the header switches the language and remembers the choice in `localStorage`; the first visit follows the browser language.

Environment: `PORT` (API, default 3000), `REDIS_URL` (default `redis://localhost:6379`), `DEV_HOST` (Vite host, default `localhost`), `REDIS_SENTINELS` (`host:port,…`, connect through Sentinel instead of `REDIS_URL`) with `REDIS_MASTER_NAME` (default `mymaster`), `WEB_DIST` (serve the built web app from the API, used in the container image).

Other scripts: `pnpm build`, `pnpm typecheck`, and `pnpm --filter api test` (lock helper tests, needs Redis running).

### Replication and Sentinel

```sh
docker compose -f deploy/compose.replication.yaml up -d --wait
```

A master on 6380, replicas on 6381 and 6382, Sentinels on 26380–26382, all on host networking bound to 127.0.0.1 (Linux). The Replication page works without it and shows the nodes as down.

To kill the master for real, click "Probe 30 s" and stop the container of the current master (the page shows which one), e.g. `docker compose -f deploy/compose.replication.yaml stop redis-6380`. After about 3 s the Sentinels agree it is down and promote a replica. `docker compose -f deploy/compose.replication.yaml start redis-6380` brings it back as a replica of the new master. `down` followed by `up` starts over with 6380 as the master.

### Redis Cluster

```sh
docker compose -f deploy/compose.cluster.yaml up -d --wait
```

Three masters on 7000–7002 with replicas on 7003–7005, formed by a one-shot `redis-cli --cluster create`, plus spare nodes 7006 and 7007 that are running but not joined; host networking, bound to 127.0.0.1 (Linux). The Cluster page connects lazily, so the API runs without it. "Add node" meets 7006 into the cluster with 7007 as its replica, "Move N slots" reshards with `SETSLOT IMPORTING/MIGRATING`, `MIGRATE` and `SETSLOT NODE`, and "Reset" moves every slot back and removes 7006/7007. Nothing is persisted, so if a reshard dies midway, `docker compose -f deploy/compose.cluster.yaml down` followed by `up -d --wait` starts a fresh cluster.

### Run on Kubernetes

Needs [kind](https://kind.sigs.k8s.io/) v0.33 and kubectl.

```sh
deploy/kind/up.sh
```

It creates the kind cluster `nest-caching` (1 control-plane, 2 workers) if missing, builds the app image from the root `Dockerfile` (api + built web in one Node image), loads it into kind with `kind load docker-image`, applies metrics-server (`kubectl apply -k deploy/k8s/metrics-server`) and the app (`kubectl apply -k deploy/k8s`), then restarts the api. Rerun it after code changes.

Open http://127.0.0.1:8080/#k8s. Port 8080 binds to `KIND_LISTEN` (default `127.0.0.1`; Docker-published ports bypass ufw). To open it from another machine, create the cluster with e.g. `KIND_LISTEN=<tailscale-ip> deploy/kind/up.sh`; the address is fixed when the cluster is created.

In the `nest-caching` namespace: the api Deployment (2–5 pods, HPA at 50% CPU, NodePort 30080) and a Redis StatefulSet `redis-0..2` with Sentinel as a sidecar and a PVC per pod. The api finds the master through `REDIS_SENTINELS`; without it (local dev) it uses `REDIS_URL`.

```sh
kubectl -n nest-caching get hpa api -w                # watch the autoscaler
kubectl -n nest-caching delete pod redis-0            # kill the Redis master (check which one first, see the page)
kind delete cluster --name nest-caching               # tear down
```

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
7. Redis in the real world: sessions, leaderboard, feed fan-out, job queue, presence, idempotency keys, and Redis next to an LLM (semantic cache, chat memory, token budget, RAG) with a simulated model
8. English and Russian UI with an EN/RU switch
