// Instagram's web app id; its private API rejects requests without it.
const APP_ID = "936619743392459";

// Self-contained so executeScript can run it inside an Instagram tab.
async function lookup(uid, appId) {
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/users/${uid}/info/`,
      { headers: { "X-IG-App-ID": appId }, credentials: "include" });
    return r.ok ? (await r.json()).user?.username : undefined;
  } catch {}
}

// Username for a user id, or undefined. Tries from an open Instagram tab first: that request is
// same-origin, so the login cookies always go along. The worker's own fetch can go out without them.
export async function fetchUsername(uid) {
  const [tab] = await chrome.tabs.query({ url: "https://www.instagram.com/*" });
  if (tab) {
    try {
      const [{ result }] = await chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: lookup, args: [uid, APP_ID] });
      if (result) return result;
    } catch {}
  }
  return lookup(uid, APP_ID);
}
