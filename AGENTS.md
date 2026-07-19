# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Feature-dev tunnel hygiene

- **Kill a worktree's dev server as soon as we stop focusing on that feature.**
  Once a feature is accepted/merged (or we simply move our attention to a
  different feature), stop its `expo start --tunnel` process (per-slug via
  `serve-tunnel/scripts/stop-tunnel.js <slug>`, or SIGKILL the process tree) so
  it stops holding a Metro bundler, an ngrok agent, and disk/CPU. Don't leave
  idle worktree servers running.
- **Only ONE ngrok tunnel works at a time** with this token (free tier = 1
  session). Despite what the feature-dev skill says about "up to 3 concurrent
  tunnels," serving a second one steals the session and silently breaks the
  first. **Serve and test features ONE AT A TIME**: bring up a tunnel, test,
  Accept/Adjust/Delete, kill it, then serve the next.

# Writing style

Applies to everything a human reads: UI copy, code comments, JSDoc, docs and
commit messages. The `slop-check` skill holds the full rules and a scanner.

- **Never use an em dash.** Use the punctuation the sentence wants: a period for
  two independent clauses, a comma for a dependent one, a colon before a
  definition or list, parentheses around an aside. Never a bare hyphen instead.
<!-- slop-check: disable (the rule below has to quote the phrases it bans) -->
- **No hype filler in user-facing copy.** Cut the openers ("Nice!", "Perfect."),
  the empty enthusiasm ("Let's make it happen", "You're in good company") and the
  teaser asides ("One thing worth knowing…"). State what happens. The mascot is
  allowed a voice, so trim the filler, not the personality.
<!-- slop-check: enable -->
- **Deliberate exceptions, do not "fix" these:** en dashes in numeric ranges
  (`30–90s`, `0–10`, `Choose 2–5 topics`) are correct typography, and trailing
  ellipses on progress labels (`Logging in…`, `Starting…`) are standard UI.
- **Before finishing a feature**, run the scanner and get a clean exit:
  ```bash
  node ~/.claude/skills/slop-check/scripts/scan.js
  ```
  <!-- slop-check: disable -->
  Phrase hits need judgement (a comment about an animation that "loops
  seamlessly" is fine). Em dash hits do not: fix every one.
  <!-- slop-check: enable -->
