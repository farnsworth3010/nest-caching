#!/usr/bin/env bash
# Creates the kind cluster (if missing), builds and loads the app image, applies the manifests.
# KIND_LISTEN: host address for port 8080. Docker-published ports bypass ufw, so the default is loopback only.
set -euo pipefail

cd "$(dirname "$0")/../.."

CLUSTER=nest-caching
IMAGE=nest-caching:local

if ! kind get clusters | grep -qx "$CLUSTER"; then
  config=$(mktemp)
  trap 'rm -f "$config"' EXIT

  sed "s/\${KIND_LISTEN}/${KIND_LISTEN:-127.0.0.1}/" deploy/kind/cluster.yaml > "$config"
  kind create cluster --name "$CLUSTER" --config "$config" --wait 120s
fi

docker build -t "$IMAGE" .
kind load docker-image "$IMAGE" --name "$CLUSTER"

kubectl apply -k deploy/k8s/metrics-server
kubectl apply -k deploy/k8s

# The image tag stays the same, so a rebuilt image needs a restart to be picked up.
kubectl -n nest-caching rollout restart deployment/api
kubectl -n nest-caching rollout status deployment/api --timeout 180s
