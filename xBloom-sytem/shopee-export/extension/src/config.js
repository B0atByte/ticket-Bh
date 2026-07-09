/**
 * Central configuration for the content script.
 *
 * The scraper finds data by matching the *visible label text* (Thai/English),
 * NOT by CSS class — Shopee changes its markup often, so class-based selectors
 * are brittle. Each field lists several candidate labels; the first that
 * resolves a value wins. To adapt to a new Shopee layout you usually only edit
 * the arrays below — no code changes needed.
 */
(function () {
  const S = (window.ShopeeExport = window.ShopeeExport || {});

  S.config = {
    // Default backend URL; overridable from the extension popup (chrome.storage).
    defaultBackendUrl: "http://localhost:8787",

    // Candidate label texts per field (order matters — most specific first).
    labels: {
      orderNo: ["หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "Order ID", "Order No.", "Order No"],
      orderDate: ["เวลาที่ทำการสั่งซื้อ", "วันที่สั่งซื้อ", "เวลาการสั่งซื้อ", "Order Time", "Order Date"],
      buyerName: ["ชื่อผู้ซื้อ", "ชื่อผู้รับ", "ผู้ซื้อ", "Buyer", "Username", "ชื่อผู้ใช้"],
      trackingNo: ["หมายเลขพัสดุ", "หมายเลขติดตามพัสดุ", "พัสดุหมายเลข", "เลขพัสดุ", "Tracking Number", "Tracking No."],
      courier: ["ผู้ให้บริการขนส่ง", "บริษัทขนส่ง", "ขนส่งโดย", "ช่องทางการจัดส่ง", "Courier", "Logistics"],
      shipStatus: ["สถานะการจัดส่ง", "สถานะการส่ง", "Shipping Status"],
      address: ["ที่อยู่ในการจัดส่ง", "ที่อยู่จัดส่ง", "ที่อยู่ผู้รับ", "ที่อยู่", "Delivery Address", "Address"],
      productName: ["ชื่อสินค้า", "รายการสินค้า", "สินค้า", "Product Name"],
      sku: ["เลขอ้างอิง SKU", "รหัสสินค้า", "SKU"],
      qty: ["จำนวน", "Qty", "Quantity"],
      unitPrice: ["ราคาต่อชิ้น", "ราคาต่อหน่วย", "Unit Price", "ราคา"],
      saleTotal: ["ยอดขายรวม", "ยอดรวมสินค้า", "ราคารวม", "ยอดรวมคำสั่งซื้อ", "Order Total", "ยอดรวม"],
      shippingFee: ["ค่าจัดส่งที่ผู้ซื้อชำระ", "ค่าจัดส่ง", "ค่าขนส่ง", "Shipping Fee"],
      shopeeFee: ["ค่าธรรมเนียมการทำรายการ", "ค่าธรรมเนียม Shopee", "ค่าธรรมเนียม", "Transaction Fee", "Service Fee"],
      commissionFee: ["ค่าคอมมิชชั่น", "ค่าคอมมิชชัน", "Commission Fee"],
      netIncome: ["รายรับจากคำสั่งซื้อ", "รายรับสุทธิ", "รายได้สุทธิ", "ยอดเงินที่จะได้รับ", "Net Income", "รายรับ"],
    },

    // OPTIONAL: after inspecting your own order page you may set a CSS selector
    // that matches one product row. If left empty the scraper guesses rows
    // heuristically. This is the only place a CSS selector is used, and it is
    // optional — kept here so a layout change is a one-line fix, not a code edit.
    selectors: {
      productRow: "",
    },

    // Heuristic limits so label matching never scans absurdly large nodes.
    maxLabelNodeLen: 60,
  };
})();
