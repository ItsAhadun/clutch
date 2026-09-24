// Instagram's web app id; its private API rejects requests without it.
const APP_ID = "936619743392459";

// Username for a user id, via whichever account is logged in right now. undefined on any failure.
export async function fetchUsername(uid) {
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/users/${uid}/info/`,
      { headers: { "X-IG-App-ID": APP_ID }, credentials: "include" });
    return r.ok ? (await r.json()).user?.username : undefined;
  } catch {}
}
