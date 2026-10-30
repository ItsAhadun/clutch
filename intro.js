// One-time setup card on instagram.com. Injected by the manifest and, for tabs open at install, by sw.js.
(async () => {
  if (window.__clutchIntro) return;
  window.__clutchIntro = true;

  const intro = (await chrome.runtime.sendMessage({ type: "intro" }))?.result;
  if (!intro) return;
  const { keys } = intro;
  // One key cap per key: "Alt+Shift+S", or "⇧⌥S" on macOS.
  const caps = keys && (keys.includes("+") ? keys.split("+") : [...keys]).map(k => `<kbd>${k}</kbd>`).join("");

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "closed" });
  // Keycap design system: tokens and rules in DESIGN.md.
  root.innerHTML = `
    <style>
      .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 320px; padding: 16px;
              border-radius: 10px; background: #1a1b1e; color: #ecebe8; border: 1px solid #2e2f35;
              box-shadow: 0 12px 40px rgba(0,0,0,.5); font: 13px/1.5 system-ui, "Segoe UI", sans-serif;
              animation: rise .16s ease-out; }
      @keyframes rise { from { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
      h2 { margin: 0 0 10px; font-size: 15px; font-weight: 650; }
      ol { margin: 0 0 12px; padding: 0; list-style: none; counter-reset: step; display: grid; gap: 8px; }
      li { counter-increment: step; display: grid; grid-template-columns: 22px 1fr; }
      li::before { content: counter(step); font: 600 11px/1.9 ui-monospace, "Cascadia Mono", Consolas, monospace; color: #8d8c92; }
      b { color: #fff; font-weight: 600; }
      kbd { font: 600 11px ui-monospace, "Cascadia Mono", Consolas, monospace; padding: 1px 5px 3px; margin-right: 3px;
            border-radius: 5px; background: #2a2b30; box-shadow: inset 0 -2px 0 #0e0f11; }
      kbd:last-of-type { color: #ff4f9a; }
      p { margin: 0 0 14px; color: #8d8c92; font-size: 12px; }
      button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 7px; padding: 7px 14px 8px;
               background: #ff4f9a; color: #1a0b12; box-shadow: inset 0 -3px 0 #b8306c; transition: transform .06s, box-shadow .06s; }
      button:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #b8306c; }
      button:focus-visible { outline: 2px solid #ecebe8; outline-offset: 2px; }
    </style>
    <div class="card" role="dialog" aria-label="Clutch setup">
      <h2>Clutch is ready</h2>
      <ol>
        <li><span>Open the extension and press <b>Save login</b>.</span></li>
        <li><span>Press <b>Add another account</b>, log in to the other account, then save it too.</span></li>
        <li><span>${caps ? `Press ${caps} to switch.` : "Click an account in the extension to switch."}</span></li>
      </ol>
      <p>After the second save, the extension works out which cookies to swap. Don't use Instagram's own Log out or account switcher. Both end saved logins.</p>
      <button>Got it</button>
    </div>`;
  root.querySelector("button").onclick = () => host.remove();
  document.body.append(host);
})();
