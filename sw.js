import { IG_DOMAIN, snapshot, liveUid } from "./src/cookies.js";
import { getState, setState } from "./src/store.js";
import { switchTo, toggle, syncLive, refreshBadge } from "./src/switch.js";
import { autoIdentity } from "./src/identity.js";
import { fetchUsername } from "./src/username.js";

// Every accounts/active read-modify-write runs through this queue, so the
// onChanged sync can never interleave with a switch half-way through.
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

// Labels the extension filled in itself, which a fetched username should replace.
const autoLabel = (id, label) => label === id || /^Account \d+$/.test(label);

const handlers = {
  switch: ({ id }) => switchTo(id),
  addAccount: () => switchTo(null),

  async capture({ label }) {
    const jar = await snapshot();
    const uid = liveUid(jar);
    if (!uid) throw new Error("Log in on instagram.com first.");
    const { accounts } = await getState();
    const kept = accounts[uid] && !autoLabel(uid, accounts[uid].label) && accounts[uid].label;
    label ||= kept || await fetchUsername(uid) || `Account ${Object.keys(accounts).length + (accounts[uid] ? 0 : 1)}`;
    accounts[uid] = { label, jar, dead: false };
    const identityNames = autoIdentity(accounts, uid);
    await setState({ accounts, active: uid, ...(identityNames && { identityNames }) });
    await refreshBadge();
  },

  // Retries the username for accounts whose lookup failed at save time.
  async fixNames() {
    const { accounts } = await getState();
    let changed = false;
    for (const [id, a] of Object.entries(accounts)) {
      const name = autoLabel(id, a.label) && await fetchUsername(id);
      if (name) { a.label = name; changed = true; }
    }
    if (!changed) return;
    await setState({ accounts });
    await refreshBadge();
  },

  shortcut: async () =>
    (await chrome.commands.getAll()).find(c => c.name === "toggle-account")?.shortcut ?? "",

  async rename({ id, label }) {
    const { accounts } = await getState();
    if (!accounts[id] || !label) return;
    accounts[id].label = label;
    await setState({ accounts });
    await refreshBadge();
  },

  async delete({ id }) {
    const { accounts, active } = await getState();
    delete accounts[id];
    await setState({ accounts, active: active === id ? null : active });
    await refreshBadge();
  },
};

chrome.commands.onCommand.addListener(cmd => {
  if (cmd === "toggle-account") locked(toggle).catch(console.error);
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  // Content scripts (the intro card) only ever need the shortcut; the rest is popup-only.
  if (sender.tab && msg.type !== "shortcut") return false;
  locked(() => handlers[msg.type](msg)).then(
    result => respond({ ok: true, result }),
    e => respond({ ok: false, error: e.message }),
  );
  return true;
});

let timer;
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (!cookie.domain.endsWith(IG_DOMAIN)) return;
  clearTimeout(timer);
  timer = setTimeout(() => locked(syncLive).catch(console.error), 2000);
});

// Badge text doesn't survive a browser restart.
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.runtime.onInstalled.addListener(refreshBadge);

// Manifest content scripts only reach pages loaded after install, so already-open IG tabs get the intro here.
chrome.runtime.onInstalled.addListener(async () => {
  for (const t of await chrome.tabs.query({ url: "https://www.instagram.com/*" }))
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["intro.js"] }).catch(() => {});
});
