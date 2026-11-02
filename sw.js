import { IG_DOMAIN, snapshot, liveUid } from "./src/cookies.js";
import { getState, setState } from "./src/store.js";
import { switchTo, toggle, syncLive, refreshBadge } from "./src/switch.js";
import { autoIdentity } from "./src/identity.js";
import { fetchUsername } from "./src/username.js";
import { step } from "./src/limit.js";

// Saved jars are live session tokens: keep storage.local out of reach of content scripts
// (it's exposed to them by default). intro.js goes through the "intro" message instead.
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(console.error);

// Runs its jobs one at a time, in order.
function queue() {
  let chain = Promise.resolve();
  return fn => {
    const run = chain.then(fn);
    chain = run.catch(() => {});
    return run;
  };
}
// Every accounts/active read-modify-write runs through this queue, so the
// onChanged sync can never interleave with a switch half-way through.
const locked = queue();
// The usage-limit clock has its own, so it never waits behind a slow switch.
const ticks = queue();

// Labels the extension filled in itself, which a fetched username should replace.
const autoLabel = (id, label) => label === id || /^Account \d+$/.test(label);

const shortcutKeys = async () =>
  (await chrome.commands.getAll()).find(c => c.name === "toggle-account")?.shortcut ?? "";

// The only messages content scripts may send (intro card, feature menu, transcript, usage limit); the
// rest is popup-only. The transcription itself goes over a port straight to offscreen.js.
const TAB_MESSAGES = ["intro", "shortcut", "transcriber", "limit"];

const handlers = {
  switch: ({ id }) => switchTo(id),
  addAccount: () => switchTo(null),

  async capture({ label }) {
    const jar = await snapshot();
    const uid = liveUid(jar);
    if (!uid) throw new Error("Log in on instagram.com first.");
    const { accounts } = await getState();
    const kept = accounts[uid] && !autoLabel(uid, accounts[uid].label) && accounts[uid].label;
    label ||= kept || await fetchUsername() || `Account ${Object.keys(accounts).length + (accounts[uid] ? 0 : 1)}`;
    accounts[uid] = { label, jar, dead: false };
    const identityNames = autoIdentity(accounts, uid);
    await setState({ accounts, active: uid, ...(identityNames && { identityNames }) });
    await refreshBadge();
  },

  // Retries the username lookup when the account it failed for is the one logged in now.
  async fixNames() {
    const { accounts } = await getState();
    const uid = liveUid(await snapshot());
    if (!accounts[uid] || !autoLabel(uid, accounts[uid].label)) return;
    const name = await fetchUsername();
    if (!name) return;
    accounts[uid].label = name;
    await setState({ accounts });
    await refreshBadge();
  },

  // One-time setup card: null once shown, else the shortcut to print on it.
  async intro() {
    const { introSeen } = await chrome.storage.local.get({ introSeen: false });
    if (introSeen) return null;
    await chrome.storage.local.set({ introSeen: true });
    return { keys: await shortcutKeys() };
  },

  shortcut: shortcutKeys,

  // Usage-limit clock, ticked about once a second by limit.js in each Instagram tab.
  // Returns when the current block ends (0 when not blocked).
  async limit({ visible }) {
    const { limit = { used: 0, last: 0, until: 0 } } = await chrome.storage.local.get("limit");
    const s = step(limit, Date.now(), !!visible);
    if (s !== limit) await chrome.storage.local.set({ limit: s });
    return s.until;
  },

  // Opens offscreen.js, which runs speech-to-text for Reels without captions. Runs inside locked(),
  // so two CC clicks can't both try to create it.
  async transcriber() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"],
      justification: "Transcribes Reels on this computer with a speech-to-text model." });
  },

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

// Shortcut only fires on an Instagram tab. tab.url is only visible for hosts we have permission for.
const onInstagram = tab => /^https?:\/\/([^/]+\.)?instagram\.com\//.test(tab?.url ?? "");

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === "toggle-account" && onInstagram(tab)) locked(toggle).catch(console.error);
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.tab && !TAB_MESSAGES.includes(msg.type)) return false;
  (async () => {
    try {
      const q = msg.type === "limit" ? ticks : locked;
      respond({ ok: true, result: await q(() => handlers[msg.type](msg)) });
    } catch (e) {
      respond({ ok: false, error: e.message });
    }
  })();
  return true;
});

// setTimeout, not chrome.alarms: alarms floor at 30s, and each cookie event keeps the worker
// alive far longer than this 2s debounce.
let timer;
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (!cookie.domain.endsWith(IG_DOMAIN)) return;
  clearTimeout(timer);
  timer = setTimeout(() => locked(syncLive).catch(console.error), 2000);
});

// Badge text doesn't survive a browser restart.
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.runtime.onInstalled.addListener(refreshBadge);

// Manifest content scripts only reach pages loaded after install, so already-open IG tabs get them here.
chrome.runtime.onInstalled.addListener(async () => {
  for (const t of await chrome.tabs.query({ url: "https://www.instagram.com/*" })) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["limit.js", "intro.js", "video.js"] }).catch(() => {});
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["keep-playing.js", "story.js"], world: "MAIN" }).catch(() => {});
  }
});
