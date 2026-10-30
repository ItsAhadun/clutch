// "Your story" button on the desktop stories bar. Instagram's desktop code already ships the phone
// site's story upload (PolarisStoryCreationActions) but never shows a way in. This adds the button,
// a small story editor (move/zoom/rotate the photo or video, text, music from Instagram's search) and
// hands the result to those same actions, so the upload, toasts and tray refresh are Instagram's own.
// rules.json makes the final configure request look like it came from the phone site.
// Music is mixed into the story as a video with the song as its sound; the sticker is drawn on.
// MAIN world, to reach Instagram's require() and Redux store. video.js sets data-ifs-story on <html>
// while the setting is on (this world can't read storage). Looks like Instagram, not the Keycap
// system in DESIGN.md: it sits inside Instagram's own stories bar.
(() => {
  if (window.__clutchStory) return;
  window.__clutchStory = true;

  const ig = name => window.require(name);
  const isVideo = f => f.type.startsWith("video/");
  const STEP = 104; // one stories-bar slot: 90px bubble + 14px gap, as Instagram lays them out
  const W = 1080, H = 1920; // a story; the editor works in these units and is scaled down to fit
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const TEXT = 80; // text size before an item's own scale
  const COLORS = ["#ffffff", "#000000", "#3897f0", "#70c050", "#fdcb5c", "#fd8d32", "#ed4956", "#d10869", "#a307ba"];
  const MIME = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"]
    .find(t => MediaRecorder.isTypeSupported(t)); // Instagram takes MP4, not WebM
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const once = (el, type) => new Promise((ok, no) => {
    el.addEventListener(type, ok, { once: true });
    el.addEventListener("error", no, { once: true });
  });
  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  // The Redux store, found by walking up React's fiber tree from <main>.
  let store;
  function getStore() {
    if (store) return store;
    const main = document.querySelector("main");
    for (let f = main?.[Object.keys(main).find(k => k.startsWith("__reactFiber"))]; f; f = f.return) {
      const s = f.memoizedProps?.store;
      if (s?.getState?.().storyCreation) return (store = s);
    }
    throw new Error("Instagram's store not found");
  }
  const toast = text => { try { getStore().dispatch(ig("PolarisToastActions").showToast({ text })); } catch {} };
  const viewerPic = () => {
    try { const u = getStore().getState().users; return u.users.get(u.viewerId)?.profilePictureUrl; } catch {}
  };

  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:9px;top:8px;z-index:1";
  const root = host.attachShadow({ mode: "closed" });
  // Sizes, font and colors measured off Instagram's own bubbles and story editor; the colors are its theme variables.
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      button { font: 12px/16px ${FONT}; cursor: pointer; }
      .bubble { width: 90px; height: 108px; padding: 4px 0 0; border: 0; background: none; display: flex;
                flex-direction: column; align-items: center; gap: 8px; color: rgb(var(--ig-secondary-text)); }
      .pic { position: relative; width: 74px; height: 74px; }
      .pic img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: rgb(var(--ig-separator)); }
      .plus { position: absolute; right: -3px; bottom: -3px; width: 26px; height: 26px; border-radius: 50%; display: grid;
              place-items: center; background: rgb(var(--ig-primary-button)); color: #fff;
              border: 3px solid rgb(var(--ig-primary-background)); }
      .plus svg { width: 12px; height: 12px; }
      /* Uploading: a spinning ring, like the phone app's. */
      .busy .pic::before { content: ""; position: absolute; inset: -6px; border-radius: 50%;
                           background: conic-gradient(transparent 30%, rgb(var(--ig-primary-button)));
                           mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
                           animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(1turn); } }
      :focus-visible { outline: 2px solid rgb(var(--ig-primary-text)); outline-offset: 2px; border-radius: 8px; }

      dialog { width: min-content; padding: 0; border: 0; border-radius: 12px; overflow: clip; color: rgb(var(--ig-primary-text));
               background: rgb(var(--ig-elevated-background)); }
      dialog::backdrop { background: rgba(0, 0, 0, .65); }
      form { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; }
      form button { font-size: 14px; font-weight: 600; border: 0; border-radius: 8px; padding: 7px 16px; }
      .cancel { background: none; color: rgb(var(--ig-primary-text)); }
      .share { background: rgb(var(--ig-primary-button)); color: #fff; }

      /* The story: a 1080x1920 world scaled to the frame, so what you see is what gets drawn. */
      /* clip, not hidden: hidden still lets the caret scroll the frame sideways while typing */
      .stage { position: relative; display: block; height: min(78vh, 720px); aspect-ratio: 9 / 16; overflow: clip;
               background: #000; touch-action: none; user-select: none; }
      .world { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
      .world > * { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
      .world > :not(.bg) { cursor: move; }
      .text { font: 600 ${TEXT}px/1.2 ${FONT}; white-space: pre-wrap; overflow-wrap: anywhere; max-width: ${W - 120}px;
              padding: .25em .45em; border-radius: .3em; text-align: center; outline: none; }
      .text:focus { cursor: text; }

      .panel { display: none; position: absolute; left: 12px; right: 12px; align-items: center; gap: 8px; }
      .stage[data-mode=tools] .p-tools, .stage[data-mode=text] .p-text,
      .stage[data-mode=music] .p-music, .stage[data-mode=seg] .p-seg { display: flex; }
      .tools, .texttop { top: 12px; justify-content: flex-end; }
      .hint { bottom: 10px; justify-content: center; color: #fff; font-size: 12px; text-align: center;
              text-shadow: 0 1px 3px rgba(0, 0, 0, .6); pointer-events: none; }
      .round { width: 40px; height: 40px; border: 0; border-radius: 50%; padding: 0; display: grid; place-items: center;
               background: rgba(0, 0, 0, .45); color: #fff; font-size: 16px; font-weight: 700; }
      .round svg { width: 22px; height: 22px; }
      .pill { border: 0; background: none; color: #fff; font-size: 15px; font-weight: 600; padding: 8px; }
      .texttop input, .seg input { flex: 1; accent-color: #fff; }
      .swatches { bottom: 16px; justify-content: center; }
      .swatches button { width: 26px; height: 26px; padding: 0; border: 2px solid #fff; border-radius: 50%; }
      .seg { bottom: 12px; padding: 4px 4px 4px 12px; border-radius: 12px; background: rgba(0, 0, 0, .6); color: #fff;
             font-size: 13px; }
      .sheet { left: 0; right: 0; bottom: 0; top: 35%; flex-direction: column; align-items: stretch; padding: 12px;
               border-radius: 12px 12px 0 0; background: rgb(var(--ig-elevated-background)); }
      .sheet div { display: flex; gap: 8px; }
      .sheet input { flex: 1; min-width: 0; font: 14px ${FONT}; padding: 8px 12px; border: 0; border-radius: 8px; outline: none;
                     background: rgb(var(--ig-highlight-background, 239, 239, 239)); color: inherit; }
      .link { border: 0; background: none; color: inherit; font-size: 14px; font-weight: 600; }
      .results { list-style: none; margin: 8px 0 0; padding: 0; overflow: auto; flex: 1; }
      .results button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 4px; border: 0;
                        border-radius: 8px; background: none; color: inherit; text-align: left; }
      .results button:hover { background: rgba(128, 128, 128, .12); }
      .results img { flex: none; width: 44px; height: 44px; border-radius: 6px; object-fit: cover;
                     background: rgb(var(--ig-separator)); }
      .results span { min-width: 0; }
      .results b, .results small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .results b { font-size: 14px; font-weight: 600; }
      .results small, .results p { font-size: 12px; color: rgb(var(--ig-secondary-text)); }
      .results p { text-align: center; }
      .trash { display: none; position: absolute; left: 50%; bottom: 24px; translate: -50% 0; width: 48px; height: 48px;
               place-items: center; border: 2px solid #fff; border-radius: 50%; background: rgba(0, 0, 0, .35); color: #fff;
               transition: scale .15s; }
      .trash svg { width: 22px; height: 22px; }
      .dragging .trash { display: grid; }
      .stage.dragging .hint { display: none; }
      .trash.over { scale: 1.25; background: #ed4956; border-color: #ed4956; }
      @media (prefers-reduced-motion: reduce) { .busy .pic::before { animation: none; } .trash { transition: none; } }
    </style>
    <button class="bubble" aria-label="Add to your story">
      <span class="pic"><img alt=""><span class="plus"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg></span></span>
      <span>Your story</span>
    </button>
    <input type="file" accept="image/*,video/*" hidden>
    <dialog aria-label="Add to your story">
      <div class="stage" data-mode="tools">
        <div class="world"></div>
        <div class="panel p-tools tools">
          <button class="round" data-act="text" aria-label="Add text">Aa</button>
          <button class="round" data-act="music" aria-label="Add music"><svg viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></button>
        </div>
        <div class="panel p-text texttop">
          <button class="round" data-act="box" aria-label="Text background">A</button>
          <input class="size" type="range" min="0.3" max="3" step="0.01" aria-label="Text size">
          <button class="pill" data-act="done">Done</button>
        </div>
        <div class="panel p-text swatches">${COLORS.map(c =>
          `<button data-c="${c}" style="background:${c}" aria-label="Text color ${c}"></button>`).join("")}</div>
        <div class="panel p-music sheet">
          <div><input type="search" placeholder="Search music" aria-label="Search music">
            <button class="link" data-act="done">Cancel</button></div>
          <ul class="results"></ul>
        </div>
        <div class="panel p-seg seg">
          <span class="when"></span>
          <input class="start" type="range" min="0" step="0.1" aria-label="Song start">
          <button class="pill" data-act="done">Done</button>
        </div>
        <div class="panel p-tools hint">Drag to move · Scroll to resize · Shift+scroll to rotate</div>
        <div class="trash" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></div>
      </div>
      <form method="dialog">
        <button class="cancel" value="cancel">Cancel</button>
        <button class="share" value="share">Add to your story</button>
      </form>
    </dialog>`;
  const $ = s => root.querySelector(s);
  const bubble = $(".bubble"), picker = $("input"), dialog = $("dialog"), stage = $(".stage"), world = $(".world");
  const trash = $(".trash"), size = $(".size"), q = $("[type=search]"), results = $(".results");
  const startIn = $(".start"), when = $(".when");
  const mode = m => { stage.dataset.mode = m; };
  new ResizeObserver(() => { world.style.scale = stage.clientWidth / W; }).observe(stage);
  // Typing here must not reach video.js's or Instagram's shortcuts; they can't see into this closed shadow root.
  for (const t of ["keydown", "keyup", "keypress"]) dialog.addEventListener(t, e => e.stopPropagation());

  bubble.onclick = () => picker.click();
  picker.onchange = async () => {
    const file = picker.files[0];
    picker.value = "";
    if (!file) return;
    let s;
    try { s = await load(file); }
    catch { return toast("This file can't be opened. Try a JPEG, PNG or MP4."); }
    if (await show(s)) share(s);
    else if (s.url) URL.revokeObjectURL(s.url);
  };

  // Editor state for one story: s.media and each of s.items has t = {x, y, s, r}, its centre, scale and
  // rotation in story units. The DOM and the export canvas both apply it in the same order.
  let S, cur; // the story being edited, and the text being typed in
  const place = it => {
    it.el.style.transform = `translate(${it.t.x}px,${it.t.y}px) rotate(${it.t.r}rad) scale(${it.t.s}) translate(-50%,-50%)`;
  };

  async function load(file) {
    const s = { file, video: isVideo(file), items: [], music: null };
    let el, nw, nh;
    if (s.video) {
      s.url = URL.createObjectURL(file);
      el = s.src = Object.assign(document.createElement("video"), { src: s.url, muted: true, loop: true, playsInline: true });
      try { await once(el, "loadeddata"); } catch (e) { URL.revokeObjectURL(s.url); throw e; }
      nw = el.videoWidth; nh = el.videoHeight;
    } else {
      s.src = await createImageBitmap(file);
      nw = s.src.width; nh = s.src.height;
      el = Object.assign(document.createElement("canvas"), { width: nw, height: nh });
      el.getContext("2d").drawImage(s.src, 0, 0);
    }
    const f = Math.min(W / nw, H / nh);
    s.w = nw * f; s.h = nh * f;
    el.className = "media";
    el.style.width = s.w + "px"; el.style.height = s.h + "px";
    s.media = { el, t: { x: W / 2, y: H / 2, s: 1, r: 0 } };
    // Behind it, a blurred, darkened copy filling the frame, as on the phone.
    s.bg = Object.assign(document.createElement("canvas"), { width: W, height: H, className: "bg" });
    const g = s.bg.getContext("2d"), b = Math.max(W / nw, H / nh) * 1.1; // 1.1: hides the blur's faded edges
    g.filter = "blur(40px) brightness(.6)";
    g.drawImage(s.src, (W - nw * b) / 2, (H - nh * b) / 2, nw * b, nh * b);
    return s;
  }

  // Opens the editor; resolves true on "Add to your story", false on Cancel or Esc.
  function show(s) {
    S = s;
    world.replaceChildren(s.bg, s.media.el);
    place(s.media);
    q.value = "";
    results.replaceChildren();
    mode("tools");
    dialog.returnValue = "";
    dialog.showModal();
    s.src.play?.();
    return new Promise(done => dialog.addEventListener("close", () => {
      endEdit();
      hush();
      s.src.pause?.();
      world.replaceChildren();
      done(dialog.returnValue === "share");
    }, { once: true }));
  }
  // Esc leaves text, music search or the song picker first; only from the plain editor does it cancel.
  dialog.oncancel = e => {
    if (stage.dataset.mode === "tools") return;
    e.preventDefault();
    endEdit();
    mode("tools");
  };

  stage.onclick = e => {
    const act = e.target.closest("[data-act]")?.dataset.act, c = e.target.closest("[data-c]")?.dataset.c;
    if (act === "text") addText();
    if (act === "music") { mode("music"); q.focus(); }
    if (act === "done") { endEdit(); mode("tools"); }
    if (act === "box" && cur) { cur.box = !cur.box; look(cur); cur.el.focus(); }
    if (c && cur) { cur.color = c; look(cur); cur.el.focus(); }
  };
  size.oninput = () => { if (cur) { cur.t.s = +size.value; place(cur); } };

  // Drag anything to move it, tap text to edit it, tap the song to change the part that plays,
  // drop a text or the song on the bin to remove it.
  world.onpointerdown = e => {
    if (cur) { if (!cur.el.contains(e.target)) endEdit(); return; }
    mode("tools");
    const it = S.items.find(i => i.el.contains(e.target)) ?? S.media;
    e.preventDefault();
    world.setPointerCapture(e.pointerId);
    const k = stage.clientWidth / W, x0 = e.clientX, y0 = e.clientY, { x, y } = it.t;
    let moved = false, over = false;
    world.onpointermove = e => {
      moved ||= Math.hypot(e.clientX - x0, e.clientY - y0) > 4;
      it.t.x = x + (e.clientX - x0) / k;
      it.t.y = y + (e.clientY - y0) / k;
      place(it);
      if (it === S.media || !moved) return;
      stage.classList.add("dragging");
      const r = trash.getBoundingClientRect();
      over = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      trash.classList.toggle("over", over);
    };
    world.onpointerup = world.onpointercancel = () => {
      world.onpointermove = world.onpointerup = world.onpointercancel = null;
      stage.classList.remove("dragging");
      trash.classList.remove("over");
      if (over) remove(it);
      else if (!moved && it.text !== undefined) edit(it);
      else if (!moved && it === S.music?.item) mode("seg");
    };
  };
  // Wheel or trackpad pinch resizes whatever is under the pointer; with Shift it rotates.
  world.onwheel = e => {
    e.preventDefault();
    const it = S.items.find(i => i.el.contains(e.target)) ?? S.media, d = e.deltaY || e.deltaX;
    if (e.shiftKey) it.t.r += d / 500;
    else it.t.s = Math.min(8, Math.max(0.2, it.t.s * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015))));
    place(it);
    if (it === cur) size.value = it.t.s;
  };

  function remove(it) {
    it.el.remove();
    S.items = S.items.filter(i => i !== it);
    if (it === S.music?.item) { S.music = null; hush(); }
  }

  // Text: white on nothing, or with "A" a box in the chosen colour behind white (or black) text.
  const ink = c => (c === "#ffffff" ? "#000" : "#fff");
  function look(it) {
    it.el.style.color = it.box ? ink(it.color) : it.color;
    it.el.style.background = it.box ? it.color : "";
  }
  function addText() {
    const el = Object.assign(document.createElement("div"), { className: "text", contentEditable: "plaintext-only", spellcheck: false });
    const it = { el, t: { x: W / 2, y: H / 2, s: 1, r: 0 }, color: COLORS[0], box: false, text: "", draw: g => drawText(g, it) };
    S.items.push(it);
    world.append(el);
    look(it);
    place(it);
    edit(it);
  }
  function edit(it) {
    cur = it;
    size.value = it.t.s;
    mode("text");
    it.el.focus();
  }
  function endEdit() {
    if (!cur) return;
    // Read while it's still on the page: the export draws the same box and line breaks.
    cur.text = cur.el.innerText;
    if (!cur.text.trim()) remove(cur);
    else Object.assign(cur, { lines: lines(cur.el), w: cur.el.offsetWidth, h: cur.el.offsetHeight });
    cur.el.blur();
    cur = null;
    mode("tools");
  }
  // The text's lines as the editor wrapped them: each character goes to the line its middle sits on,
  // so wrapped lines and blank ones come out as shown.
  function lines(el) {
    const t = el.style.transform;
    el.style.transform = "none"; // rotated, a line's characters wouldn't line up
    const box = el.getBoundingClientRect(), k = box.height / el.offsetHeight, lh = TEXT * 1.2 * k;
    const out = Array(Math.round((el.offsetHeight - TEXT * 0.5) / (TEXT * 1.2))).fill("");
    const r = document.createRange(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) for (let i = 0; i < n.length; i++) {
      r.setStart(n, i); r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect(), line = Math.floor((b.top + b.height / 2 - box.top - TEXT * 0.25 * k) / lh);
      if (b.height && line in out) out[line] += n.data[i];
    }
    el.style.transform = t;
    return out.map(l => l.replace(/\s+$/, "")); // spaces at a line's end hang outside it
  }
  // Same box as the DOM: lines centred, line-height 1.2, padding .25em, corners .3em.
  function drawText(g, it) {
    const lh = TEXT * 1.2, { lines, w, h } = it;
    g.font = `600 ${TEXT}px ${FONT}`;
    if (it.box) {
      g.fillStyle = it.color;
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, TEXT * 0.3);
      g.fill();
    }
    g.fillStyle = it.box ? ink(it.color) : it.color;
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 0, -h / 2 + TEXT * 0.25 + (i + 0.5) * lh));
  }

  // Music. The phone app's music API refuses the website, but Instagram's web search returns songs
  // with their audio files, which load from the page.
  let ac, playing, searching;
  const audio = () => (ac ??= new AudioContext());
  const hush = () => { playing?.stop(); playing = null; };
  const segLen = s => (s.video ? Math.min(s.src.duration, 60) : 15); // a photo with a song becomes a 15s video

  async function search(query) {
    const r = await ig("PolarisInstapi").apiGet("/api/v1/fbsearch/web/top_serp/",
      { query: { query, search_surface: "web_top_search" } });
    const songs = new Map();
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      const m = o.music_asset_info;
      if (m?.progressive_download_url && o.music_consumption_info?.allow_media_creation_with_music !== false)
        songs.set(m.audio_asset_id, m);
      for (const k in o) walk(o[k]);
    })(r.data ?? r);
    return [...songs.values()];
  }
  q.oninput = () => {
    clearTimeout(searching);
    searching = setTimeout(async () => {
      const term = q.value.trim();
      if (!term) return results.replaceChildren();
      let songs = [];
      try { songs = await search(term); } catch (e) { console.error("[Clutch] music search", e); }
      if (q.value.trim() !== term) return;
      results.replaceChildren(...songs.map(m => {
        const li = document.createElement("li");
        li.innerHTML = `<button><img alt=""><span><b></b><small></small></span></button>`;
        li.querySelector("img").src = m.cover_artwork_thumbnail_uri;
        li.querySelector("b").textContent = m.title;
        li.querySelector("small").textContent = m.display_artist;
        li.querySelector("button").onclick = () => pick(m);
        return li;
      }));
      if (!songs.length) results.innerHTML = "<li><p>No songs found</p></li>";
    }, 350);
  };

  async function pick(m) {
    const s = S;
    mode("seg");
    when.textContent = "Loading…";
    try {
      const [buf, el] = await Promise.all([
        fetch(m.progressive_download_url).then(r => r.arrayBuffer()).then(b => audio().decodeAudioData(b)),
        sticker(m)]);
      if (S !== s || !dialog.open) return;
      if (s.music) remove(s.music.item);
      const item = { el, t: { x: W / 2, y: H * 0.72, s: 1, r: 0 }, draw: g => g.drawImage(el, -el.width / 2, -el.height / 2) };
      s.items.push(item);
      world.append(el);
      place(item);
      s.music = { m, buf, item, start: (m.highlight_start_times_in_ms?.[0] ?? 0) / 1000 }; // the song's chorus, as on the phone
      const max = Math.max(0, buf.duration - segLen(s));
      s.music.start = Math.min(s.music.start, max);
      Object.assign(startIn, { max, value: s.music.start });
      startIn.onchange();
    } catch (e) {
      console.error("[Clutch] music", e);
      if (S === s) when.textContent = "Couldn't load this song";
    }
  }
  // Plays the chosen part on a loop while you edit.
  startIn.oninput = () => { when.textContent = fmt(+startIn.value); };
  startIn.onchange = () => {
    if (!S.music) return;
    S.music.start = +startIn.value;
    startIn.oninput();
    hush();
    const a = audio();
    a.resume();
    playing = Object.assign(a.createBufferSource(),
      { buffer: S.music.buf, loop: true, loopStart: S.music.start, loopEnd: S.music.start + segLen(S) });
    playing.connect(a.destination);
    playing.start(0, S.music.start);
  };

  // The song card, drawn once to a canvas that both the editor shows and the export copies.
  async function sticker(m) {
    let cover;
    try { cover = await createImageBitmap(await (await fetch(m.cover_artwork_thumbnail_uri)).blob()); } catch {}
    const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
    const title = cut(m.title, 24), artist = cut(m.display_artist, 28), c = document.createElement("canvas");
    let g = c.getContext("2d");
    g.font = `600 36px ${FONT}`;
    const tw = g.measureText(title).width;
    g.font = `30px ${FONT}`;
    c.width = 172 + Math.max(tw, g.measureText(artist).width);
    c.height = 140;
    g = c.getContext("2d"); // resizing reset it
    g.fillStyle = "#fff";
    g.beginPath(); g.roundRect(0, 0, c.width, c.height, 28); g.fill();
    g.save();
    g.beginPath(); g.roundRect(20, 20, 100, 100, 14); g.clip();
    g.fillStyle = "#dbdbdb"; g.fillRect(20, 20, 100, 100);
    if (cover) g.drawImage(cover, 20, 20, 100, 100);
    g.restore();
    g.fillStyle = "#000"; g.font = `600 36px ${FONT}`; g.fillText(title, 140, 64);
    g.fillStyle = "#737373"; g.font = `30px ${FONT}`; g.fillText(artist, 140, 104);
    return c;
  }

  // Draws one frame of the story. src is the photo, or the video element playing it.
  function paint(g, s, src) {
    g.drawImage(s.bg, 0, 0);
    for (const it of [s.media, ...s.items]) {
      g.save();
      g.translate(it.t.x, it.t.y);
      g.rotate(it.t.r);
      g.scale(it.t.s, it.t.s);
      if (it === s.media) g.drawImage(src, -s.w / 2, -s.h / 2, s.w, s.h);
      else it.draw(g);
      g.restore();
    }
  }
  const edited = s => s.items.length || s.media.t.x !== W / 2 || s.media.t.y !== H / 2 || s.media.t.s !== 1 || s.media.t.r;

  // A photo becomes a JPEG; an untouched video goes as it is; anything else is recorded as an MP4
  // in real time, with the song or the video's own sound.
  async function render(s) {
    if (!s.video && !s.music) {
      const c = new OffscreenCanvas(W, H);
      paint(c.getContext("2d"), s, s.src);
      return [new File([await c.convertToBlob({ type: "image/jpeg", quality: 0.92 })], "story.jpg", { type: "image/jpeg" })];
    }
    if (s.video && !s.music && !edited(s)) return [s.file];
    if (!MIME) throw new Error("this browser can't record MP4");
    toast("Making your story. Keep this tab open.");
    const c = Object.assign(document.createElement("canvas"), { width: W, height: H }), g = c.getContext("2d");
    const a = audio(), dest = a.createMediaStreamDestination();
    await Promise.race([a.resume(), sleep(1000)]);
    if (a.state !== "running") throw new Error("audio is blocked");
    let src = s.src, secs = 15;
    if (s.video) {
      src = Object.assign(document.createElement("video"), { src: s.url, muted: !!s.music, playsInline: true });
      await once(src, "loadeddata");
      secs = Math.min(src.duration, 60);
      if (!s.music) a.createMediaElementSource(src).connect(dest);
    }
    if (s.music) secs = Math.min(secs, s.music.buf.duration - s.music.start);
    paint(g, s, src);
    const rec = new MediaRecorder(new MediaStream([...c.captureStream(30).getTracks(), ...dest.stream.getTracks()]),
      { mimeType: MIME, videoBitsPerSecond: 8e6 });
    const chunks = [], stopped = new Promise(r => { rec.onstop = r; });
    rec.ondataavailable = e => chunks.push(e.data);
    rec.start();
    if (s.music) {
      const song = a.createBufferSource();
      song.buffer = s.music.buf;
      song.connect(dest);
      song.start(0, s.music.start, secs);
    }
    src.play?.();
    const t0 = performance.now(), end = a.currentTime + secs;
    // Frames are drawn on the audio clock: timers get throttled when the window isn't in front, audio doesn't.
    const clock = a.createScriptProcessor(1024, 1, 1); // ~21ms; its output is silence
    clock.connect(a.destination);
    await new Promise((done, fail) => {
      clock.onaudioprocess = () => { paint(g, s, src); if (a.currentTime >= end) done(); };
      if (s.video) { src.onended = done; src.onerror = fail; }
    }).finally(() => clock.disconnect());
    rec.stop();
    src.pause?.();
    await stopped;
    return [new File(chunks, "story.mp4", { type: "video/mp4" }), performance.now() - t0];
  }

  async function share(s) {
    let out;
    bubble.classList.add("busy");
    try { out = await render(s); }
    catch (e) {
      console.error("[Clutch] story render", e);
      toast("Couldn't make your story. Try again.");
    } finally {
      bubble.classList.remove("busy");
      if (s.url) URL.revokeObjectURL(s.url);
    }
    if (out) post(...out);
  }

  // ms: the length of a recorded video, whose file may not say (MediaRecorder writes no duration).
  async function post(file, ms) {
    bubble.classList.add("busy");
    try {
      const s = getStore(), A = ig("PolarisStoryCreationActions");
      // Instagram's own thunks: on success they toast and reload the stories bar, on failure they
      // toast (photos with a Retry that calls this again).
      if (!isVideo(file)) return await s.dispatch(A.uploadStory(file, () => post(file)));
      // Same steps as Instagram's storyCreationSelectVideo, minus its jump to the phone-only editor page.
      const v = await ig("polarisReadVideoFile").readVideoFile(file);
      const uploadId = Date.now().toString(), entityName = "story_" + uploadId;
      s.dispatch({ type: "STORY_CREATION_VIDEO_PROCESSED", dataURL: v.src, entityName, file,
        mediaPublishMode: ig("PolarisMediaConstants").MediaPublishMode.REEL, uploadId,
        uploadMediaDurationMs: Math.floor(Number.isFinite(v.duration) ? v.duration * 1000 : ms),
        uploadMediaHeight: v.videoHeight, uploadMediaWidth: v.videoWidth, videoTransform: null });
      const cover = await ig("polarisGetVideoCoverPhoto").getVideoCoverPhoto(v);
      s.dispatch({ type: "STORY_CREATION_VIDEO_COVER_PHOTO_UPDATED", dataURL: cover.dataURL, entityName,
        file: cover.file, uploadId, uploadMediaHeight: cover.uploadMediaHeight, uploadMediaWidth: cover.uploadMediaWidth });
      await s.dispatch(A.uploadStoryVideo());
    } catch (e) {
      console.error("[Clutch] story upload", e);
      toast("Couldn't add to your story. Try again.");
    } finally {
      bubble.classList.remove("busy");
    }
  }

  // The stories bar is virtualised: each bubble is absolutely placed by Instagram. Shifting the
  // row one slot right leaves the first slot free for this button, which scrolls with the bar.
  // The canvas (a story ring) tells the bar apart from post carousels.
  let shifted;
  function mount() {
    const row = document.documentElement.hasAttribute("data-ifs-story")
      ? document.querySelector('main [role="presentation"] > div:has(> ul > li canvas)') : null;
    if (shifted && shifted !== row) shifted.style.marginLeft = "";
    shifted = row;
    if (!row) return host.remove();
    if (row.style.marginLeft !== STEP + "px") row.style.marginLeft = STEP + "px";
    if (host.parentElement !== row.parentElement) row.parentElement.prepend(host);
    const img = $(".pic img"), pic = viewerPic();
    if (pic && img.src !== pic) img.src = pic;
  }
  new MutationObserver(mount).observe(document.documentElement,
    { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ifs-story"] });
  mount();
})();
