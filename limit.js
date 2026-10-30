// Usage-limit overlay. The clock itself lives in sw.js (src/limit.js), because storage.local is
// locked away from content scripts; every tab ticks the same shared clock.
(() => {
  if (window.__clutchLimit) return;
  window.__clutchLimit = true;

  let host, time;

  function show(ms) {
    if (!host) {
      host = document.createElement("div");
      const root = host.attachShadow({ mode: "closed" });
      // Keycap design system: tokens and rules in DESIGN.md.
      root.innerHTML = `
        <style>
          .cover { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
                   background: #141517; font: 13px/1.45 system-ui, "Segoe UI", sans-serif; color: #ecebe8; }
          .panel { width: 300px; padding: 16px; border-radius: 10px; background: #1a1b1e;
                   border: 1px solid #2e2f35; box-shadow: 0 12px 40px rgba(0,0,0,.5); animation: rise .16s ease-out; }
          .title { font-size: 15px; font-weight: 650; margin: 0 0 4px; }
          p { margin: 0 0 12px; font-size: 12px; color: #8d8c92; }
          .well { padding: 14px; border-radius: 10px; background: #141517; text-align: center;
                  font: 600 28px ui-monospace, "Cascadia Mono", Consolas, monospace; }
          @keyframes rise { from { transform: translateY(6px); opacity: 0; } }
          @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
        </style>
        <div class="cover" role="alertdialog" aria-labelledby="t" aria-describedby="d">
          <div class="panel">
            <div class="title" id="t">Instagram is on a break</div>
            <p id="d">You used your 3 minutes. It opens again when the timer ends.</p>
            <div class="well" role="timer"></div>
          </div>
        </div>`;
      time = root.querySelector(".well");
    }
    if (!host.isConnected) document.documentElement.append(host);
    const s = Math.ceil(ms / 1000);
    time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    document.querySelectorAll("video, audio").forEach(m => m.pause());
  }

  async function tick() {
    let until;
    try {
      until = (await chrome.runtime.sendMessage({ type: "limit", visible: document.visibilityState === "visible" }))?.result;
    } catch { // extension reloaded: the fresh copy sw.js injects takes over
      clearInterval(timer);
      return host?.remove();
    }
    const left = until - Date.now();
    left > 0 ? show(left) : host?.remove();
  }

  const timer = setInterval(tick, 1000);
  tick();
})();
