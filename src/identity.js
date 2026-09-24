// Fallback until the diff tool has derived the real set from two live jars.
export const DEFAULT_IDENTITY = new Set([
  "sessionid", "ds_user_id", "csrftoken", "rur", "shbid", "shbts",
]);

// Names whose values differ between two jars ARE the identity set.
export function diffJars(a, b) {
  const key = c => `${c.domain}|${c.path}|${c.name}`;
  const ma = new Map(a.map(c => [key(c), c.value]));
  const mb = new Map(b.map(c => [key(c), c.value]));
  return [...new Set([...ma.keys(), ...mb.keys()]
    .filter(k => ma.get(k) !== mb.get(k))
    .map(k => k.split("|").pop()))];
}

// Runs after each save: diff the saved jar against another live account.
// Kept only when the result holds the two cookies a login can't work without.
export function autoIdentity(accounts, uid) {
  const other = Object.entries(accounts).find(([id, a]) => id !== uid && !a.dead);
  if (!other) return null;
  const names = diffJars(accounts[uid].jar, other[1].jar);
  return names.includes("sessionid") && names.includes("ds_user_id") ? names : null;
}
