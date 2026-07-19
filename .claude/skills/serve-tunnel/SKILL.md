---
name: serve-tunnel
description: >-
  Serve one build of the social-ai Expo app over its own ngrok tunnel and show a
  scannable QR. Use when you need to run a worktree (or the main checkout) on a
  real phone via Expo Go: starts `expo start --tunnel` on a free port, captures
  the exp:// URL, registers it in the shared tunnel state file (so the
  dev.sean.build dashboard renders a QR), and prints an ASCII QR fallback. Up to
  3 tunnels run at once. Also handles stopping a tunnel and freeing its slot.
---

# serve-tunnel

Runs one Expo build on a device-scannable tunnel. Called by the `feature-dev`
loop (once per feature) or directly to expose the main checkout.

## Contract (shared with the dev.sean.build dashboard)

- **State file:** `~/.claude/dev-feature-tunnels.json` (override `DEV_TUNNELS_STATE`).
  Array of `{ name, slug, branch, worktree, metroPort, expUrl, status, pid, logPath, startedAt }`.
- **Checklist file:** `~/.claude/dev-feature-test-checklists.json` (override
  `DEV_TEST_CHECKLISTS`), a **separate** file, keyed by `slug`:
  `{ "<slug>": { items: [ { text, checked } ] } }`. The dashboard renders these as
  tap-to-toggle boxes under each QR and writes `checked` back on tap. Kept apart
  from the state file on purpose, so a status update never clobbers the checklist.
- **status:** `starting` → `ready` | `failed`.
- **Concurrency = 3** (ngrok free tier). Never launch a 4th while 3 are active.
- **Ports:** first free port in 15000–16000 (`pick-port.js`).
- **Teardown kills by pid only**, never a global `pkill ngrok` (that would kill
  the other 2 tunnels). `expo start` runs in its own process group via `setsid`,
  so `stop-tunnel.js` reaps the ngrok child with it.

`$SKILL_DIR` below is this skill's directory.

## Serve a build

```bash
bash "$SKILL_DIR/scripts/serve.sh" <worktree-path> "<feature name>"
```

- Refuses (exit 2) if 3 tunnels are already active, Accept or Delete one first.
- On success prints the `exp://…exp.direct` URL, the `https://dev.sean.build`
  link, and an inline ASCII QR. The dashboard shows the same QR on your phone.
- On failure (exit 3) prints the log tail; the most common cause is a stale
  ngrok agent: check `node "$SKILL_DIR/scripts/list.js"` and stop orphans.
- First `--tunnel` run is slow (fetches the ngrok binary); the poll waits 120s
  (`SERVE_TUNNEL_TIMEOUT` to change). `@expo/ngrok` must be installed (it is a
  devDependency of social-ai) so the launch is non-interactive.

## Write a feature's test checklist

Persist the "what to test" list for a slug so the dashboard shows it under the QR.
Items are a JSON array on stdin (plain strings, or `{text[,checked]}` objects);
re-running for the same slug replaces its items (resetting `checked`):

```bash
echo '["Scan QR opens the feature","Happy-path flow works","Invalid input shows an error"]' \
  | node "$SKILL_DIR/scripts/write-checklist.js" --slug <slug>
```

The **content** must come from whoever knows what the feature does, in the
`feature-dev` loop that's the build subagent, which calls this right after `serve.sh`.

## Stop a tunnel / free a slot

```bash
node "$SKILL_DIR/scripts/stop-tunnel.js" <slug>
```

## Inspect state

```bash
node "$SKILL_DIR/scripts/list.js"        # human-readable table
cat "${DEV_TUNNELS_STATE:-$HOME/.claude/dev-feature-tunnels.json}"
```

## Notes

- Do **not** pass `CI=1`: it suppresses the interactive dev server the tunnel
  needs.
- If a serve fails with `TypeError … reading 'body'` or a `status.ngrok.com`
  line, an ngrok agent is already maxed out; stop a tunnel to free a session.
