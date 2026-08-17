#!/usr/bin/env bash
# Persist AZZAVISION bot data (data/ folder) ke branch "data" di repo yang sama,
# dan restore saat startup. Bertahan dari ephemeral GitHub Actions runner.
# Usage:
#   persist_azza.sh restore   # pull data terbaru ke bot/data (sebelum bot start)
#   persist_azza.sh backup    # commit bot/data -> origin/data
set -euo pipefail

BOT_DIR="${BOT_DIR:-$(pwd)/bot}"
DATA_DIR="${DATA_DIR:-$BOT_DIR/data}"
DATA_BRANCH="${DATA_BRANCH:-data}"
GH_PAT="${GH_PAT:-}"
GH_REPO="${GH_REPO:-}"
GH_REF="${GH_REF:-main}"
WORK="${WORK:-/tmp/azza-data}"

copy_in() {  # $1=src $2=dst
  mkdir -p "$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$1/" "$2/"
  else
    tar -C "$1" -cf - . | tar -C "$2" -xf -
  fi
}

restore() {
  [ -n "$GH_PAT" ] && [ -n "$GH_REPO" ] || { echo "restore: missing GH_PAT/GH_REPO"; return 1; }
  rm -rf "$WORK"; mkdir -p "$WORK"
  git clone -q -b "$DATA_BRANCH" "https://x-access-token:${GH_PAT}@github.com/${GH_REPO}.git" "$WORK" 2>/dev/null \
    || { echo "restore: no data branch yet; starting fresh"; return 0; }
  mkdir -p "$DATA_DIR"
  copy_in "$WORK" "$DATA_DIR"
  echo "restore: data loaded from $DATA_BRANCH"
}

backup() {
  [ -n "$GH_PAT" ] && [ -n "$GH_REPO" ] || { echo "backup: missing GH_PAT/GH_REPO"; return 1; }
  cd /tmp
  rm -rf "$WORK"; mkdir -p "$WORK"
  if git clone -q -b "$DATA_BRANCH" "https://x-access-token:${GH_PAT}@github.com/${GH_REPO}.git" "$WORK" 2>/dev/null; then
    copy_in "$DATA_DIR" "$WORK"
    cd "$WORK"
    git add -A
    if ! git diff --cached --quiet; then
      git -c user.name="azzavision-backup" -c user.email="azzavision-backup@users.noreply.github.com" \
        commit -q -m "azzavision data backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      git push -q origin "$DATA_BRANCH" || echo "backup: push failed"
      echo "backup: pushed changes"
    else
      echo "backup: no changes"
    fi
  else
    git init -q "$WORK"; cd "$WORK"
    git checkout -q -b "$DATA_BRANCH" || true
    copy_in "$DATA_DIR" "$WORK"
    git add -A
    git -c user.name="azzavision-backup" -c user.email="azzavision-backup@users.noreply.github.com" \
      commit -q -m "azzavision data backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    git remote add origin "https://x-access-token:${GH_PAT}@github.com/${GH_REPO}.git"
    git push -q -u origin "$DATA_BRANCH" || echo "backup: initial push failed"
    echo "backup: created $DATA_BRANCH"
  fi
}

case "${1:-}" in
  restore) restore ;;
  backup)  backup ;;
  *) echo "usage: $0 restore|backup"; exit 2 ;;
esac