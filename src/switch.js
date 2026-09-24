import { snapshot, liveUid, writeCookie, removeCookie } from "./cookies.js";
import { DEFAULT_IDENTITY } from "./identity.js";
import { getState, setState } from "./store.js";

const HOME = "https://www.instagram.com/";
const COLORS = ["#d62976", "#4f5bd5", "#fa7e1e", "#1b9e77", "#7b3fbf", "#0a7ea4"];

// id === null signs out locally: identity cookies are dropped but the session stays
// valid server-side (unlike IG's own Log out), so a second account can be logged in.
export async function switchTo(id) {
  const { accounts, active, identityNames, settings } = await getState();
  if (id !== null && !accounts[id]) return;
  const identity = new Set(identityNames ?? DEFAULT_IDENTITY);

  // Freshness: IG rotates tokens mid-session, so save the outgoing jar now.
  // Only when the live jar really is that account — never overwrite with a logged-out one.
  const live = await snapshot();
  if (accounts[active] && liveUid(live) === active) accounts[active].jar = live;

  if (settings.clearStorage) {
    // Never cookies: true here — it works at registrable-domain granularity and would wipe device cookies.
    await chrome.browsingData.remove(
      { origins: ["https://www.instagram.com"] },
      { localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true },
    );
  }
  for (const c of live) if (identity.has(c.name)) await removeCookie(c);
  if (id !== null) for (const c of accounts[id].jar) if (identity.has(c.name)) await writeCookie(c);

  await setState({ accounts, active: id });
  await refreshBadge();

  // Every IG tab, not just the active one: a stale background tab would act as the new account under the old UI.
  const tabs = await chrome.tabs.query({ url: "*://*.instagram.com/*" });
  for (const t of tabs) settings.goHome ? chrome.tabs.update(t.id, { url: HOME }) : chrome.tabs.reload(t.id);
}

export async function toggle() {
  const { accounts, active } = await getState();
  const ids = Object.keys(accounts);
  const i = ids.indexOf(active);
  const next = [...ids.slice(i + 1), ...ids.slice(0, i + 1)]
    .find(id => id !== active && !accounts[id].dead);
  if (next) return switchTo(next);
}

// Debounced from cookies.onChanged. Keeps the logged-in account's jar fresh, follows
// logins done through IG's own UI, and flags the active slot when its session dies.
export async function syncLive() {
  const { accounts, active } = await getState();
  const live = await snapshot();
  const uid = liveUid(live);
  if (uid && accounts[uid]) {
    accounts[uid] = { ...accounts[uid], jar: live, dead: false };
    await setState({ accounts, active: uid });
  } else if (!uid && accounts[active] && !accounts[active].dead) {
    accounts[active].dead = true;
    await setState({ accounts });
  } else return;
  await refreshBadge();
}

export const initials = label => {
  const words = label.trim().split(/\s+/);
  return (words.length > 1 ? words.map(w => w[0]).join("") : label).slice(0, 2).toUpperCase();
};

// Same color on the badge and the popup avatar, so they read as one thing.
export const accountColor = id => COLORS[[...id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % COLORS.length];

export async function refreshBadge() {
  const { accounts, active } = await getState();
  const a = accounts[active];
  await chrome.action.setBadgeText({ text: a ? (a.dead ? "!" : initials(a.label)) : "" });
  if (!a) return;
  await chrome.action.setBadgeBackgroundColor({ color: a.dead ? "#cc0000" : accountColor(active) });
}
