// Instagram's web app id; its private API rejects requests without it.
const APP_ID = "936619743392459";

// Self-contained so executeScript can run it inside an Instagram tab.
// users/{id}/info answers browser requests with 429, so this reads the logged-in account's
// own settings form instead. The response also holds email and phone; only username is kept.
async function lookup(appId) {
  try {
    const r = await fetch("https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      { headers: { "X-IG-App-ID": appId }, credentials: "include" });
    return r.ok ? (await r.json()).form_data?.username : undefined;
  } catch {}
}

// Username of the account logged in right now, or undefined. Tries from an open Instagram tab
// first: that request is same-origin, so the login cookies always go along.
export async function fetchUsername() {
  const [tab] = await chrome.tabs.query({ url: "https://www.instagram.com/*" });
  if (tab) {
    try {
      const [{ result }] = await chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: lookup, args: [APP_ID] });
      if (result) return result;
    } catch {}
  }
  return lookup(APP_ID);
}
