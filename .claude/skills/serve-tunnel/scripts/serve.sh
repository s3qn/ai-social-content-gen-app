#!/usr/bin/env bash
# serve.sh <worktree-path> <feature-name>
# Launch an Expo tunnel for one feature, capture its exp:// URL, and register it
# in the shared state file. Up to 3 tunnels may run at once (ngrok free tier).
#
# Prints the exp:// URL, the dashboard link, and an ASCII QR fallback.
# Exits 0 on a ready tunnel, non-zero on cap-exceeded / port-exhausted / failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE="${1:?usage: serve.sh <worktree-path> <feature-name>}"
NAME="${2:?usage: serve.sh <worktree-path> <feature-name>}"
DASH_URL="https://dev.sean.build"
POLL_SECONDS="${SERVE_TUNNEL_TIMEOUT:-120}"

slugify() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }
SLUG="$(slugify "$NAME")"
BRANCH="feat/${SLUG}"

if [ ! -d "$WORKTREE" ]; then
  echo "serve.sh: worktree not found: $WORKTREE" >&2
  exit 1
fi

# --- 1. enforce the 3-slot cap -----------------------------------------------
ACTIVE="$(node "$SCRIPT_DIR/count-active.js")"
if [ "$ACTIVE" -ge 3 ]; then
  echo "serve.sh: 3 tunnels already active (ngrok free cap). Accept/Delete one first." >&2
  exit 2
fi

# --- 2. pick a free port ------------------------------------------------------
PORT="$(node "$SCRIPT_DIR/pick-port.js")"
LOG="$(mktemp "/tmp/serve-tunnel-${SLUG}.XXXXXX.log")"
echo "serve.sh: $NAME -> port $PORT, log $LOG"

# mark as starting so a concurrent serve counts this slot immediately
node "$SCRIPT_DIR/write-state.js" --slug "$SLUG" --name "$NAME" --branch "$BRANCH" \
  --worktree "$WORKTREE" --port "$PORT" --status starting --log "$LOG" >/dev/null

# --- 3. launch expo tunnel in its own process group (no CI=1) -----------------
# setsid => new group led by this pid, so stop-tunnel can kill the ngrok child too.
setsid bash -c "cd '$WORKTREE' && exec npx expo start --tunnel --port $PORT" \
  >"$LOG" 2>&1 &
PID=$!
node "$SCRIPT_DIR/write-state.js" --slug "$SLUG" --pid "$PID" >/dev/null

# --- 4. poll the log for the exp:// URL or a failure signature ----------------
EXP_RE='exp://[^[:space:]]*\.exp\.direct'
FAIL_RE="reading 'body'|status\.ngrok\.com|ERR_NGROK|tunnel .*already|Cannot read propert"
EXP_URL=""
for ((i = 0; i < POLL_SECONDS; i++)); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "serve.sh: expo exited early; see $LOG" >&2
    break
  fi
  EXP_URL="$(grep -oE "$EXP_RE" "$LOG" | head -n1 || true)"
  # Expo SDK 54 in tunnel mode frequently never prints the exp://…exp.direct
  # line this greps for, so the poll would time out and (wrongly) mark the slot
  # "failed" even though the tunnel is up. Fall back to ngrok's local inspector
  # API, which reliably reports the public host; match this feature's own PORT.
  if [ -z "$EXP_URL" ]; then
    for insp in 4040 4041 4042 4043; do
      EXP_URL="$(curl -s -m 3 "localhost:$insp/api/tunnels" 2>/dev/null \
        | grep -oE "https://[a-z0-9]+-anonymous-${PORT}\.exp\.direct" | head -n1 \
        | sed 's,^https,exp,' || true)"
      [ -n "$EXP_URL" ] && break
    done
  fi
  [ -n "$EXP_URL" ] && break
  if grep -qiE "$FAIL_RE" "$LOG"; then
    echo "serve.sh: tunnel failure signature in log:" >&2
    tail -n 15 "$LOG" >&2
    break
  fi
  sleep 1
done

# --- 5. record result + report -----------------------------------------------
if [ -n "$EXP_URL" ]; then
  node "$SCRIPT_DIR/write-state.js" --slug "$SLUG" --status ready --exp "$EXP_URL" >/dev/null
  echo
  echo "  feature : $NAME"
  echo "  url     : $EXP_URL"
  echo "  dash    : $DASH_URL"
  echo
  npx -y qrcode-terminal "$EXP_URL" 2>/dev/null || echo "(install qrcode-terminal for an inline QR; scan on $DASH_URL)"
  exit 0
else
  node "$SCRIPT_DIR/write-state.js" --slug "$SLUG" --status failed >/dev/null
  echo "serve.sh: no exp:// URL within ${POLL_SECONDS}s. Log tail:" >&2
  tail -n 20 "$LOG" >&2
  exit 3
fi
