# WaTerFruit QSC Branch Audit — เว็บแอป (PHP + SQLite)

แบบฟอร์มตรวจประเมินมาตรฐานสาขา (QSC) แบบ Yes/No รวม 100 คะแนน
UI สมัยใหม่ mobile-first (Tailwind + Lucide icons + Chart.js) เก็บข้อมูลใน **SQLite ไฟล์เดียว**
รันด้วย **Docker container เดียว** กินพื้นที่รวม **~150 MB**

## ฟีเจอร์
- **ฟอร์มตรวจ** Yes/No 5 หมวด พร้อม accordion + สรุปคะแนน real-time
- **Dashboard** KPI, กราฟแนวโน้ม, เปรียบเทียบรายสาขา, การกระจายเกรด, ประวัติ + filter + CSV
- **ระบบ Role**: `admin` (ผู้ดูแลระบบ) / `evaluator` (ผู้ประเมิน)
- **จัดการระบบ** (admin): เพิ่ม/ลบผู้ใช้, เพิ่ม/แก้/ลบหัวข้อประเมิน, ดูบันทึกการใช้งาน (activity log)
- **แจ้งเตือน Discord**: ทุก action ส่ง embed เข้า Discord webhook อัตโนมัติ
- **แจ้งปัญหา (Report Issue)**: ปุ่มลอยมุมซ้ายล่างทุกหน้า (`partials/report_button.php`) ให้ผู้ใช้แจ้งปัญหาที่เจอได้ทันที

## วิธีรัน (Docker)
ต้องมี **Docker Desktop** จากนั้นในโฟลเดอร์นี้:
```bash
docker compose up -d
```
เปิด **http://localhost:8080/** — เสร็จ! (ครั้งแรกสร้างตาราง + บัญชี admin ให้อัตโนมัติ)

| บริการ | URL |
|--------|-----|
| เว็บแอป | http://localhost:8080/ |

## บัญชีผู้ใช้
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | ผู้ดูแลระบบ |
| 6905402  | 6905402  | ผู้ดูแลระบบ |
| 6808401  | 6808401  | ผู้ประเมิน |

> เปลี่ยนรหัสผ่าน/เพิ่มผู้ใช้ได้ในหน้า **จัดการระบบ → ผู้ใช้**

## โครงสร้างไฟล์
| ไฟล์ | หน้าที่ |
|------|--------|
| `index.php`     | ฟอร์มตรวจ |
| `dashboard.php` | สรุปผล + กราฟ + ประวัติ |
| `admin.php`     | จัดการผู้ใช้ / หัวข้อ / log (เฉพาะ admin) |
| `login.php` / `logout.php` | เข้า/ออกระบบ |
| `auth.php`      | สิทธิ์ตาม role + activity log + แจ้งเตือน Discord |
| `api.php`       | บันทึก/ดึง/ลบ/CSV + จัดการผู้ใช้/หัวข้อ |
| `criteria.php`  | หัวข้อประเมิน (โหลดจาก DB, seed อัตโนมัติครั้งแรก) |
| `db.php`        | เชื่อมต่อ SQLite + สร้างตารางอัตโนมัติ |
| `config.php`    | ที่อยู่ไฟล์ DB + Discord webhook |
| `partials/`     | head + navbar ที่ใช้ร่วมทุกหน้า |

## แจ้งปัญหา (Report Issue)

ทุกหน้าหลังจาก login มีปุ่ม "แจ้งปัญหา" ลอยอยู่มุมซ้ายล่าง ให้ผู้ใช้กดแจ้งปัญหาที่เจอได้ทันที

- Frontend ส่งคำอธิบายปัญหาพร้อม path ของหน้าปัจจุบันไปที่ `POST report_issue.php` (ไม่บังคับ login แต่ถ้า login อยู่จะแนบชื่อ/role อัตโนมัติ)
- บันทึกลงตาราง `issues` และยิงแจ้งเตือนเข้า Discord webhook เดิม (ตัวเดียวกับ action อื่นๆ ในระบบ ตั้งค่าที่ `DISCORD_WEBHOOK`) ถ้าไม่ตั้งค่าไว้ระบบจะข้ามขั้นตอนนี้ไปเงียบๆ ไม่ error

## ฐานข้อมูล
- ใช้ **SQLite** เก็บที่ไฟล์ `/data/qsc.sqlite` (ใน Docker volume `qsc_data`, อยู่นอก web root เพื่อความปลอดภัย)
- ตาราง: `audits`, `audit_answers`, `users`, `criteria`, `activity_log`, `issues`

### สำรอง / ย้ายข้อมูล
```bash
# คัดลอกไฟล์ DB ออกมา
docker cp qsc_web:/data/qsc.sqlite ./backup-qsc.sqlite
# กู้คืน
docker cp ./backup-qsc.sqlite qsc_web:/data/qsc.sqlite && docker restart qsc_web
```

## ตั้งค่า
แก้ที่ `docker-compose.yml` (env):
- `DISCORD_WEBHOOK` — URL แจ้งเตือน Discord (ตั้ง `""` เพื่อปิด)
- `DB_PATH` — ที่อยู่ไฟล์ SQLite
- `TZ` — เขตเวลา (Asia/Bangkok)

## คำสั่งที่ใช้บ่อย
```bash
docker compose logs -f web   # ดู log
docker compose down          # หยุด (ข้อมูลใน volume ยังอยู่)
docker compose down -v       # หยุด + ลบข้อมูลทั้งหมด
docker compose up -d         # เปิด
```
