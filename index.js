/* ===================== state ===================== */

const state = {
  type: "url",
  history: JSON.parse(localStorage.getItem("qrHistory") || "[]"),
};

const API_BASE = "https://api.qrserver.com/v1/create-qr-code/";

/* ===================== element refs ===================== */

const els = {
  typeTabs: document.getElementById("typeTabs"),
  fields: document.getElementById("fields"),
  advanced: document.querySelector(".advanced"),
  advancedToggle: document.getElementById("advancedToggle"),
  sizeRange: document.getElementById("sizeRange"),
  sizeVal: document.getElementById("sizeVal"),
  marginRange: document.getElementById("marginRange"),
  marginVal: document.getElementById("marginVal"),
  fgColor: document.getElementById("fgColor"),
  bgColor: document.getElementById("bgColor"),
  transparentBg: document.getElementById("transparentBg"),
  eccLevel: document.getElementById("eccLevel"),
  formatSelect: document.getElementById("formatSelect"),
  generateBtn: document.getElementById("generateBtn"),
  qrBox: document.getElementById("qrBox"),
  qrPlaceholder: document.getElementById("qrPlaceholder"),
  qrImage: document.getElementById("qrImage"),
  qrLoading: document.getElementById("qrLoading"),
  outputActions: document.getElementById("outputActions"),
  downloadBtn: document.getElementById("downloadBtn"),
  copyImgBtn: document.getElementById("copyImgBtn"),
  copyDataBtn: document.getElementById("copyDataBtn"),
  historySection: document.getElementById("historySection"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("themeToggle"),
};

let currentQrUrl = "";
let currentData = "";
let toastTimer = null;

/* ===================== field templates per QR type ===================== */

const FIELD_TEMPLATES = {
  url: () => `
    <input type="text" id="f_url" placeholder="https://example.com" autocomplete="url">
  `,
  text: () => `
    <textarea id="f_text" placeholder="Type any text..."></textarea>
  `,
  wifi: () => `
    <input type="text" id="f_ssid" placeholder="Network name (SSID)">
    <input type="text" id="f_pass" placeholder="Password">
    <div class="field-2col">
      <select id="f_enc">
        <option value="WPA" selected>WPA / WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">No password</option>
      </select>
      <label class="checkbox">
        <input type="checkbox" id="f_hidden">
        <span>Hidden network</span>
      </label>
    </div>
  `,
  email: () => `
    <input type="email" id="f_email" placeholder="name@example.com">
    <input type="text" id="f_subject" placeholder="Subject (optional)">
    <textarea id="f_body" placeholder="Message (optional)"></textarea>
  `,
  phone: () => `
    <input type="tel" id="f_phone" placeholder="+1 555 123 4567">
  `,
  sms: () => `
    <input type="tel" id="f_smsphone" placeholder="+1 555 123 4567">
    <textarea id="f_smsbody" placeholder="Message (optional)"></textarea>
  `,
  vcard: () => `
    <div class="field-2col">
      <input type="text" id="f_first" placeholder="First name">
      <input type="text" id="f_last" placeholder="Last name">
    </div>
    <input type="tel" id="f_vphone" placeholder="Phone">
    <input type="email" id="f_vemail" placeholder="Email">
    <input type="text" id="f_org" placeholder="Company (optional)">
  `,
};

function renderFields(type) {
  els.fields.innerHTML = FIELD_TEMPLATES[type]();
}

/* ===================== build QR data string per type ===================== */

function buildData(type) {
  const val = (id) => (document.getElementById(id)?.value || "").trim();

  switch (type) {
    case "url": {
      let v = val("f_url");
      if (v && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) v = "https://" + v;
      return v;
    }
    case "text":
      return val("f_text");
    case "wifi": {
      const ssid = val("f_ssid");
      if (!ssid) return "";
      const pass = val("f_pass");
      const enc = document.getElementById("f_enc").value;
      const hidden = document.getElementById("f_hidden").checked;
      const esc = (s) => s.replace(/([\\;,:"])/g, "\\$1");
      return `WIFI:T:${enc};S:${esc(ssid)};${enc === "nopass" ? "" : `P:${esc(pass)};`}H:${hidden};;`;
    }
    case "email": {
      const email = val("f_email");
      if (!email) return "";
      const subject = encodeURIComponent(val("f_subject"));
      const body = encodeURIComponent(val("f_body"));
      const params = [];
      if (subject) params.push(`subject=${subject}`);
      if (body) params.push(`body=${body}`);
      return `mailto:${email}${params.length ? "?" + params.join("&") : ""}`;
    }
    case "phone": {
      const phone = val("f_phone");
      return phone ? `tel:${phone.replace(/\s+/g, "")}` : "";
    }
    case "sms": {
      const phone = val("f_smsphone");
      if (!phone) return "";
      const body = val("f_smsbody");
      return `SMSTO:${phone.replace(/\s+/g, "")}:${body}`;
    }
    case "vcard": {
      const first = val("f_first");
      const last = val("f_last");
      if (!first && !last) return "";
      const phone = val("f_vphone");
      const email = val("f_vemail");
      const org = val("f_org");
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${last};${first};;;`,
        `FN:${[first, last].filter(Boolean).join(" ")}`,
        org && `ORG:${org}`,
        phone && `TEL:${phone}`,
        email && `EMAIL:${email}`,
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return "";
  }
}

/* ===================== type tabs ===================== */

els.typeTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  state.type = btn.dataset.type;
  renderFields(state.type);
});

renderFields(state.type);

/* ===================== advanced panel ===================== */

els.advancedToggle.addEventListener("click", () => {
  els.advanced.classList.toggle("open");
});

els.sizeRange.addEventListener("input", () => {
  els.sizeVal.textContent = els.sizeRange.value;
});

els.marginRange.addEventListener("input", () => {
  els.marginVal.textContent = els.marginRange.value;
});

/* ===================== QR generation ===================== */

function buildQrUrl(data) {
  const size = els.sizeRange.value;
  const margin = els.marginRange.value;
  const ecc = els.eccLevel.value;
  const format = els.formatSelect.value;
  const fg = els.fgColor.value.replace("#", "");
  const bg = els.transparentBg.checked ? "" : els.bgColor.value.replace("#", "");

  const params = new URLSearchParams({
    data,
    size: `${size}x${size}`,
    margin,
    ecc,
    format,
    color: fg,
  });
  if (bg) params.set("bgcolor", bg);
  if (els.transparentBg.checked) params.set("bgcolor", "ffffff00");

  return `${API_BASE}?${params.toString()}`;
}

function setLoading(isLoading) {
  els.generateBtn.classList.toggle("loading", isLoading);
  els.generateBtn.disabled = isLoading;
  if (isLoading) {
    els.qrLoading.hidden = false;
  } else {
    els.qrLoading.hidden = true;
  }
}

function shakeButton() {
  els.generateBtn.classList.add("shake");
  setTimeout(() => els.generateBtn.classList.remove("shake"), 400);
}

function generate() {
  const data = buildData(state.type);

  if (!data) {
    showToast("Please fill in the required field first");
    shakeButton();
    return;
  }

  currentData = data;
  const url = buildQrUrl(data);
  currentQrUrl = url;

  setLoading(true);
  els.qrPlaceholder.hidden = true;

  const testImg = new Image();
  testImg.onload = () => {
    els.qrImage.src = url;
    els.qrImage.hidden = false;
    els.outputActions.hidden = false;
    setLoading(false);
    addToHistory(data, url, state.type);
    showToast("QR code generated");
  };
  testImg.onerror = () => {
    setLoading(false);
    els.qrPlaceholder.hidden = false;
    showToast("Couldn't generate QR code — try again");
  };
  testImg.src = url;
}

els.generateBtn.addEventListener("click", generate);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && document.activeElement.tagName !== "TEXTAREA") {
    if (els.fields.contains(document.activeElement)) {
      e.preventDefault();
      generate();
    }
  }
});

/* ===================== download / copy actions ===================== */

async function fetchAsBlob(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("network response was not ok");
  return res.blob();
}

els.downloadBtn.addEventListener("click", async () => {
  if (!currentQrUrl) return;
  const ext = els.formatSelect.value;
  try {
    const blob = await fetchAsBlob(currentQrUrl);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `qr-code.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("Download started");
  } catch {
    window.open(currentQrUrl, "_blank");
    showToast("Opened in a new tab — save it from there");
  }
});

els.copyImgBtn.addEventListener("click", async () => {
  if (!currentQrUrl) return;
  try {
    if (els.formatSelect.value !== "png") throw new Error("clipboard image copy needs PNG");
    const blob = await fetchAsBlob(currentQrUrl);
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showToast("Image copied to clipboard");
  } catch {
    showToast("Copy image failed — try PNG format or download instead");
  }
});

els.copyDataBtn.addEventListener("click", async () => {
  if (!currentData) return;
  try {
    await navigator.clipboard.writeText(currentData);
    showToast("Data copied to clipboard");
  } catch {
    showToast("Couldn't copy — try manually");
  }
});

/* ===================== history ===================== */

function saveHistory() {
  localStorage.setItem("qrHistory", JSON.stringify(state.history.slice(0, 12)));
}

function addToHistory(data, url, type) {
  state.history = state.history.filter((h) => h.data !== data);
  state.history.unshift({ data, url, type, ts: Date.now() });
  state.history = state.history.slice(0, 12);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    els.historySection.hidden = true;
    return;
  }
  els.historySection.hidden = false;
  els.historyList.innerHTML = state.history
    .map(
      (h, i) => `
      <button class="history-item" data-index="${i}" title="${escapeHtml(h.data)}" type="button">
        <img src="${h.url}" alt="" loading="lazy">
      </button>
    `
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

els.historyList.addEventListener("click", (e) => {
  const btn = e.target.closest(".history-item");
  if (!btn) return;
  const item = state.history[Number(btn.dataset.index)];
  if (!item) return;

  currentData = item.data;
  currentQrUrl = item.url;
  els.qrPlaceholder.hidden = true;
  els.qrImage.src = item.url;
  els.qrImage.hidden = false;
  els.outputActions.hidden = false;
  showToast("Loaded from history");
});

els.clearHistory.addEventListener("click", () => {
  state.history = [];
  saveHistory();
  renderHistory();
  showToast("History cleared");
});

renderHistory();

/* ===================== toast ===================== */

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

/* ===================== theme ===================== */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggle.querySelector(".theme-icon").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("qrTheme", theme);
}

(function initTheme() {
  const saved = localStorage.getItem("qrTheme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
})();

els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});
