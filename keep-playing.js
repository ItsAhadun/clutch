// Keeps Reels playing in a background tab: Instagram pauses them when the page reports itself hidden.
// Runs in the page's MAIN world at document_start so these overrides are what Instagram's code sees.
// video.js sets data-ifs-background on <html> while the setting is on (this world can't read storage).
(() => {
  const on = () => document.documentElement?.hasAttribute("data-ifs-background");
  for (const [prop, value] of [["hidden", false], ["visibilityState", "visible"],
                               ["webkitHidden", false], ["webkitVisibilityState", "visible"]]) {
    const d = Object.getOwnPropertyDescriptor(Document.prototype, prop);
    if (d?.get) Object.defineProperty(Document.prototype, prop, { ...d, get() { return on() ? value : d.get.call(this); } });
  }
  // Registered before Instagram's own listeners, so it can swallow the event first.
  for (const t of ["visibilitychange", "webkitvisibilitychange"])
    addEventListener(t, e => { if (on()) e.stopImmediatePropagation(); }, true);
})();
