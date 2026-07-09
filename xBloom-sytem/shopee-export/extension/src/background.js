/**
 * Background service worker (MV3).
 *
 * Responsibilities:
 *  - Capture a screenshot of the visible order page (if enabled in settings).
 *  - POST the order (and screenshot) to the backend. Running the fetch here —
 *    rather than in the content script — means the request uses the extension's
 *    host permissions and is not subject to the page's CORS restrictions.
 */

// Points at the xBloom platform via its same-origin /api proxy (LAN-friendly,
// no CORS). For LAN access set this to http://<server-ip>:5173/api in the popup.
const DEFAULT_BACKEND = "http://localhost:5173/api";

async function getSettings() {
  const s = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND,
    apiKey: "",
    captureEnabled: true,
  });
  return s;
}

/** Capture the visible tab as a PNG and return the bare base64 (no data: prefix). */
async function captureScreenshot(windowId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    return dataUrl ? dataUrl.replace(/^data:image\/png;base64,/, "") : null;
  } catch (e) {
    console.warn("[bg] screenshot failed:", e);
    return null; // screenshot is best-effort, never block the export
  }
}

async function exportOrder(order, sender) {
  const { backendUrl, apiKey, captureEnabled } = await getSettings();

  let screenshot = null;
  if (captureEnabled && sender && sender.tab) {
    screenshot = await captureScreenshot(sender.tab.windowId);
  }

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const url = backendUrl.replace(/\/+$/, "") + "/shopee/orders";
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ order, screenshot }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.error || `HTTP ${resp.status}` };
  }
  return { ok: true, status: data.status, screenshotUrl: data.screenshotUrl };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "EXPORT_ORDER") {
    exportOrder(msg.order, sender)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e && e.message ? e.message : String(e) }));
    return true; // keep the message channel open for the async response
  }
});
