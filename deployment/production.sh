#!/bin/bash
# ──────────────────────────────────────────────
# Manual Production Deployment Script
# (with rollback support)
#
# Usage: bash deployment/production.sh
# ──────────────────────────────────────────────

SSH_HOST="103.49.70.246"
SSH_USER="root"

ssh ${SSH_USER}@${SSH_HOST} << 'EOF'
set -e

REPO_DIR="/root/cricket_server"
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_NAME="cricket_server"
CONTAINER_NAME="cricket_server"

echo "========================================="
echo "  MANUAL PRODUCTION DEPLOYMENT"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================="

# ─── Phase 1: Backup current state ───
echo ""
echo ">>> Phase 1: Creating rollback backup..."
ROLLBACK_AVAILABLE=false

if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker tag "$IMAGE_NAME" "$IMAGE_NAME:rollback"
  ROLLBACK_AVAILABLE=true
  echo "    ✓ Tagged current image as ${IMAGE_NAME}:rollback"
else
  echo "    ⚠ No existing image found, fresh deployment"
fi

# ─── Phase 2: Pull latest code & build ───
echo ""
echo ">>> Phase 2: Pulling latest code & building..."

if [ -d "$REPO_DIR" ]; then
  cd "$REPO_DIR"
  git fetch --all
  git reset --hard origin/main
  git clean -fd
  echo "    ✓ Repository updated"
else
  git clone git@github.com:puspendudas/Cricket_Test_Server.git "$REPO_DIR"
  cd "$REPO_DIR"
  echo "    ✓ Repository cloned"
fi

docker compose -f "$COMPOSE_FILE" build --no-cache
echo "    ✓ Production image built"

# ─── Phase 3: Deploy & health check ───
echo ""
echo ">>> Phase 3: Deploying..."

docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d

echo "    Waiting 15 seconds for container to stabilize..."
sleep 15

if docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
  echo "    ✓ Container is running"

  # ─── SUCCESS: Clean up ───
  echo ""
  echo ">>> Cleaning up..."

  if [ "$ROLLBACK_AVAILABLE" = true ]; then
    docker rmi "$IMAGE_NAME:rollback" 2>/dev/null || true
  fi

  docker system prune -af --volumes 2>/dev/null || true
  docker builder prune -af 2>/dev/null || true
  echo "    ✓ Build cache cleaned"

  echo ""
  echo "  ✅ DEPLOYMENT SUCCESSFUL"
else
  echo "    ✗ Container failed to start!"

  # ─── FAILURE: Rollback ───
  echo ""
  echo ">>> Rolling back..."

  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

  if [ "$ROLLBACK_AVAILABLE" = true ]; then
    docker tag "$IMAGE_NAME:rollback" "$IMAGE_NAME:latest"
    docker tag "$IMAGE_NAME:rollback" "$IMAGE_NAME"
    docker compose -f "$COMPOSE_FILE" up -d
    sleep 10

    if docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
      echo "    ✓ Rollback successful"
    else
      echo "    ✗ Rollback failed! Manual intervention required."
    fi

    docker rmi "$IMAGE_NAME:rollback" 2>/dev/null || true
  else
    echo "    ⚠ No rollback available"
  fi

  echo ""
  echo "  ❌ DEPLOYMENT FAILED"
  exit 1
fi
EOF