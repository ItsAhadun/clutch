// Video controls, Reels auto-scroll and the ? feature menu on instagram.com.
// Injected by the manifest and, for tabs open at install, by sw.js.
(() => {
  if (window.__clutchVideo) return;
  window.__clutchVideo = true;

  // Features switched off in the popup; everything is on by default. storage.sync, not local:
  // sw.js locks local to trusted contexts because it holds session tokens. These are harmless prefs.
  let off = [];
  const on = f => !off.includes(f);

  const FEATURES = [
    ["seek", "Seek bar", "Hover a video and drag the bar to jump to any moment."],
    ["volume", "Volume", "Set the volume from the slider on the player. Volume and sound on/off are remembered."],
    ["speed", "Playback speed", "Pick anything from 0.25× to 16×."],
    ["fullscreen", "Fullscreen", "Watch any video fullscreen, Reels included."],
    ["transcript", "Transcript", "Press CC on a Reel to copy its text: Instagram's captions if it has them, else transcribed on this computer."],
    ["autoscroll", "Auto-scroll Reels", "Moves to the next Reel when one ends."],
    ["keys", "Keyboard shortcuts", "<kbd>Space</kbd> play/pause, <kbd>M</kbd> mute, <kbd>F</kbd> fullscreen, " +
      "<kbd>←</kbd> <kbd>→</kbd> back or forward 5 seconds (<kbd>Shift</kbd> with them in stories and posts, " +
      "where the arrows change story or post), <kbd>↑</kbd> <kbd>↓</kbd> volume in fullscreen."],
    ["search", "Search", "<kbd>Ctrl</kbd>+<kbd>F</kbd> opens Explore with the search box ready to type in."],
    ["background", "Keep playing in background", "Videos keep playing when you switch to another tab."],
    ["story", "Your story", "The <b>Your story</b> button at the start of the stories bar posts a photo or video to your story, with text and music."],
    ["menu", "Feature menu", "Press <kbd>?</kbd> on Instagram to open this list."],
    ["corner", "Corner button", "The <kbd>?</kbd> button in the corner that opens this list."],
  ];
  const BAR = ["seek", "volume", "speed", "fullscreen", "transcript"];
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
      .cc { padding: 0 3px; background: none; border: 1.5px solid; border-radius: 3px; font-size: 10px; font-weight: 700; }
      :host([data-off~="seek"]) .seek, :host([data-off~="volume"]) .volume, :host([data-off~="speed"]) .speed,
      :host([data-off~="fullscreen"]) .fs, :host([data-off~="transcript"]) .cc { display: none; }

      /* Corner button, feature menu and transcript panel: Keycap design system, see DESIGN.md.
         The player bar above keeps its own look. */
      .corner, .menu { --bg: #1a1b1e; --well: #141517; --cap: #2a2b30; --cap-edge: #0e0f11; --line: #2e2f35;
                       --text: #ecebe8; --muted: #8d8c92; --pink: #ff4f9a; --pink-edge: #b8306c; --on-pink: #1a0b12;
                       --mono: ui-monospace, "Cascadia Mono", Consolas, monospace; color: var(--text); }
      .corner:focus-visible, .menu :focus-visible { outline-color: var(--text); }
      .corner { position: fixed; z-index: 2147483646; right: 16px; bottom: 88px; width: 30px; height: 30px; padding: 0 0 2px;
                border: 0; border-radius: 7px; background: var(--cap); box-shadow: inset 0 -3px 0 var(--cap-edge), 0 2px 8px rgba(0,0,0,.35);
                font: 600 13px var(--mono); opacity: .75; transition: opacity .1s, transform .06s, box-shadow .06s; }
      .corner:hover { opacity: 1; }
      .corner:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 var(--cap-edge); }
      .menu { position: fixed; z-index: 2147483647; top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 16px;
              border-radius: 10px; background: var(--bg); border: 1px solid var(--line); box-shadow: 0 12px 40px rgba(0,0,0,.5);
              font-size: 13px; line-height: 1.5; animation: rise .16s ease-out; }
      @keyframes rise { from { opacity: 0; translate: 0 6px; } }
      @media (prefers-reduced-motion: reduce) { .menu { animation: none; } .corner, .key { transition: none; } }
      h2 { margin: 0 0 12px; font-size: 15px; font-weight: 650; }
      ul { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 10px; }
      li { display: grid; grid-template-columns: 1fr auto; column-gap: 8px; }
      li b { font-weight: 600; }
      li small { grid-column: 1 / -1; color: var(--muted); font-size: 12px; }
      .state { font: 11px var(--mono); color: var(--muted); }
      .state.on { color: var(--pink); }
      kbd { font: 600 11px var(--mono); padding: 1px 5px 3px; border-radius: 5px; color: var(--text);
            background: var(--cap); box-shadow: inset 0 -2px 0 var(--cap-edge); }
      p { margin: 0 0 14px; color: var(--muted); font-size: 12px; }
      .key { font-weight: 600; border: 0; border-radius: 7px; padding: 7px 14px 8px; color: var(--text);
             background: var(--cap); box-shadow: inset 0 -3px 0 var(--cap-edge); transition: transform .06s, box-shadow .06s; }
      .key:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 var(--cap-edge); }
      .key.pink { background: var(--pink); color: var(--on-pink); box-shadow: inset 0 -3px 0 var(--pink-edge); }
      .key.pink:active { box-shadow: inset 0 -1px 0 var(--pink-edge); }
      /* Off to the side so the Reel stays visible. */
      .tx { left: auto; right: 16px; transform: translateY(-50%); }
      .tx-src { font: 11px/1.5 var(--mono); }
      .tx-bar { display: block; width: 100%; height: 6px; margin: -6px 0 14px; accent-color: var(--pink); }
      .tx-text { max-height: 40vh; overflow: auto; margin-bottom: 14px; padding: 10px 12px; border-radius: 7px;
                 background: var(--well); user-select: text; }
      .tx-text:empty { display: none; }
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
        <button class="cc" aria-label="Transcript" title="Transcript">CC</button>
      </div>
    </div>
    <button class="corner" aria-label="Clutch features" title="Features (?)">?</button>
    <div class="menu" role="dialog" aria-label="Clutch features" hidden>
      <h2>Clutch</h2>
      <ul></ul>
      <p>Turn features on or off in the extension popup, under Settings.</p>
      <button class="key close">Close</button>
    </div>
    <div class="menu tx" role="dialog" aria-label="Transcript" hidden>
      <h2>Transcript</h2>
      <p class="tx-src" role="status"></p>
      <progress class="tx-bar" max="1" hidden></progress>
      <div class="tx-text" tabindex="0"></div>
      <button class="key pink tx-copy">Copy</button> <button class="key tx-close">Close</button>
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
    if (cur && (!cur.isConnected || blocked(cur))) hide();
    if (!cur) return (looping = false);
    const r = cur.getBoundingClientRect(), d = cur.duration;
    Object.assign(bar.style, { left: `${r.left}px`, top: `${barBottom(r)}px`, width: `${r.width}px` });
    if (!dragging) seek.value = isFinite(d) && d ? cur.currentTime / d * 1000 : 0;
    timeEl.textContent = `${time(cur.currentTime)} / ${time(d)}`;
    if (!dragging) vol.value = cur.muted ? 0 : cur.volume;
    if (+speed.value !== cur.playbackRate) speed.value = cur.playbackRate;
    requestAnimationFrame(tick);
  }

  // Stories lay the reply box and like/share buttons over the video's bottom edge; sit above them.
  function barBottom(r) {
    let b = Math.min(r.bottom, innerHeight);
    if (!location.pathname.startsWith("/stories/")) return b;
    for (const el of document.querySelectorAll("textarea, [contenteditable], button, [role=button]")) {
      const e = el.getBoundingClientRect(), cx = (e.left + e.right) / 2;
      if (e.height && cx > r.left && cx < r.right && e.top > r.bottom - 120 && e.top - 8 < b) b = e.top - 8;
    }
    return b;
  }

  // The bar only shows for a video in focus: anything Instagram lays over it (a post or Reel popup
  // opened from messages, the share dialog and its dimmed backdrop, a menu, a profile hover card, the
  // messages or search panel) hides the bar, or the bar draws on top of it. Instagram's own controls
  // on the video sit inside the box the video fills, so they don't count. Laid over means: in a
  // dialog the video isn't in, in another layer of the page (Instagram puts popups in their own
  // top-level element), or with an opaque-ish background.
  const layer = n => { while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; return n; };
  const covers = (el, v, box) => el !== host && !box.contains(el) &&
    (el.closest('[role="dialog"]')?.contains(v) === false || layer(el) !== layer(v) || opaque(el));
  const opaque = el => {
    const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    return !!c && +(c[3] ?? 1) >= 0.5;
  };
  function playerBox(v) {
    const r = v.getBoundingClientRect();
    let box = v;
    for (let p = v.parentElement; p; box = p, p = p.parentElement) {
      const q = p.getBoundingClientRect();
      if (q.width && (q.left < r.left - 2 || q.top < r.top - 2 || q.right > r.right + 2 || q.bottom > r.bottom + 2)) break;
    }
    return box;
  }
  let px = 0, py = 0; // last pointer position
  // Checks under the pointer and along the row the bar sits on.
  function blocked(v) {
    const r = v.getBoundingClientRect(), y = barBottom(r) - 12, box = playerBox(v);
    return [[px, py], [r.left + 12, y], [(r.left + r.right) / 2, y], [r.right - 12, y]].some(([x, y]) => {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el.contains(v)) return false; // reached the video; the rest is underneath
        if (covers(el, v, box)) return true;
      }
      return false;
    });
  }

  const under = (v, x, y) => { const r = v.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  // Grid tiles (Explore, profiles, Saved) play a preview on hover but are links to the post, not players.
  const players = () => [...document.querySelectorAll("video")].filter(v => !v.closest("a[href]"));
  document.addEventListener("pointermove", e => {
    px = e.clientX; py = e.clientY;
    if (dragging || e.target === host) return;
    const v = BAR.some(on) && players().find(v => under(v, px, py) && !blocked(v));
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
  // languages fall back to video.muted, which Instagram may undo, and isn't remembered.
  const igButton = (v, sel) => [...document.querySelectorAll(sel)]
    .map(s => s.closest('button, [role="button"]'))
    .find(b => { const r = b?.getBoundingClientRect(); return r && under(v, r.left + r.width / 2, r.top + r.height / 2); });
  const audioButton = v => igButton(v, 'svg[aria-label^="Audio is"]');
  // Volume is per <video>, so carry the last level set here over to every video that plays.
  // It and sound on/off are remembered across pages and reloads (storage.sync, like the settings).
  let volume = null, muted = true;
  chrome.storage.sync.get({ volume: null, muted: true }).then(s => ({ volume, muted } = s));
  document.addEventListener("play", e => {
    if (volume !== null && e.target instanceof HTMLVideoElement) e.target.volume = volume;
  }, true);
  // Remember sound changes however the user made them: Instagram's audio button, our bar and keys,
  // clicking the video, or the native controls in fullscreen. Instagram also mutes videos by itself
  // (every fresh page, every video it sets up), so only count a change on a video that has already
  // played a moment, made during or just after a click or key press.
  let inputAt = 0, pressed = false, saveAt;
  addEventListener("pointerdown", () => { pressed = true; inputAt = Date.now(); }, true);
  addEventListener("pointerup", () => { pressed = false; inputAt = Date.now(); }, true);
  addEventListener("keydown", () => { inputAt = Date.now(); }, true);
  document.addEventListener("volumechange", e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || v.currentTime < 0.3) return;
    if (!pressed && Date.now() - inputAt > 1000) return;
    muted = v.muted || v.volume === 0;
    if (!muted) volume = v.volume;
    clearTimeout(saveAt); // sync allows ~2 writes/s, so save once the changes settle
    saveAt = setTimeout(() => chrome.storage.sync.set(muted ? { muted } : { muted, volume }), 600);
  }, true);
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
    if (!mute) for (const v of document.querySelectorAll("video")) v.volume = volume = +vol.value;
  };
  // Instagram starts every page muted, and Chrome blocks sound until the first click or key press
  // on the page, so turn the sound back on once both allow it. Chrome skips that wait on sites you
  // often watch with sound (its Media Engagement Index); a new AudioContext starts "running"
  // exactly when that applies, so it tells us before any click.
  let soundAllowed = false;
  try { const c = new AudioContext(); soundAllowed = c.state === "running"; c.close(); } catch {}
  function restoreSound() {
    if (muted || !(soundAllowed || navigator.userActivation.hasBeenActive) || Date.now() - toggledAt < 500) return;
    const v = onScreen(false);
    const b = v?.muted && audioButton(v);
    if (b) { toggledAt = Date.now(); b.click(); }
  }
  const restoreSoon = () => setTimeout(restoreSound, 300); // after Instagram applies its own state
  document.addEventListener("play", restoreSoon, true);
  for (const t of ["pointerdown", "keydown"]) addEventListener(t, restoreSoon, { capture: true, once: true });
  // defaultPlaybackRate too, so the speed survives Instagram reloading the source.
  speed.onchange = () => { if (cur) cur.playbackRate = cur.defaultPlaybackRate = +speed.value; };
  // The bar can't follow into fullscreen (only the video is shown), so hand over to native controls there.
  $(".fs").onclick = () => cur?.requestFullscreen();
  // Instagram styles Reels object-fit: cover, which crops 9:16 to fill a 16:9 screen; letterbox instead.
  document.addEventListener("fullscreenchange", e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement)) return;
    v.controls = v === document.fullscreenElement;
    if (v.controls) v.style.setProperty("object-fit", "contain", "important");
    else v.style.removeProperty("object-fit");
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

  // ---- Transcript ----
  // Instagram's own auto-captions when the Reel has them (only a few do), else speech-to-text on
  // this computer in offscreen.js.
  const tx = $(".tx"), txSrc = $(".tx-src"), txBar = $(".tx-bar"), txText = $(".tx-text"), txCopy = $(".tx-copy");
  const transcripts = new Map(); // shortcode -> { text, source }. Never the signed file URLs: they expire.
  let run = 0; // bumped per click and on close, so a stale request can't fill the panel

  // Shortcode of the post page, or in the home feed the post the video sits in. Stories have none.
  const SHORTCODE = /\/(?:reels?|p)\/([\w-]+)/;
  const codeOf = v => (location.pathname.match(SHORTCODE) ||
    v.closest("article")?.querySelector('a[href*="/p/"], a[href*="/reel/"]')?.getAttribute("href").match(SHORTCODE))?.[1];
  // Media id: the shortcode is base64 of it; codes longer than 28 chars carry a 28-char suffix to drop.
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const mediaId = code => [...(code.length > 28 ? code.slice(0, -28) : code)]
    .reduce((n, c) => n * 64n + BigInt(B64.indexOf(c)), 0n).toString();
  // Keeps only the cue text: each block is an index line, a "-->" timing line, then the text lines.
  const srtText = srt => srt.split(/\r?\n\s*\r?\n/).map(b => b.split(/\r?\n/))
    .map(ls => ls.slice(ls.findIndex(l => l.includes("-->")) + 1).join(" ")).join(" ").replace(/\s+/g, " ").trim();

  const ask = async msg => {
    const r = await chrome.runtime.sendMessage(msg);
    if (!r?.ok) throw new Error(r?.error ?? "the extension didn't answer; reload the page");
    return r.result;
  };
  const languages = new Intl.DisplayNames(["en"], { type: "language" });
  // offscreen.js streams { status, progress } while it works, then { result } or { error }.
  const speechToText = (url, status) => new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: "transcribe" });
    port.onMessage.addListener(m => {
      if (m.status) return status(m.status, m.progress);
      port.disconnect();
      m.error ? reject(new Error(m.error)) : resolve(m.result);
    });
    port.onDisconnect.addListener(() => reject(new Error("the transcriber stopped; reload the page and try again")));
    port.postMessage({ url });
  });

  async function transcript(code, status) {
    if (transcripts.has(code)) return transcripts.get(code);
    // Same origin, so the login cookies go along. 936619743392459 is Instagram's web app id (see src/username.js).
    const r = await fetch(`/api/v1/media/${mediaId(code)}/info/`, { headers: { "X-IG-App-ID": "936619743392459" } });
    if (!r.ok) throw new Error(`Instagram answered ${r.status}`);
    // ponytail: a carousel post gives its first video, which may not be the one on screen.
    const item = (await r.json()).items?.[0];
    const media = item?.video_versions ? item : item?.carousel_media?.find(m => m.video_versions);
    let result;
    if (media?.video_subtitles_uri) {
      const srt = await fetch(media.video_subtitles_uri);
      if (!srt.ok) throw new Error(`Instagram answered ${srt.status}`);
      result = { text: srtText(await srt.text()), source: "Instagram captions" };
    } else {
      const url = media?.video_versions?.[0]?.url;
      if (!url) throw new Error("Instagram didn't list a video file for it");
      status("No Instagram captions, so transcribing on this computer…");
      await ask({ type: "transcriber" }); // opens offscreen.js
      const { text, language } = await speechToText(url, status);
      result = { text, source: `Transcribed on this computer${language ? ` (${languages.of(language)})` : ""}` };
    }
    transcripts.set(code, result);
    return result;
  }

  // auto: the copy right after transcribing, which the browser may refuse once the click is long past.
  const copy = async auto => {
    try { await navigator.clipboard.writeText(txText.textContent); txCopy.textContent = "Copied"; }
    catch { if (auto !== true) txCopy.textContent = "Copy failed"; }
  };
  function closeTx() { run++; tx.hidden = true; }

  async function transcribe(v) {
    const id = ++run;
    txText.textContent = "";
    txCopy.hidden = true;
    txCopy.textContent = "Copy";
    txBar.hidden = true;
    tx.hidden = false;
    $(".tx-close").focus();
    const code = codeOf(v);
    if (!code) return (txSrc.textContent = "Transcripts only work on Reels and posts, not stories.");
    // A fraction fills the bar; without one the bar just shows something is happening.
    const status = (text, fraction) => {
      if (id !== run) return;
      txSrc.textContent = text;
      txBar.hidden = false;
      fraction == null ? txBar.removeAttribute("value") : (txBar.value = fraction);
    };
    status("Looking for Instagram captions…");
    let result;
    try { result = await transcript(code, status); }
    catch (e) { if (id === run) txSrc.textContent = `Couldn't transcribe this Reel: ${e.message}.`; return; }
    finally { if (id === run) txBar.hidden = true; }
    if (id !== run) return;
    if (!result.text) return (txSrc.textContent = "No speech found in this Reel.");
    txSrc.textContent = result.source;
    txText.textContent = result.text;
    txCopy.hidden = false;
    copy(true);
  }

  $(".cc").onclick = () => cur && transcribe(cur);
  txCopy.onclick = copy;
  $(".tx-close").onclick = closeTx;

  // ---- Feature menu ----
  async function openMenu() {
    let keys = "";
    try { keys = (await chrome.runtime.sendMessage({ type: "shortcut" }))?.result ?? ""; } catch {} // extension reloaded
    // One key cap per key: "Alt+Shift+S", or "⇧⌥S" on macOS.
    const caps = keys && (keys.includes("+") ? keys.split("+") : [...keys]).map(k => `<kbd>${k}</kbd>`).join(" ");
    $("ul").innerHTML =
      `<li><b>Switch accounts</b><span class="state on">on</span>
         <small>${caps ? `Press ${caps} on Instagram, or pick` : "Pick"} an account in the extension.</small></li>` +
      FEATURES.map(([k, name, desc]) => `<li><b>${name}</b><span class="state ${on(k) ? "on" : ""}">${on(k) ? "on" : "off"}</span>
         <small>${desc}</small></li>`).join("");
    menu.hidden = false;
    $(".close").focus();
  }
  const toggleMenu = () => menu.hidden ? openMenu() : (menu.hidden = true);
  corner.onclick = toggleMenu;
  $(".close").onclick = toggleMenu;

  // ---- Keyboard ----
  // Shortcuts act on the fullscreen video, else the hovered one, else whichever is playing on screen.
  // Space may also resume a paused one: the video taking up the most of the screen.
  const shown = v => {
    const r = v.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) *
           Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  };
  const onScreen = anyPaused => {
    const vs = players().filter(v => shown(v) > 0);
    return vs.find(v => !v.paused) || (anyPaused ? vs.sort((a, b) => shown(b) - shown(a))[0] : null);
  };
  // Ctrl+F: Explore, then focus the search box. Goes through Instagram's own links so the page
  // doesn't reload (a reload would drop this script before it could focus anything). On a wide
  // window the box lives in the Search panel, so open that; a narrow Explore page has it built in.
  function openSearch() {
    if (!location.pathname.startsWith("/explore")) {
      const a = document.querySelector('a[href="/explore/"]');
      if (!a) return location.assign("/explore/"); // chisle: lands on Explore unfocused; no nav link means logged out anyway
      a.click();
    }
    let tries = 0, opened = false;
    const t = setInterval(() => {
      const box = document.querySelector('input[aria-label="Search input"], input[placeholder="Search"]');
      if (box) { box.focus(); box.select(); }
      else if (!opened && location.pathname.startsWith("/explore")) {
        const b = document.querySelector('svg[aria-label="Search"]')?.closest('a, button, [role="button"]');
        if (b) { b.click(); opened = true; }
      }
      if (box || ++tries > 40) clearInterval(t);
    }, 100);
  }

  const KEYS = ["f", "m", " ", "arrowleft", "arrowright", "arrowup", "arrowdown"];
  addEventListener("keydown", e => {
    if (e.key === "Escape" && (!menu.hidden || !tx.hidden)) {
      menu.hidden ? closeTx() : (menu.hidden = true);
      return e.stopPropagation(); // or Instagram closes the story or post underneath too
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f" && on("search")) {
      openSearch();
      e.preventDefault();
      return e.stopPropagation();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.composedPath()[0];
    if (t.isContentEditable || t.matches?.("textarea, select, input:not([type=range])")) return; // typing
    if (e.key === "?") {
      if (!on("menu")) return;
      toggleMenu();
    } else {
      const key = e.key.toLowerCase();
      if (!on("keys") || !KEYS.includes(key)) return;
      if (key === " " && t.closest?.("button, a, [role=button]")) return; // Space presses the focused button
      const fs = document.fullscreenElement;
      const story = location.pathname.startsWith("/stories/");
      const viewer = story || document.querySelector('[role="dialog"]');
      // Up/Down change Reels and scroll pages; only fullscreen claims them, for volume.
      if ((key === "arrowup" || key === "arrowdown") && !(fs instanceof HTMLVideoElement)) return;
      // Instagram steps through stories and the post viewer (Saved, profiles, Explore) with plain
      // arrows, so leave them to it there; Shift+arrows still seek. Fullscreen hides that viewer.
      if (key.startsWith("arrow") && !e.shiftKey && !fs && viewer) return;
      // Space scrolls feeds, profiles and Explore; it only plays/pauses where a video is the page.
      if (key === " " && !fs && !viewer && !SHORTCODE.test(location.pathname)) return;
      const v = fs instanceof HTMLVideoElement ? fs : cur || onScreen(key === " ");
      if (!v) return;
      if (key === "f") fs ? document.exitFullscreen() : v.requestFullscreen();
      else if (key === "m") { const b = audioButton(v); b ? b.click() : (v.muted = !v.muted); }
      else if (key === " ") {
        // A story runs its own timer, so pause through Instagram's button or it moves on anyway.
        const b = story && igButton(v, 'svg[aria-label="Pause"], svg[aria-label="Play"]');
        b ? b.click() : v.paused ? v.play().catch(() => {}) : v.pause();
      }
      else if (key === "arrowup" || key === "arrowdown") {
        const up = key === "arrowup";
        if (v.muted && up) { const b = audioButton(v); b ? b.click() : (v.muted = false); }
        v.volume = Math.round(Math.min(1, Math.max(0, v.volume + (up ? 0.1 : -0.1))) * 10) / 10;
      }
      else {
        v.currentTime += key === "arrowright" ? 5 : -5;
        lastTime.set(v, v.currentTime); // a rewind isn't a loop
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ---- Settings ----
  function apply(videoOff) {
    off = videoOff;
    host.dataset.off = off.join(" ");
    corner.hidden = !on("corner");
    document.documentElement.toggleAttribute("data-ifs-background", on("background")); // read by keep-playing.js
    document.documentElement.toggleAttribute("data-ifs-story", on("story")); // read by story.js
    if (!BAR.some(on)) hide();
    if (!menu.hidden) openMenu();
  }
  chrome.storage.sync.get({ videoOff: [] }).then(s => apply(s.videoOff));
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "sync" && c.videoOff) apply(c.videoOff.newValue ?? []);
  });
})();
