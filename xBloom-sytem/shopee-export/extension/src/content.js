/**
 * Content script: injects the "Export To Sheet" button on Shopee order pages,
 * orchestrates scrape → validate → (ask background to screenshot + POST), and
 * shows a toast with the result.
 *
 * The actual network call and screenshot run in the background service worker
 * (it has the extension's host permissions, so it is not blocked by the page's
 * CORS policy).
 */
(function () {
  const S = window.ShopeeExport;
  const BTN_ID = "se-export-btn";

  // ── Toast ───────────────────────────────────────────────
  function toast(message, kind = "info") {
    let el = document.getElementById("se-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "se-toast";
      document.body.appendChild(el);
    }
    el.className = `se-toast se-toast--${kind} se-show`;
    el.textContent = message;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("se-show"), 4500);
  }

  // ── Button ──────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    if (!S.isOrderDetailPage()) return; // only on order detail pages

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Export To Sheet";
    btn.addEventListener("click", onExport);
    document.body.appendChild(btn);
  }

  function removeButtonIfNotOrderPage() {
    const btn = document.getElementById(BTN_ID);
    if (btn && !S.isOrderDetailPage()) btn.remove();
  }

  // ── Export flow ─────────────────────────────────────────
  async function onExport() {
    const btn = document.getElementById(BTN_ID);
    const reset = () => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Export To Sheet";
      }
    };
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "กำลังอ่านข้อมูล…";
      }

      // 1) scrape + 2) validate
      const { ok, order, errors } = S.scrapeOrder();
      if (!ok) {
        toast(errors.join(" · "), "error");
        reset();
        return;
      }

      if (btn) btn.textContent = "กำลังบันทึก…";

      // 3) hand off to the background worker (screenshot + POST to backend)
      const res = await chrome.runtime.sendMessage({ type: "EXPORT_ORDER", order });

      if (!res || !res.ok) {
        toast((res && res.error) || "บันทึกไม่สำเร็จ", "error");
      } else if (res.status === "duplicate") {
        toast("ออเดอร์นี้ถูกบันทึกแล้ว", "warn");
      } else {
        toast(`บันทึกสำเร็จ: ${order.orderNo}`, "success");
      }
    } catch (e) {
      toast("เกิดข้อผิดพลาด: " + (e && e.message ? e.message : e), "error");
    } finally {
      reset();
    }
  }

  // ── Boot + SPA navigation handling ──────────────────────
  // Shopee is a single-page app, so the URL changes without a full reload.
  // Re-evaluate which page we are on whenever the URL or DOM changes.
  let lastHref = "";
  function tick() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      // Give the SPA a moment to render the new view.
      setTimeout(() => {
        removeButtonIfNotOrderPage();
        injectButton();
      }, 800);
    }
  }
  setInterval(tick, 1000);

  const obs = new MutationObserver(() => injectButton());
  obs.observe(document.documentElement, { childList: true, subtree: true });

  injectButton();
})();
