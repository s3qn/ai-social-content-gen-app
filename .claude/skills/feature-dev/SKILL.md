---
name: feature-dev
description: >-
  Build and on-device test one or more features of the social-ai Expo app,
  isolated per feature. Use whenever the user asks to add/build/prototype app
  feature(s) and try them on a phone — including a single prompt that names
  SEVERAL features. Decomposes the request, gives each feature its own git
  worktree and a Plan+build subagent, serves each over its own tunnel with a QR
  on dev.sean.build (up to 3 at once), then gates each on Accept (merge to local
  main) / Adjust (iterate) / Delete (discard). No slash command — this triggers
  from natural feature requests.
---

# feature-dev

Parallel, isolated feature development with on-device QR testing. Each feature
lives in its own worktree and is owned by its own subagent; **you (the main
session) mediate every user gate** — subagents cannot talk to the user directly.

Scripts live in `scripts/` here; the serve/QR half is the `serve-tunnel` skill.
`REPO` = the social-ai checkout root.

## Flow

### 1. Decompose
Split the request into features `[f1..fN]`. Slugify each name (lowercase,
non-alphanumerics → `-`). If it's clearly one feature, N = 1 — same flow.

### 2. Plan (one subagent per feature, in parallel)
Spawn one **Plan** subagent per feature (single message, multiple Agent calls).
Each returns a short plan for its feature only. Then **GATE 1**: present all
plans to the user with `AskUserQuestion` (multiSelect) — "which to build?".

### 3. Build + serve — at most 3 concurrently
For each approved feature, spawn a **build subagent** (general-purpose) whose
brief is: own this feature end-to-end. It must:

```bash
WT=$(bash "$SKILL_DIR/scripts/worktree-create.sh" "<feature name>")   # captures worktree path
# ...edit files under $WT to build the feature, IN-PLACE and UNCOMMITTED...
bash "$REPO/.claude/skills/serve-tunnel/scripts/serve.sh" "$WT" "<feature name>"

# Then write a test checklist for THIS feature so it shows under the QR on the
# dashboard. Base the items on what you actually built this session — the main
# happy path, each new UI element/field, edge cases and error states, anything
# risky. Short "verify X" phrases; use the feature's own slug.
echo '["verify …","verify …"]' \
  | node "$REPO/.claude/skills/serve-tunnel/scripts/write-checklist.js" --slug "<slug>"
```

`serve.sh` refuses (exit 2) if 3 tunnels are already active. So admit **≤3
features into the serve step at a time**; a 4th waits until a slot frees at an
Accept/Delete below. Keep each subagent alive (you'll continue it on Adjust).
On **Adjust**, re-run `write-checklist.js` if the change adds anything new to test
(it replaces the slug's items and resets the boxes).

### 4. Test gate — per feature
When a feature is `ready` (its QR is on `https://dev.sean.build`), ask the user
with `AskUserQuestion`: **Accept / Adjust / Delete**.

- **Accept** — the feature's subagent (or you) runs:
  ```bash
  bash "$SKILL_DIR/scripts/worktree-accept.sh" "<feature name>" "feat: <subject>"
  ```
  Commits in the worktree, fast-forwards **local main** (rebases first if main
  advanced), stops the tunnel, removes the worktree. **Nothing is pushed.** This
  is the only authorized commit point. The freed slot lets a queued feature serve.

- **Adjust** — relay the user's change request to that feature's build subagent
  (continue it via `SendMessage`, don't spawn a new one — it holds the worktree
  context). It edits in place, re-runs `serve.sh` for the same feature (re-QRs),
  then you return to this gate.

- **Delete** — run:
  ```bash
  bash "$SKILL_DIR/scripts/worktree-delete.sh" "<feature name>"
  ```
  Discards the worktree, branch, tunnel, and state entry.

## Rules

- Edits land **in-place, uncommitted**; `worktree-accept.sh` is the sole commit.
- Never `pkill` tunnels globally — teardown is per-slug (`stop-tunnel.js`), so the
  other running features survive.
- Worktrees live at `../social-ai-worktrees/<slug>` (outside the repo).
- Prereq: `@expo/ngrok` installed (a devDependency) so tunnels start
  non-interactively; the dev.sean.build dashboard running for QRs.

## Verification checklist (per feature)
- [ ] Worktree created; `node_modules` and `.env` symlinks resolve.
- [ ] `serve.sh` reported a `ready` exp:// URL; QR visible on dev.sean.build.
- [ ] Accept → feature commit is on local main, worktree gone, slot freed.
- [ ] Delete → worktree, branch, and state entry all gone.
