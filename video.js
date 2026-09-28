// Video controls, Reels auto-scroll and the ? feature menu on instagram.com.
// Injected by the manifest and, for tabs open at install, by sw.js.
(() => {
  if (window.__instaSwitcherVideo) return;
  window.__instaSwitcherVideo = true;

  // Features switched off in the popup; everything is on by default. storage.sync, not local:
  // sw.js locks local to trusted contexts because it holds session tokens. These are harmless prefs.
  let off = [];
  const on = f => !off.includes(f);

  const FEATURES = [
    ["seek", "Seek bar", "Hover a video and drag the bar to jump to any moment."],
    ["volume", "Volume", "Set the volume from the slider on the player."],
    ["speed", "Playback speed", "Pick anything from 0.25× to 16×."],
    ["fullscreen", "Fullscreen", "Watch any video fullscreen, Reels included."],
    ["autoscroll", "Auto-scroll Reels", "Moves to the next Reel when one ends."],
    ["menu", "Feature menu", "Press ? on Instagram to open this list."],
    ["corner", "Corner button", "The ? button in the corner that opens this list."],
  ];
  const BAR = ["seek", "volume", "speed", "fullscreen"];
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8, 16]; // Chromium plays 0.0625–16
  const time = s => (s = isFinite(s) ? Math.floor(s) : 0, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

  // One bar for the whole page, laid over whichever video the pointer is on. It lives outside
  // Instagram's React tree, so its clicks never reach Instagram's pause-on-click handlers.
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .bar, .menu, .corner { font: 12px/1.4 system-ui, "Segoe UI", sans-serif; color: #f2f2f5; }
      button, select { font: inherit; color: inherit; cursor: pointer; }
      :focus-visible { outline: 2px solid #8f98ff; outline-offset: 2px; }
      input[type=range] { accent-color: #e8458f; cursor: pointer; margin: 0; }

      /* Clicks pass through everything but the controls, and the right padding keeps
         Instagram's own bottom-right mute button uncovered. */
      .bar { position: fixed; z-index: 2147483647; display: grid; gap: 4px; padding: 24px 48px 8px 10px;
             transform: translateY(-100%); background: linear-gradient(transparent, rgba(0,0,0,.7));
             pointer-events: none; }
      .bar input, .bar select, .bar button { pointer-events: auto; }
      .row { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
      .seek-range { width: 100%; }
      .time { margin-right: auto; font-variant-numeric: tabular-nums; }
      .volume { width: 72px; }
      select { background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.35); border-radius: 4px; }
      option { background: #17171b; }
      .fs { display: grid; padding: 2px; background: none; border: 0; }
      .fs svg { width: 18px; height: 18px; }
      :host([data-off~="seek"]) .seek, :host([data-off~="volume"]) .volume,
      :host([data-off~="speed"]) .speed, :host([data-off~="fullscreen"]) .fs { display: none; }

      .corner { position: fixed; z-index: 2147483646; right: 16px; bottom: 88px; width: 30px; height: 30px;
                border-radius: 50%; border: 1px solid #33333c; background: #17171b; font-weight: 700; opacity: .7; }
      .corner:hover { opacity: 1; }
      .menu { position: fixed; z-index: 2147483647; top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 16px;
              border-radius: 12px; background: #17171b; border: 1px solid #33333c; box-shadow: 0 12px 40px rgba(0,0,0,.5);
              font-size: 13px; line-height: 1.5; }
      h2 { margin: 0 0 10px; font-size: 15px; }
      ul { margin: 0 0 12px; padding: 0; list-style: none; display: grid; gap: 8px; }
      li { display: grid; grid-template-columns: 1fr auto; column-gap: 8px; }
      li small { grid-column: 1 / -1; color: #9a9aa6; }
      .state { font-size: 11px; font-weight: 600; color: #9a9aa6; }
      .state.on { color: #e8458f; }
      kbd { font: 12px ui-monospace, monospace; border: 1px solid #33333c; border-radius: 4px; padding: 0 4px; }
      p { margin: 0 0 12px; color: #9a9aa6; font-size: 12px; }
      .close { font-weight: 600; border: 0; border-radius: 8px; padding: 7px 14px; background: #e8458f; color: #fff; }
    </style>
    <div class="bar" hidden>
      <input class="seek seek-range" type="range" min="0" max="1000" value="0" aria-label="Seek">
      <div class="row">
        <span class="seek time"></span>
        <input class="volume" type="range" min="0" max="1" step="0.05" aria-label="Volume">
        <select class="speed" aria-label="Playback speed">
          ${SPEEDS.map(s => `<option value="${s}">${s}×</option>`).join("")}
        </select>
        <button class="fs" aria-label="Fullscreen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div>
    </div>
    <button class="corner" aria-label="Fast Insta Switcher features" title="Features (?)">?</button>
    <div class="menu" role="dialog" aria-label="Fast Insta Switcher features" hidden>
      <h2>Fast Insta Switcher</h2>
      <ul></ul>
      <p>Turn features on or off in the extension popup, under Settings.</p>
      <button class="close">Close</button>
    </div>`;
  const $ = s => root.querySelector(s);
  const bar = $(".bar"), seek = $(".seek-range"), timeEl = $(".time"), vol = $(".volume"), speed = $(".speed");
  const menu = $(".menu"), corner = $(".corner");
  document.documentElement.append(host);

  // Keep our clicks and keys away from Instagram's document-level listeners.
  for (const t of ["click", "dblclick", "pointerdown", "pointerup", "mousedown", "mouseup", "keydown"])
    host.addEventListener(t, e => e.stopPropagation());

  // ---- Player bar ----
  let cur = null, dragging = false, looping = false;
  const lastTime = new WeakMap(); // per video, for spotting a Reel looping back to the start

  function hide() { cur = null; bar.hidden = true; }
  function show(v) {
    cur = v;
    bar.hidden = false;
    if (!looping) { looping = true; requestAnimationFrame(tick); }
  }
  function tick() {
    if (cur && !cur.isConnected) hide();
    if (!cur) return (looping = false);
    const r = cur.getBoundingClientRect(), d = cur.duration;
    Object.assign(bar.style, { left: `${r.left}px`, top: `${Math.min(r.bottom, innerHeight)}px`, width: `${r.width}px` });
    if (!dragging) seek.value = isFinite(d) && d ? cur.currentTime / d * 1000 : 0;
    timeEl.textContent = `${time(cur.currentTime)} / ${time(d)}`;
    if (!dragging) vol.value = cur.muted ? 0 : cur.volume;
    if (+speed.value !== cur.playbackRate) speed.value = cur.playbackRate;
    requestAnimationFrame(tick);
  }

  const under = (v, x, y) => { const r = v.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  document.addEventListener("pointermove", e => {
    if (dragging || e.target === host) return;
    const v = BAR.some(on) && [...document.querySelectorAll("video")].find(v => under(v, e.clientX, e.clientY));
    if (v && v !== cur) show(v);
    else if (!v && cur) hide();
  }, { passive: true });
  document.addEventListener("scroll", hide, { capture: true, passive: true });
  document.documentElement.addEventListener("mouseleave", () => dragging || hide());

  bar.addEventListener("pointerdown", () => { dragging = true; });
  document.addEventListener("pointerup", () => { dragging = false; }, true);

  seek.oninput = () => {
    if (!cur || !isFinite(cur.duration)) return;
    cur.currentTime = seek.value / 1000 * cur.duration;
    lastTime.set(cur, cur.currentTime); // a seek back isn't a loop
  };
  // Instagram keeps its own muted state and re-applies it, so setting video.muted doesn't stick.
  // Press its audio button instead. ponytail: matches English aria-labels only; other
  // languages fall back to video.muted, which Instagram may undo.
  const audioButton = v => [...document.querySelectorAll('svg[aria-label^="Audio is"]')]
    .map(s => s.closest('button, [role="button"]'))
    .find(b => { const r = b?.getBoundingClientRect(); return r && under(v, r.left + r.width / 2, r.top + r.height / 2); });
  let toggledAt = 0;
  vol.oninput = () => {
    if (!cur) return;
    const mute = +vol.value === 0;
    // One press per drag: Instagram applies it asynchronously, so cur.muted lags for a moment.
    if (cur.muted !== mute && Date.now() - toggledAt > 500) {
      toggledAt = Date.now();
      const b = audioButton(cur);
      b ? b.click() : (cur.muted = mute);
    }
    if (!mute) cur.volume = +vol.value;
  };
  // defaultPlaybackRate too, so the speed survives Instagram reloading the source.
  speed.onchange = () => { if (cur) cur.playbackRate = cur.defaultPlaybackRate = +speed.value; };
  // The bar can't follow into fullscreen (only the video is shown), so hand over to native controls there.
  $(".fs").onclick = () => cur?.requestFullscreen();
  document.addEventListener("fullscreenchange", e => {
    if (e.target instanceof HTMLVideoElement) e.target.controls = e.target === document.fullscreenElement;
  });

  // ---- Auto-scroll Reels ----
  let advancedAt = 0;
  function nextReel(v) {
    if (!on("autoscroll") || !location.pathname.startsWith("/reels/") || document.fullscreenElement) return;
    if (Date.now() - advancedAt < 2000 || !under(v, innerWidth / 2, innerHeight / 2)) return;
    advancedAt = Date.now();
    // ponytail: scrolls the nearest scroll container by one video height and lets Instagram's
    // scroll-snap land on the next Reel; switch to clicking a "next" control if the layout changes.
    const top = v.getBoundingClientRect().height;
    for (let el = v.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if (el.scrollHeight > el.clientHeight && (oy === "auto" || oy === "scroll"))
        return el.scrollBy({ top, behavior: "smooth" });
    }
    scrollBy({ top, behavior: "smooth" });
  }
  // Media events don't bubble, but they still pass through document on the capture phase.
  document.addEventListener("ended", e => e.target instanceof HTMLVideoElement && nextReel(e.target), true);
  // Instagram loops Reels instead of letting them end, so also watch for the jump back to the start.
  document.addEventListener("timeupdate", e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    const prev = lastTime.get(v) ?? 0;
    lastTime.set(v, v.currentTime);
    if (v.currentTime < prev && prev > v.duration - 1.5) nextReel(v);
  }, true);

  // ---- Feature menu ----
  async function openMenu() {
    let keys = "";
    try { keys = (await chrome.runtime.sendMessage({ type: "shortcut" }))?.result ?? ""; } catch {} // extension reloaded
    $("ul").innerHTML =
      `<li><b>Switch accounts</b><span class="state on">On</span>
         <small>${keys ? `Press <kbd>${keys}</kbd> on Instagram, or pick` : "Pick"} an account in the extension.</small></li>` +
      FEATURES.map(([k, name, desc]) => `<li><b>${name}</b><span class="state ${on(k) ? "on" : ""}">${on(k) ? "On" : "Off"}</span>
         <small>${desc}</small></li>`).join("");
    menu.hidden = false;
    $(".close").focus();
  }
  const toggleMenu = () => menu.hidden ? openMenu() : (menu.hidden = true);
  corner.onclick = toggleMenu;
  $(".close").onclick = toggleMenu;

  addEventListener("keydown", e => {
    if (e.key === "Escape" && !menu.hidden) return (menu.hidden = true);
    if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || !on("menu")) return;
    const t = e.composedPath()[0];
    if (t.isContentEditable || t.matches?.("textarea, select, input:not([type=range])")) return; // typing
    e.preventDefault();
    toggleMenu();
  }, true);

  // ---- Settings ----
  function apply(videoOff) {
    off = videoOff;
    host.dataset.off = off.join(" ");
    corner.hidden = !on("corner");
    if (!BAR.some(on)) hide();
    if (!menu.hidden) openMenu();
  }
  chrome.storage.sync.get({ videoOff: [] }).then(s => apply(s.videoOff));
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "sync" && c.videoOff) apply(c.videoOff.newValue ?? []);
  });
})();
