/**
 * Instagram handle normalization, shared by every table keyed on a handle.
 *
 * `connected_accounts` and `instagram_scans` both use (user_id, handle) as their
 * primary key, so they MUST agree on what a handle looks like. Keeping one
 * definition here means "@Sean", " sean " and "sean" can never become three
 * different rows — or a connected account whose scan cache never hits.
 */

/** Normalize a handle for use as a stable key: trimmed, lowercase, no leading @. */
export function normalizeHandle(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}
