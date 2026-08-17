#!/usr/bin/env bash
# Keep-alive AZZAVISION bot 24/7: restore data, start bot, backup berkala,
# dan self-trigger run baru sebelum limit 6h GitHub Actions.
set -euo pipefail

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)/bot"
RUN_MINUTES="${RUN_MINUTES:-350}"
RESTART_BUFFER_MIN="${RESTART_BUFFER_MIN:-3}"
GH_PAT="${GH_PAT:-}"
GH_REPO="${GH_REPO:-}"
GH_REF="${GH_REF:-main}"
BACKUP_EVERY_SEC="${BACKUP_EVERY_SEC:-300}"

# .env dari secrets ditulis oleh workflow sebelum script ini dipanggil.
# Pastikan dimuat.
if [ -f "$BOT_DIR/.env" ]; then
  set -a; . "$BOT_DIR/.env"; set +a
fi

log() { echo "[azzavision] $*"; }

trigger_next() {
  local wf="$1"
  [ -n "$GH_PAT" ] && [ -n "$GH_REPO" ] || { echo "missing GH_PAT/GH_REPO"; return 1; }
  curl -s -X POST \
    -H "Authorization: Bearer $GH_PAT" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/$GH_REPO/actions/workflows/$wf/dispatches" \
    -d "{\"ref\":\"$GH_REF\"}" >/dev/null 2>&1 || true
  echo "dispatched next run of $wf"
}

main() {
  local wf="${KEEPALIVE_WORKFLOW:-azzavision.yml}"
  local persist="$(dirname "$0")/persist_azza.sh"

  echo "Restoring data..."
  "$persist" restore 2>&1 | tail -3 || true

  echo "Installing deps..."
  ( cd "$BOT_DIR" && npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -5 ) || true

  echo "Starting AZZAVISION bot..."
  ( cd "$BOT_DIR" && node --disable-warning=ExperimentalWarning launcher.js > /tmp/azzavision.log 2>&1 ) &
  BOT_PID=$!

  sleep 10
  if ! kill -0 "$BOT_PID" 2>/dev/null; then
    echo "Bot exited early. Log:"
    tail -n 30 /tmp/azzavision.log 2>/dev/null || true
    exit 1
  fi
  echo "Bot up (pid $BOT_PID). Log tail:"
  tail -n 15 /tmp/azzavision.log 2>/dev/null || true

  local start_sec restart_at_sec now_sec elapsed last_backup
  start_sec=$(date +%s)
  restart_at_sec=$((start_sec + (RUN_MINUTES - RESTART_BUFFER_MIN) * 60))
  last_backup=$start_sec

  while true; do
    now_sec=$(date +%s)
    elapsed=$((now_sec - start_sec))

    if [ "$now_sec" -ge "$restart_at_sec" ]; then
      echo "Keep-alive: triggering next run at ${elapsed}s"
      "$persist" backup 2>&1 | tail -3 || true
      trigger_next "$wf"
      kill "$BOT_PID" 2>/dev/null || true
      wait "$BOT_PID" 2>/dev/null || true
      exit 0
    fi

    if [ $((now_sec - last_backup)) -ge "$BACKUP_EVERY_SEC" ]; then
      last_backup=$now_sec
      "$persist" backup 2>&1 | tail -2 || true
    fi

    if ! kill -0 "$BOT_PID" 2>/dev/null; then
      echo "Bot died; restarting..."
      ( cd "$BOT_DIR" && node --disable-warning=ExperimentalWarning launcher.js >> /tmp/azzavision.log 2>&1 ) &
      BOT_PID=$!
    fi

    sleep 20
  done
}

main "$@"