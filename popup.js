const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const subEl = document.getElementById("subcount");
const saveEl = document.getElementById("save");
const saveBtn = document.getElementById("saveBtn");
const saveMsg = document.getElementById("saveMsg");

function activeDomain() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        resolve(tabs[0] ? new URL(tabs[0].url).hostname : "");
      } catch (_) {
        resolve("");
      }
    });
  });
}

function send(msg) {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: "no response" })));
}

function activeTabId() {
  return new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] && tabs[0].id)));
}

// Frame 0 only; the content script owns field detection.
async function fillOnPage(cred) {
  const tabId = await activeTabId();
  if (tabId != null) chrome.tabs.sendMessage(tabId, { cmd: "fill", credential: cred }, { frameId: 0 });
}

async function copyCode(cred) {
  const fresh = await send({ cmd: "totp", domain: await activeDomain(), username: cred.username });
  if (fresh.ok) cred.totp = fresh.totp;
  await navigator.clipboard.writeText(cred.totp.code);
}

const tickers = [];
setInterval(() => tickers.forEach((paint) => paint()), 1000);

function codeChip(cred) {
  const el = document.createElement("div");
  el.className = "code";
  el.title = "Copy verification code";
  let copied = 0;
  const paint = () => {
    if (Date.now() < copied) return;
    const left = Math.max(0, Math.round(cred.totp.expires - Date.now() / 1000));
    el.textContent = `${cred.totp.code} ${left}s`;
  };
  paint();
  tickers.push(paint);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    copyCode(cred).then(() => { copied = Date.now() + 1500; el.textContent = "Copied"; });
  });
  return el;
}

function avatarText(c) {
  const s = (c.username || c.title || c.domain || "?").trim();
  return s.charAt(0) || "?";
}

// --- saving a login ---------------------------------------------------------
//
// The password is read from the page only when the user presses the button
// below, it is never stored by the extension, and it goes straight to the
// keychain. A login that is already in the keychain is *updated* rather than
// added a second time.

function setSaveMsg(text, kind) {
  saveMsg.textContent = text || "";
  saveMsg.className = "msg" + (kind ? " " + kind : "");
}

// What the page currently has in its login form.
function pageCredentials() {
  return new Promise((resolve) => {
    activeTabId().then((tabId) => {
      if (tabId == null) return resolve(null);
      chrome.tabs.sendMessage(tabId, { cmd: "getFormCredentials" }, { frameId: 0 }, (resp) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(resp && resp.ok ? resp : null);
      });
    });
  });
}

// The site we are on - the page's own host, never one the page claims.
function tabHost() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        resolve(tabs[0] ? new URL(tabs[0].url).hostname : "");
      } catch (_) {
        resolve("");
      }
    });
  });
}

function confirmBox(title, subtitle) {
  const box = document.createElement("div");
  box.className = "who";
  const t = document.createElement("div");
  t.className = "u";
  t.textContent = title;
  const d = document.createElement("div");
  d.className = "d";
  d.textContent = subtitle;
  box.appendChild(t);
  box.appendChild(d);
  return box;
}

function buttonRow(items) {
  const row = document.createElement("div");
  row.className = "row";
  for (const [label, cls, onClick] of items) {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener("click", onClick);
    row.appendChild(b);
  }
  return row;
}

async function saveLogin() {
  saveBtn.disabled = true;
  setSaveMsg("Looking for a login form...");

  const creds = await pageCredentials();
  if (!creds || !creds.password) {
    saveBtn.disabled = false;
    setSaveMsg("No login form with a filled-in password on this page", "err");
    return;
  }
  // The site must be the one the tab is on: a page must not be able to make a
  // login land under a different name than the user is looking at.
  const host = await tabHost();
  if (!host || host !== creds.domain) {
    saveBtn.disabled = false;
    setSaveMsg("This page does not match the site it claims to be - not saving", "err");
    return;
  }

  // Is this login already in the keychain? Then it is an update, not a new entry.
  const match = await send({ cmd: "match", domain: creds.domain });
  const existing = (match.credentials || []).find(
    (c) => c.username === creds.username && c.record);
  const action = existing ? "update" : "save";

  setSaveMsg("");
  const box = confirmBox(
    creds.username || "(no account)",
    `${creds.domain}  -  ${action === "update" ? "update the saved password" : "save this login"}`);
  const row = buttonRow([
    ["Cancel", "", () => { box.remove(); row.remove(); saveBtn.disabled = false; setSaveMsg(""); }],
    [action === "update" ? "Update" : "Save", "primary", async () => {
      const req = action === "update"
        ? { cmd: "update", record: existing.record, password: creds.password }
        : { cmd: "save", domain: creds.domain, username: creds.username, password: creds.password };
      setSaveMsg("Saving to iCloud Keychain...");
      const resp = await send(req);
      if (resp && resp.ok) {
        box.remove();
        row.remove();
        saveBtn.disabled = false;
        saveBtn.textContent = action === "update" ? "Updated" : "Saved";
        setSaveMsg(`${creds.username} @ ${creds.domain} - ${action === "update" ? "updated in" : "saved to"} your iCloud Keychain`, "ok");
        setTimeout(() => window.close(), 1500);
      } else {
        setSaveMsg((resp && resp.error) || "the write failed", "err");
      }
    }],
  ]);
  saveEl.appendChild(box);
  saveEl.appendChild(row);
}

// --- strong password suggestions --------------------------------------------

async function showSuggestions() {
  const resp = await send({ cmd: "generate", count: 3 });
  if (!resp.ok) {
    setSaveMsg((resp && resp.error) || "could not generate a password", "err");
    return;
  }
  const box = document.createElement("div");
  box.className = "who";
  const t = document.createElement("div");
  t.className = "u";
  t.textContent = "Strong password";
  const d = document.createElement("div");
  d.className = "d";
  d.textContent = "Copy one, or use it for a new login";
  box.appendChild(t);
  box.appendChild(d);
  const list = document.createElement("div");
  list.className = "suggestions";
  for (const password of resp.passwords) {
    const row = document.createElement("div");
    row.className = "suggestion";
    const label = document.createElement("span");
    label.textContent = password;
    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(password);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    });
    const use = document.createElement("button");
    use.textContent = "Use";
    use.addEventListener("click", async () => {
      // Fill the page's password field with it.
      const tabId = await activeTabId();
      if (tabId != null) {
        chrome.tabs.sendMessage(tabId, { cmd: "fill", credential: { username: "", password } },
                               { frameId: 0 });
      }
    });
    row.appendChild(label);
    row.appendChild(copy);
    row.appendChild(use);
    list.appendChild(row);
  }
  box.appendChild(list);
  saveEl.appendChild(box);
}

async function main() {
  const ping = await send({ cmd: "ping" });
  if (!ping.ok) {
    subEl.textContent = "Not connected";
    // Built with textContent, not innerHTML: the message can come from the native host.
    statusEl.textContent = "";
    const err = document.createElement("span");
    err.className = "err";
    err.textContent = `Host unavailable: ${ping.error || "?"}`;
    statusEl.appendChild(err);
    return;
  }
  const domain = await activeDomain();
  const resp = await send({ cmd: "match", domain });
  const creds = resp.ok ? resp.credentials : [];

  subEl.textContent = `${ping.count.toLocaleString()} saved logins`;
  const n = creds.length;
  statusEl.textContent = domain
    ? `${n} ${n === 1 ? "login" : "logins"} for ${domain}`
    : `${ping.count} saved | open a site to autofill`;

  listEl.innerHTML = "";
  for (const c of creds) {
    const div = document.createElement("div");
    div.className = "cred";
    div.innerHTML =
      `<div class="avatar"></div>` +
      `<div class="meta"><div class="u"></div><div class="d"></div></div>` +
      `<div class="fill">Fill -></div>`;
    div.querySelector(".avatar").textContent = avatarText(c);
    div.querySelector(".u").textContent = c.username || "(no username)";
    div.querySelector(".d").textContent = c.title || c.domain;
    if (c.totp) div.insertBefore(codeChip(c), div.querySelector(".fill"));
    div.addEventListener("click", () => { fillOnPage(c); window.close(); });
    listEl.appendChild(div);
  }

  saveBtn.addEventListener("click", saveLogin);
  const genBtn = document.getElementById("genBtn");
  if (genBtn) genBtn.addEventListener("click", showSuggestions);
}

main();
