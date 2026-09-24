export const IG_DOMAIN = "instagram.com";

export function urlFor(c) {
  const host = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
  return `${c.secure ? "https" : "http"}://${host}${c.path}`;
}

export async function snapshot() {
  const cookies = await chrome.cookies.getAll({ domain: IG_DOMAIN });
  return cookies.map(({ name, value, domain, path, secure, httpOnly, sameSite,
                        hostOnly, session, expirationDate, partitionKey }) =>
    ({ name, value, domain, path, secure, httpOnly, sameSite,
       hostOnly, session, expirationDate, partitionKey }));
}

// ds_user_id of the logged-in account, or undefined when the jar holds no live session.
export function liveUid(jar) {
  if (!jar.some(c => c.name === "sessionid" && c.value)) return;
  return jar.find(c => c.name === "ds_user_id")?.value;
}

// hostOnly / session / storeId are read-only on Cookie and can't be passed to set();
// they are expressed by omitting domain / expirationDate.
export function writeCookie(c) {
  const d = {
    url: urlFor(c),                 // required; must agree with domain/path/secure
    name: c.name, value: c.value, path: c.path,
    secure: c.secure, httpOnly: c.httpOnly,
  };
  if (c.sameSite !== "unspecified") d.sameSite = c.sameSite;
  if (!c.hostOnly) d.domain = c.domain;                        // hostOnly ⇔ omit domain
  if (!c.session) d.expirationDate = c.expirationDate;         // session ⇔ omit expiry
  if (c.partitionKey) d.partitionKey = c.partitionKey;         // Chrome 119+, must round-trip
  if (d.sameSite === "no_restriction" && !d.secure) d.sameSite = "lax"; // invalid combo
  return chrome.cookies.set(d);
}

export function removeCookie(c) {
  const d = { url: urlFor(c), name: c.name };
  if (c.partitionKey) d.partitionKey = c.partitionKey;
  return chrome.cookies.remove(d);
}
