#!/usr/bin/env bash
# worktree-create.sh <feature name or slug>
# Create an isolated worktree for one feature, branched from main, in a SIBLING
# directory outside the repo (keeps `git status` and Metro clean). Symlinks
# node_modules and .env from the main checkout so the app builds and can reach
# Supabase without a reinstall.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
NAME="${1:?usage: worktree-create.sh <feature name>}"
slugify() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }
SLUG="$(slugify "$NAME")"
BRANCH="feat/${SLUG}"
WT_ROOT="$(cd "$REPO/.." && pwd)/social-ai-worktrees"
WT="$WT_ROOT/$SLUG"

mkdir -p "$WT_ROOT"

if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "worktree-create: branch $BRANCH already exists" >&2
  exit 1
fi
if [ -e "$WT" ]; then
  echo "worktree-create: path already exists: $WT" >&2
  exit 1
fi

# Send git's progress/"HEAD is now at" chatter to stderr so stdout stays clean
# (the caller captures stdout as the worktree path).
git -C "$REPO" worktree add -b "$BRANCH" "$WT" main >&2

# Share dependencies and secrets from the main checkout (both are gitignored, so
# the fresh worktree lacks them).
#
# node_modules is HARDLINK-COPIED (cp -al), not symlinked. A symlink pointing at
# the main checkout resolves to a path OUTSIDE this worktree, which makes Metro
# push its server root up to the common parent (…/app-projects) and hand the
# device a broken entry path like `./social-ai/node_modules/expo-router/entry`
# (Unable to resolve module … on scan). A hardlink copy lives physically inside
# the worktree (same inodes, ~1s, near-zero extra disk on one filesystem) so
# Metro keeps its server root at the worktree and the entry resolves. `-a`
# preserves inner .bin symlinks as-is.
cp -al "$REPO/node_modules" "$WT/node_modules"
if [ -e "$REPO/.env" ]; then
  ln -s "$REPO/.env" "$WT/.env"
else
  echo "worktree-create: warning: $REPO/.env not found; app may lack Supabase keys" >&2
fi

# Belt-and-suspenders: the repo's .gitignore uses `node_modules/` (dir only),
# which does not match a symlink named node_modules. Add both symlink names to
# this worktree's exclude so they can never be staged/committed.
EXCLUDE="$(git -C "$WT" rev-parse --git-path info/exclude)"
for pat in node_modules .env; do
  grep -qxF "$pat" "$EXCLUDE" 2>/dev/null || printf '%s\n' "$pat" >> "$EXCLUDE"
done

echo "$WT"   # stdout = the worktree path, for the caller to capture
echo "worktree-create: $BRANCH at $WT" >&2
