# Shopee Order → Google Sheet

อ่านข้อมูลออเดอร์จากหน้า **Order Detail** ของ Shopee Seller Center แล้วบันทึกลง **Google Sheet** อัตโนมัติ พร้อมเก็บ **Screenshot** ลง Google Drive — ลดเวลาพนักงานที่ต้องคัดลอกทีละรายการ

---

> ## ⚠️ อัปเดต: backend ถูกรวมเข้าระบบ xBloom แล้ว
>
> **ส่วน `server/` ในโฟลเดอร์นี้ไม่ต้องรันแล้ว** (deprecated) — โค้ดถูกย้ายเข้า backend หลักของ
> xBloom เป็น route `/shopee/*` (`backend/src/routes/shopeeExport.ts`) + ตาราง `shopee_orders`
> + แท็บ **Shopee** ใน Staff CRM. รัน `docker compose up` ระบบเดียวก็พอ
>
> **ใช้แค่ `extension/`** จากโฟลเดอร์นี้ โดยตั้ง Backend URL = `http://<host>:5173/api`
> (ค่าเริ่มต้น `http://localhost:5173/api`). วิธีติดตั้งทั้งหมดดูได้ในหน้า **Staff CRM → แท็บ Shopee →
> "วิธีติดตั้งส่วนขยาย"** ซึ่งจะโชว์ URL ที่ต้องวางให้พร้อมปุ่มคัดลอก
>
> เนื้อหาด้านล่างเป็นเอกสารออกแบบเดิม (architecture/labels ยังใช้อ้างอิงได้) — แต่ขั้นตอน
> "รัน server แยก" ให้ข้ามไป
>
> Google Sheet เป็น **ทางเลือก**: ถ้าไม่ตั้งค่า Google ออเดอร์ยังเก็บใน MySQL + ดูในแท็บ Shopee ได้
> ตามปกติ. ตั้งค่า Google เมื่อไรก็จะพ่วง Sheet/Drive อัตโนมัติ (ดู `.env.example` หมวด Shopee export)

---

## 1. System Design

```
┌──────────────────────────────┐        ┌────────────────────────────┐
│  Chrome Extension (MV3)       │        │  Node.js Backend (Express) │
│                               │        │                            │
│  content.js  ── ปุ่ม Export    │        │  POST /orders              │
│  scraper.js  ── อ่าน DOM       │  HTTP  │   1. auth (x-api-key)      │
│   (text matching)             │ ─────▶ │   2. validate              │
│  background.js                │  JSON  │   3. dedupe (หา Order No)  │
│   - captureVisibleTab         │        │   4. upload screenshot ──▶ Google Drive
│   - fetch → backend           │        │   5. append row        ──▶ Google Sheet
│  popup.js    ── ตั้งค่า         │        │   + retry + logging        │
└──────────────────────────────┘        └────────────────────────────┘
```

**ทำไมแยกเป็น 2 ส่วน?**
- **Extension** อยู่ในเบราว์เซอร์ จึงอ่าน DOM ของหน้า Shopee ได้ (สิ่งที่ backend ทำไม่ได้)
- **Backend** ถือ credential ของ Google (service account) อย่างปลอดภัย — key ไม่อยู่ในเบราว์เซอร์ และการเรียก Google API ทำจาก server เพื่อเลี่ยงปัญหา CORS

**Workflow (ตรงตามที่ต้องการ)**
1. เปิดหน้า Order Detail ของ Shopee Seller Center
2. กดปุ่ม **Export To Sheet** (ลอยมุมขวาล่าง)
3. `scraper.js` อ่านข้อมูลจาก DOM ด้วยการจับคู่ **ข้อความ label** (ไม่ผูก CSS class)
4. ตรวจสอบความถูกต้อง (client + server)
5. `background.js` ถ่าย screenshot + ส่งให้ backend → backend เขียนลง Sheet
6. แสดง toast แจ้งผล (สำเร็จ / ซ้ำ / ผิดพลาด)
7. Screenshot ถูกอัปโหลดเข้า Drive และเก็บ URL ไว้ในแถวเดียวกัน

---

## 2. Folder Structure

```
shopee-export/
├── README.md
├── extension/                 # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   └── src/
│       ├── config.js          # label patterns ของแต่ละฟิลด์ (แก้ตรงนี้เมื่อ Shopee เปลี่ยนหน้า)
│       ├── scraper.js          # อ่าน DOM ด้วย text-matching (resilient)
│       ├── content.js          # ปุ่ม Export + toast + orchestrate
│       ├── background.js       # screenshot + ยิง backend
│       ├── popup.html / popup.js  # ตั้งค่า backend URL / API key / เปิด-ปิด screenshot
│       └── ui.css
└── server/                    # Node.js backend
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js           # express app
        ├── config.js          # env (fail-fast) + header ของ Sheet
        ├── logger.js          # logging ทุกขั้นตอน
        ├── retry.js           # exponential backoff (กรณี Google API ล่ม/limit)
        ├── validate.js        # validation + ข้อความ error ไทย
        ├── google.js          # auth ใช้ร่วม (Sheets + Drive)
        ├── sheets.js          # ensure header, dedupe, append
        ├── drive.js           # อัปโหลด screenshot
        └── routes/orders.js   # POST /orders
```

---

## 3. โครงสร้าง Google Sheet

แถวแรกเป็น header (ระบบสร้างให้อัตโนมัติถ้ายังว่าง):

| Order No | Order Date | Buyer | Tracking No | Courier | Product Name | Qty | Sale Price | Net Income | Address | Screenshot | Saved At |
|----------|-----------|-------|-------------|---------|--------------|-----|-----------|-----------|---------|-----------|----------|

> หลายสินค้าใน 1 ออเดอร์ → รวมชื่อด้วย `|` ในช่อง Product Name, Qty รวมจำนวน, Sale Price ใช้ยอดรวมคำสั่งซื้อ

---

## 4. การติดตั้ง

### 4.1 ตั้งค่า Google (ทำครั้งเดียว)
1. ไปที่ **Google Cloud Console** → สร้างโปรเจกต์ → เปิดใช้ **Google Sheets API** และ **Google Drive API**
2. สร้าง **Service Account** → สร้าง Key แบบ JSON → ดาวน์โหลด แล้ววางไว้ที่ `server/service-account.json`
3. คัดลอก **อีเมลของ service account** (เช่น `xxx@yyy.iam.gserviceaccount.com`)
4. สร้าง Google Sheet → **แชร์ให้อีเมล service account เป็น Editor** → คัดลอก **Sheet ID** จาก URL
5. (ออปชัน) สร้างโฟลเดอร์ Drive สำหรับ screenshot → แชร์ให้ service account → คัดลอก **Folder ID**

### 4.2 รัน Backend
```bash
cd server
npm install
cp .env.example .env       # ใส่ SHEET_ID, DRIVE_FOLDER_ID, API_KEY (ถ้าต้องการ)
npm start                  # ฟังที่ http://localhost:8787
```

### 4.3 ติดตั้ง Extension
1. เปิด `chrome://extensions` → เปิด **Developer mode**
2. **Load unpacked** → เลือกโฟลเดอร์ `shopee-export/extension`
3. คลิกไอคอน extension → ตั้งค่า **Backend URL** = `http://localhost:8787`, ใส่ **API Key** (ถ้าตั้งไว้), เปิด/ปิด **Screenshot** → บันทึก

### 4.4 ใช้งาน
เปิดหน้า Order Detail ของออเดอร์ → กดปุ่ม **Export To Sheet** มุมขวาล่าง → รอ toast แจ้งผล

---

## 5. กฎการตรวจสอบ (Validation)

ทั้งฝั่ง extension และ backend ตรวจเหมือนกัน หากไม่ครบจะแจ้ง:
- **ไม่พบหมายเลขคำสั่งซื้อ**
- **ไม่พบข้อมูลสินค้า**
- **ไม่พบ Tracking Number**
- **ไม่พบข้อมูลรายรับสุทธิ**

## 6. ป้องกันข้อมูลซ้ำ
ก่อนเพิ่มแถว ระบบค้นหา **Order No** ในคอลัมน์ A ของ Sheet — ถ้าพบแล้วจะไม่เพิ่มซ้ำ และแจ้ง *"ออเดอร์นี้ถูกบันทึกแล้ว"*

## 7. Screenshot
ถ่าย screenshot ของหน้า (เฉพาะส่วนที่มองเห็น) → ตั้งชื่อ `<Order No>.png` → อัปโหลดเข้า Drive → ตั้งสิทธิ์ anyone-with-link → เก็บ URL ลงคอลัมน์ Screenshot (ปิดได้จาก popup)

---

## 8. ความทนทานต่อการเปลี่ยนหน้าเว็บ (สำคัญ)

Scraper **ไม่ผูกกับ CSS class** ของ Shopee เลย — ค้นข้อมูลด้วย **ข้อความ label** ที่คนเห็น เช่น *หมายเลขคำสั่งซื้อ*, *หมายเลขพัสดุ*, *รายรับจากคำสั่งซื้อ* แล้วอ่านค่าที่อยู่ติดกัน

เมื่อ Shopee เปลี่ยนข้อความ/เลย์เอาต์:
- เพิ่ม/แก้ข้อความ label ได้ที่ **`extension/src/config.js` → `labels`** (ไม่ต้องแก้โค้ด)
- ถ้าการอ่าน "รายการสินค้า" ไม่แม่น ให้เปิดหน้า Order จริง คลิกขวา Inspect แถวสินค้า แล้วใส่ CSS ของแถวสินค้าใน `config.js → selectors.productRow` (เป็นจุดเดียวที่ใช้ CSS และเป็นออปชัน)

> **หมายเหตุ:** label เริ่มต้นในไฟล์ config เป็นชุดที่พบบ่อย แต่ DOM จริงของบัญชีคุณอาจต่างเล็กน้อย แนะนำทดสอบกับออเดอร์จริง 1–2 รายการแล้วปรับ `labels` ให้ตรง (ดู console ของหน้าเว็บประกอบ)

---

## 9. ความปลอดภัย & ข้อควรระวัง
- **service-account.json และ .env เป็นความลับ** — มีใน `.gitignore` แล้ว ห้าม commit
- Key ของ Google อยู่ **ฝั่ง backend เท่านั้น** ไม่อยู่ในเบราว์เซอร์
- ตั้ง **API_KEY** ได้ถ้าต้องการกันคนอื่นยิง backend (extension ส่ง `x-api-key`)
- รันบนเครื่อง local (localhost) เป็นค่าเริ่มต้น
- ข้อมูลออเดอร์มี PII (ชื่อ/ที่อยู่) — Sheet/Drive ควรจำกัดสิทธิ์การเข้าถึง (PDPA)
- การอ่านข้อมูลเป็นการดึง **ข้อมูลของร้านคุณเอง** จากบัญชีคุณเอง ใช้เพื่อเพิ่มประสิทธิภาพงานภายใน

## 10. ข้อจำกัด
- Screenshot จับเฉพาะส่วนที่มองเห็นบนจอ (viewport) — ถ้าต้องการเต็มหน้าต้องทำ scroll-stitch เพิ่ม
- การอ่านสินค้าหลายรายการเป็น heuristic — ปรับ `selectors.productRow` เพื่อความแม่น
- ต้องเปิดหน้า Order Detail ทีละออเดอร์แล้วกดปุ่ม (รองรับกดต่อเนื่องหลายออเดอร์ได้)
