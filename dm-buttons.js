// Buttons under bot DMs (ManyChat-style "generic template" messages, e.g. "click below and confirm
// you're following"). The web client gets the buttons (cta_buttons on the message's XMA, in the Relay
// store) and ships its own button component, but IGDMessageListStandardXMAFooter returns early for a
// template that has only a title and never draws them. This draws them under that title: a link
// button opens its URL, a postback button commits Instagram's own postback mutation, the one its
// button component uses, so the reply goes out as when you tap it in the app.
// MAIN world, to reach Instagram's require() and Relay store.
(() => {
  if (window.__clutchDmButtons) return;
  window.__clutchDmButtons = true;

  const ig = name => window.require(name);
  const fiberOf = el => el[Object.keys(el).find(k => k.startsWith("__reactFiber"))];
  const empty = s => s == null || s === "";

  let env;
  const relayEnv = f => {
    for (; !env && f; f = f.return) if (f.memoizedProps?.value?.environment?.getStore) env = f.memoizedProps.value.environment;
    return env;
  };

  const CSS = `
    :host { display: block; align-self: stretch; padding: 0 12px 12px; }
    .key { display: block; box-sizing: border-box; width: 100%; margin-top: 6px; padding: 7px 12px 8px;
           border: 0; border-radius: 7px; background: #2a2b30; box-shadow: inset 0 -3px 0 #0e0f11;
           font: 600 13px/1.45 system-ui; color: #ecebe8; text-align: center; text-decoration: none;
           cursor: pointer; transition: transform .06s, box-shadow .06s; }
    .key:hover { filter: brightness(1.12); }
    .key:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #0e0f11; }
    .key:disabled { cursor: default; color: #8d8c92; }
    .key.err { color: #ff6b5e; }
    .key:focus-visible { outline: 2px solid #ecebe8; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .key { transition: none; } }`;

  function postback(btn, threadId, payload, title) {
    btn.disabled = true;
    btn.classList.remove("err");
    const failed = () => {
      btn.disabled = false;
      btn.classList.add("err");
      btn.textContent = "Not sent, try again";
    };
    ig("CometRelay").commitMutation(env, {
      mutation: ig("IGDGenericTemplatePostbackCTAButtonOffMsysMutation.graphql"),
      variables: { input: {
        ig_thread_igid: threadId,
        offline_threading_id: ig("createIGDMessageSendContext")(env).offlineThreadingId,
        postback_payload: { sensitive_string_value: payload },
        text: { sensitive_string_value: title },
      } },
      onCompleted: (_, errors) => {
        if (errors?.length) return failed();
        btn.disabled = false;
        btn.textContent = title;
      },
      onError: failed,
    });
  }

  // footer: the IGDMessageListStandardXMAFooter fiber; titleEl: the box it drew the title in.
  function addButtons(footer, titleEl) {
    const p = footer.memoizedProps;
    const src = relayEnv(footer)?.getStore().getSource();
    const xma = src?.get(p.standardXMARef?.__id);
    // Instagram's own early-return case; anything else it draws itself.
    if (!xma || p.contentType !== "INSTAGRAM_GENERIC_MESSAGE_XMA" || p.hasPreviewImage === true ||
        !empty(xma.caption_body_text) || !empty(xma.subtitle_text)) return;
    const ctas = (xma.cta_buttons?.__refs || []).map(id => src.get(id)).filter(Boolean);
    const threadId = src.get(p.viewerThreadRef?.__id)?.thread_id;
    if (!ctas.length) return;

    const host = document.createElement("div");
    host.setAttribute("data-clutch-cta", "");
    host.addEventListener("click", e => e.stopPropagation()); // keep it from the message's own click
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${CSS}</style>`;
    for (const c of ctas) {
      const title = ig("normalizeIGDXMACTAButtonTitle")(c.title);
      if (empty(title)) continue;
      if (c.cta_type === "postback" && !empty(c.postback_payload) && threadId) {
        const b = document.createElement("button");
        b.className = "key";
        b.textContent = title;
        b.onclick = () => postback(b, threadId, c.postback_payload, title);
        root.append(b);
      } else if (/^https?:\/\//.test(c.action_url || "")) {
        const a = document.createElement("a");
        a.className = "key";
        a.textContent = title;
        a.href = c.action_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        root.append(a);
      }
    }
    if (root.childElementCount > 1) titleEl.after(host);
  }

  const seen = new WeakSet();
  function scan() {
    if (!location.pathname.startsWith("/direct/")) return;
    for (const span of document.querySelectorAll('main span[dir="auto"]')) {
      if (seen.has(span)) continue;
      seen.add(span);
      let f = fiberOf(span), i = 0;
      for (; f && i < 10 && !f.type?.displayName?.includes("IGDMessageListStandardXMAFooter"); i++) f = f.return;
      if (!f || i >= 10) continue;
      // The footer's first DOM node is the title box; skip if a button row already follows it.
      let el = f.child;
      while (el && !(el.stateNode instanceof Element)) el = el.child;
      const titleEl = el?.stateNode;
      if (!titleEl || titleEl.nextElementSibling?.hasAttribute("data-clutch-cta")) continue;
      try { addButtons(f, titleEl); } catch (e) { console.warn("[clutch] DM buttons:", e); }
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; scan(); }, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
