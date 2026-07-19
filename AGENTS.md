# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Feature-dev tunnel hygiene

- **Kill a worktree's dev server as soon as we stop focusing on that feature.**
  Once a feature is accepted/merged — or we simply move our attention to a
  different feature — stop its `expo start --tunnel` process (per-slug via
  `serve-tunnel/scripts/stop-tunnel.js <slug>`, or SIGKILL the process tree) so
  it stops holding a Metro bundler, an ngrok agent, and disk/CPU. Don't leave
  idle worktree servers running.
- **Only ONE ngrok tunnel works at a time** with this token (free tier = 1
  session). Despite what the feature-dev skill says about "up to 3 concurrent
  tunnels," serving a second one steals the session and silently breaks the
  first. **Serve and test features ONE AT A TIME**: bring up a tunnel, test,
  Accept/Adjust/Delete, kill it, then serve the next.
