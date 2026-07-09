/**
 * Resilient DOM scraper for the Shopee Seller Center "Order Detail" page.
 *
 * Design principle: NEVER rely on Shopee's CSS classes (they are auto-generated
 * and change frequently). Instead we locate each field by its human-readable
 * label text (configured in config.js) and then read the value that sits next
 * to / inside that label. This survives most layout changes.
 *
 * Public API (exposed on window.ShopeeExport):
 *   - scrapeOrder(): returns { ok, order, errors }
 */
(function () {
  const S = (window.ShopeeExport = window.ShopeeExport || {});
  const CFG = S.config;

  const norm = (s) => (s || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

  /** "฿25,900.00" / "19,662 บาท" / "-1,234" → number (or null). */
  function parseAmount(text) {
    if (text == null) return null;
    const cleaned = norm(String(text)).replace(/[^0-9.,-]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  /** Leaf elements that render their own text (no element children). */
  function leafTextElements() {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        // Keep elements that have visible text and no element children (true leaves).
        if (el.children.length === 0 && norm(el.textContent)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    let node = walker.nextNode();
    while (node) {
      out.push(node);
      node = walker.nextNode();
    }
    return out;
  }

  // Cache leaves per scrape pass (DOM is static during a click).
  let LEAVES = [];

  const isLabelText = (t, label) => {
    const a = norm(t);
    const b = norm(label);
    return a === b || a === b + ":" || a === b + " :";
  };

  /** Find the first non-empty text "near" a label element (sibling / parent's sibling). */
  function neighbourValue(labelEl) {
    const candidates = [];
    if (labelEl.nextElementSibling) candidates.push(labelEl.nextElementSibling);
    if (labelEl.parentElement && labelEl.parentElement.nextElementSibling)
      candidates.push(labelEl.parentElement.nextElementSibling);
    // Following siblings within the same parent.
    let sib = labelEl.nextElementSibling;
    let guard = 0;
    while (sib && guard++ < 4) {
      candidates.push(sib);
      sib = sib.nextElementSibling;
    }
    for (const c of candidates) {
      const v = norm(c.textContent);
      if (v) return v;
    }
    return null;
  }

  /**
   * Resolve a value given a list of candidate labels.
   * Two strategies, in order:
   *   1) label + value in the SAME node, e.g. "หมายเลขคำสั่งซื้อ: 260624VDUYD1XW"
   *   2) label node, value in a neighbouring node
   */
  function valueByLabels(labels) {
    for (const label of labels) {
      const l = norm(label);
      // Strategy 1: same node "label ... value"
      for (const el of LEAVES) {
        const t = norm(el.textContent);
        if (t.length > CFG.maxLabelNodeLen) continue;
        if (t.startsWith(l) && t.length > l.length) {
          const rest = norm(t.slice(l.length).replace(/^[:：\-–\s]+/, ""));
          if (rest) return rest;
        }
      }
      // Strategy 2: separate label node + neighbour value
      for (const el of LEAVES) {
        if (isLabelText(el.textContent, label)) {
          const v = neighbourValue(el);
          if (v) return v;
        }
      }
    }
    return null;
  }

  // ── Products ────────────────────────────────────────────
  // A product row usually contains a name, an "x N" quantity and a price.
  // We try (a) a user-provided CSS selector, else (b) a heuristic guess, else
  // (c) a single product assembled from labels.

  const QTY_RE = /(?:x|×|จำนวน[:\s]*)\s*(\d+)/i;

  function parseProductRow(row) {
    const text = norm(row.textContent);
    if (!text) return null;
    const qtyMatch = text.match(QTY_RE);
    const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
    // Name = the longest leaf text inside the row (product titles are long).
    let name = "";
    row.querySelectorAll("*").forEach((el) => {
      if (el.children.length === 0) {
        const t = norm(el.textContent);
        if (t.length > name.length && !QTY_RE.test(t) && !/^[\d.,฿\s]+$/.test(t)) name = t;
      }
    });
    if (!name) return null;
    // First currency-looking number in the row → unit/subtotal price.
    const price = parseAmount((text.match(/[฿]?\s*[\d,]+(?:\.\d+)?/g) || []).slice(-1)[0]);
    return { name, sku: "", qty, unitPrice: price, subtotal: price != null ? price * qty : null };
  }

  function guessProductRows() {
    // Rows that contain BOTH a quantity token and a price are very likely products.
    const all = Array.from(document.querySelectorAll("body *")).filter((el) => {
      if (el.children.length === 0) return false;
      const t = norm(el.textContent);
      if (t.length < 8 || t.length > 400) return false;
      return QTY_RE.test(t) && /[\d,]+(?:\.\d{2})?/.test(t);
    });
    // Keep the innermost matching elements (avoid huge wrappers).
    return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
  }

  function extractProducts() {
    let rows = CFG.selectors.productRow ? Array.from(document.querySelectorAll(CFG.selectors.productRow)) : [];
    if (!rows.length) rows = guessProductRows();

    const products = rows.map(parseProductRow).filter((p) => p && p.name);

    // Fallback: single product from labels.
    if (!products.length) {
      const name = valueByLabels(CFG.labels.productName);
      if (name) {
        products.push({
          name,
          sku: valueByLabels(CFG.labels.sku) || "",
          qty: parseAmount(valueByLabels(CFG.labels.qty)) || 1,
          unitPrice: parseAmount(valueByLabels(CFG.labels.unitPrice)),
          subtotal: parseAmount(valueByLabels(CFG.labels.saleTotal)),
        });
      }
    }
    // De-duplicate identical names (Shopee sometimes renders a row twice).
    const seen = new Set();
    return products.filter((p) => {
      const k = p.name + "|" + p.qty;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ── Main ────────────────────────────────────────────────
  function scrapeOrder() {
    LEAVES = leafTextElements();

    const products = extractProducts();
    const saleTotal = parseAmount(valueByLabels(CFG.labels.saleTotal));
    const order = {
      orderNo: valueByLabels(CFG.labels.orderNo) || "",
      orderDate: valueByLabels(CFG.labels.orderDate) || "",
      buyerName: valueByLabels(CFG.labels.buyerName) || "",
      trackingNo: valueByLabels(CFG.labels.trackingNo) || "",
      courier: valueByLabels(CFG.labels.courier) || "",
      shipStatus: valueByLabels(CFG.labels.shipStatus) || "",
      address: valueByLabels(CFG.labels.address) || "",
      products,
      saleTotal:
        saleTotal != null
          ? saleTotal
          : products.reduce((s, p) => s + (p.subtotal || 0), 0) || null,
      shippingFee: parseAmount(valueByLabels(CFG.labels.shippingFee)),
      shopeeFee: parseAmount(valueByLabels(CFG.labels.shopeeFee)),
      commissionFee: parseAmount(valueByLabels(CFG.labels.commissionFee)),
      netIncome: parseAmount(valueByLabels(CFG.labels.netIncome)),
      pageUrl: location.href,
    };

    // Client-side validation (mirrors the server rules for instant feedback).
    const errors = [];
    if (!order.orderNo) errors.push("ไม่พบหมายเลขคำสั่งซื้อ");
    if (!order.products.length) errors.push("ไม่พบข้อมูลสินค้า");
    if (!order.trackingNo) errors.push("ไม่พบ Tracking Number");
    if (order.netIncome == null) errors.push("ไม่พบข้อมูลรายรับสุทธิ");

    return { ok: errors.length === 0, order, errors };
  }

  /** True when the current page looks like an order detail page. */
  function isOrderDetailPage() {
    LEAVES = leafTextElements();
    return !!valueByLabels(CFG.labels.orderNo);
  }

  S.scrapeOrder = scrapeOrder;
  S.isOrderDetailPage = isOrderDetailPage;
  S.parseAmount = parseAmount;
})();
