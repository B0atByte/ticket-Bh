/** Popup: load/save extension settings in chrome.storage.sync. */
const els = {
  backendUrl: document.getElementById("backendUrl"),
  apiKey: document.getElementById("apiKey"),
  captureEnabled: document.getElementById("captureEnabled"),
  save: document.getElementById("save"),
  test: document.getElementById("test"),
  status: document.getElementById("status"),
  testResult: document.getElementById("test-result"),
};

const DEFAULTS = { backendUrl: "http://localhost:5173/api", apiKey: "", captureEnabled: true };

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.backendUrl.value = s.backendUrl;
  els.apiKey.value = s.apiKey;
  els.captureEnabled.checked = !!s.captureEnabled;
});

els.save.addEventListener("click", () => {
  const data = {
    backendUrl: els.backendUrl.value.trim() || DEFAULTS.backendUrl,
    apiKey: els.apiKey.value.trim(),
    captureEnabled: els.captureEnabled.checked,
  };
  chrome.storage.sync.set(data, () => {
    els.status.textContent = "บันทึกการตั้งค่าแล้ว";
    setTimeout(() => (els.status.textContent = ""), 1800);
  });
});

/** Ping the xBloom backend's /health so the user gets instant green/red feedback. */
els.test.addEventListener("click", async () => {
  const base = (els.backendUrl.value.trim() || DEFAULTS.backendUrl).replace(/\/+$/, "");
  els.testResult.className = "";
  els.testResult.textContent = "กำลังตรวจสอบ…";
  try {
    const resp = await fetch(base + "/health", { method: "GET" });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.status === "ok") {
      els.testResult.className = "ok";
      els.testResult.textContent = "เชื่อมต่อระบบ xBloom สำเร็จ";
    } else {
      els.testResult.className = "bad";
      els.testResult.textContent = `ตอบกลับผิดปกติ (HTTP ${resp.status}) — ตรวจ URL อีกครั้ง`;
    }
  } catch {
    els.testResult.className = "bad";
    els.testResult.textContent = "เชื่อมต่อไม่ได้ — เปิดระบบ xBloom แล้วหรือยัง / URL ถูกต้องไหม";
  }
});
