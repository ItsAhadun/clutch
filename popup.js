import { getState } from "./src/store.js";
import { initials, accountColor, nextId } from "./src/switch.js";

const $ = s => document.querySelector(s);
const ICON = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`,
};

async function send(msg) {
  $("#err").textContent = "";
  try {
    const r = await chrome.runtime.sendMessage(msg);
    if (r.ok) return true;
    $("#err").textContent = r.error;
  } catch (e) {
    $("#err").textContent = e.message;
  }
  return false;
}

function card(id, a, active, next) {
  const li = document.createElement("li");
  li.className = "card" + (active ? " active" : "") + (a.dead ? " dead" : "");
  li.innerHTML = `
    <button class="main"><span class="badge"></span><span class="handle"></span><span class="tag"></span></button>
    <span class="actions">
      <button class="icon edit" aria-label="Rename">${ICON.edit}</button>
      <button class="icon del" aria-label="Delete">${ICON.trash}</button>
    </span>`;

  const avatar = li.querySelector(".badge");
  avatar.textContent = a.dead ? "!" : initials(a.label);
  avatar.style.background = accountColor(id);
  li.querySelector(".handle").textContent = a.label;
  const tag = li.querySelector(".tag");
  tag.textContent = a.dead ? "log in again" : active ? "now" : next ? "next" : "";
  if (a.dead) tag.title = "Log in to this account on Instagram, then press Save login";

  const main = li.querySelector(".main");
  if (active) main.setAttribute("aria-current", "true");
  main.onclick = async () => { if (!active && await send({ type: "switch", id })) window.close(); };

  li.querySelector(".edit").onclick = () => {
    const input = Object.assign(document.createElement("input"), { className: "rename-input", value: a.label });
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      const label = input.value.trim();
      if (save && label && label !== a.label) send({ type: "rename", id, label }); // storage change re-renders
      else row.replaceWith(main);
    };
    input.onkeydown = e => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); };
    input.onblur = () => finish(true);
    // An input nested in a <button> can't take focus, so swap the whole row.
    const row = Object.assign(document.createElement("div"), { className: "main" });
    row.append(avatar.cloneNode(true), input);
    main.replaceWith(row);
    input.select();
  };

  // Two-step delete instead of confirm(): first click arms, second click deletes.
  const del = li.querySelector(".del");
  let armed;
  del.onclick = () => {
    if (armed) return send({ type: "delete", id });
    armed = setTimeout(() => { armed = null; del.classList.remove("confirm"); del.innerHTML = ICON.trash; }, 3000);
    del.classList.add("confirm");
    del.textContent = "Delete?";
  };
  return li;
}

async function render() {
  const { accounts, active, settings } = await getState();
  const ids = Object.keys(accounts);
  $("#empty").hidden = ids.length > 0;
  const next = nextId(accounts, active);
  $("#list").replaceChildren(...ids.map(id => card(id, accounts[id], id === active, id === next)));
  $("#goHome").checked = settings.goHome;
  $("#clearStorage").checked = settings.clearStorage;
  // Video prefs live in sync: video.js is a content script and can't read the locked-down local area.
  const { videoOff } = await chrome.storage.sync.get({ videoOff: [] });
  for (const b of videoBoxes) b.checked = !videoOff.includes(b.dataset.video);
}

const videoBoxes = [...document.querySelectorAll("[data-video]")];
for (const b of videoBoxes) {
  b.onchange = () => chrome.storage.sync.set({
    videoOff: videoBoxes.filter(x => !x.checked).map(x => x.dataset.video),
  });
}

$("#capture").onclick = async () => {
  if (await send({ type: "capture", label: $("#label").value.trim() })) $("#label").value = "";
};
$("#label").onkeydown = e => { if (e.key === "Enter") $("#capture").click(); };
$("#addAccount").onclick = () => send({ type: "addAccount" });
for (const el of [$("#goHome"), $("#clearStorage")]) {
  el.onchange = () => chrome.storage.local.set({
    settings: { goHome: $("#goHome").checked, clearStorage: $("#clearStorage").checked },
  });
}

// Chromium has no API to set a shortcut from the extension, so send the user to the browser's page.
$("#shortcut").onclick = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });

// Only what the popup shows: the usage-limit clock writes every second and would wipe a rename mid-typing.
chrome.storage.onChanged.addListener(c => { if (c.accounts || c.active || c.settings || c.videoOff) render(); });
render();
send({ type: "fixNames" });
// "Alt+Shift+S" on Windows and Linux, "⇧⌥S" on macOS: one key cap each.
const keys = (await chrome.commands.getAll()).find(c => c.name === "toggle-account")?.shortcut;
$("#caps").replaceChildren(...(keys ? (keys.includes("+") ? keys.split("+") : [...keys]) : [])
  .map(k => Object.assign(document.createElement("kbd"), { textContent: k })));
$("#keysHint").textContent = keys ? "Next account, on any Instagram tab" : "No shortcut to switch accounts yet";
$("#shortcut").textContent = keys ? "Change" : "Set one";
