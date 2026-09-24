import { getState } from "./src/store.js";
import { initials, accountColor } from "./src/switch.js";

const $ = s => document.querySelector(s);
const ICON = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`,
};

async function send(msg) {
  $("#err").textContent = "";
  const r = await chrome.runtime.sendMessage(msg);
  if (!r.ok) $("#err").textContent = r.error;
  return r.ok;
}

function card(id, a, active) {
  const li = document.createElement("li");
  li.className = "card" + (active ? " active" : "") + (a.dead ? " dead" : "");
  li.innerHTML = `
    <button class="main"><span class="avatar"></span>
      <span class="text"><span class="name"></span><span class="status"></span></span></button>
    <span class="actions">
      <button class="icon edit" aria-label="Rename">${ICON.edit}</button>
      <button class="icon del" aria-label="Delete">${ICON.trash}</button>
    </span>`;

  const avatar = li.querySelector(".avatar");
  avatar.textContent = a.dead ? "!" : initials(a.label);
  avatar.style.background = accountColor(id);
  const name = li.querySelector(".name");
  name.textContent = a.label;
  li.querySelector(".status").textContent =
    a.dead ? "Log in and save again" : active ? "Active" : "";

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
  $("#list").replaceChildren(...ids.map(id => card(id, accounts[id], id === active)));
  $("#goHome").checked = settings.goHome;
  $("#clearStorage").checked = settings.clearStorage;
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
chrome.commands.getAll().then(cmds => {
  $("#shortcut").textContent = cmds.find(c => c.name === "toggle-account")?.shortcut || "Set shortcut";
});
$("#shortcut").onclick = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });

chrome.storage.onChanged.addListener(render);
render();
send({ type: "fixNames" });
