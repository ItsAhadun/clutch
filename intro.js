// One-time setup card on instagram.com. Injected by the manifest and, for tabs open at install, by sw.js.
(async () => {
  if (window.__instaSwitcherIntro) return;
  window.__instaSwitcherIntro = true;

  const { introSeen } = await chrome.storage.local.get({ introSeen: false });
  if (introSeen) return;
  await chrome.storage.local.set({ introSeen: true });

  const keys = (await chrome.runtime.sendMessage({ type: "shortcut" }))?.result;

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 300px; padding: 16px;
              border-radius: 12px; background: #17171b; color: #f2f2f5; border: 1px solid #33333c;
              box-shadow: 0 12px 40px rgba(0,0,0,.5); font: 13px/1.5 system-ui, "Segoe UI", sans-serif; }
      h2 { margin: 0 0 8px; font-size: 15px; }
      ol { margin: 0 0 10px; padding-left: 18px; }
      li { margin-bottom: 4px; }
      b, kbd { color: #fff; }
      kbd { font: 12px ui-monospace, monospace; border: 1px solid #33333c; border-radius: 4px; padding: 0 4px; }
      p { margin: 0 0 12px; color: #9a9aa6; font-size: 12px; }
      button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 8px;
               padding: 7px 14px; background: #e8458f; color: #fff; }
      button:focus-visible { outline: 2px solid #8f98ff; outline-offset: 2px; }
    </style>
    <div class="card" role="dialog" aria-label="Fast Insta Switcher setup">
      <h2>Fast Insta Switcher is ready</h2>
      <ol>
        <li>Open the extension and press <b>Save login</b>.</li>
        <li>Press <b>Add another account</b>, log in to the other account, then save it too.</li>
        <li>${keys ? `Press <kbd>${keys}</kbd> to switch.` : "Click an account in the extension to switch."}</li>
      </ol>
      <p>After the second save, the extension works out which cookies to swap. Don't use Instagram's own Log out or account switcher. Both end saved logins.</p>
      <button>Got it</button>
    </div>`;
  root.querySelector("button").onclick = () => host.remove();
  document.body.append(host);
})();
