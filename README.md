# ticket-Bh

รวมโปรเจกต์ระบบภายในทั้งหมดของทีม แต่ละโฟลเดอร์เป็นโปรเจกต์อิสระ มี README และวิธีรันของตัวเองอยู่ข้างใน

## โปรเจกต์

| โปรเจกต์ | รายละเอียด | Stack หลัก |
|---|---|---|
| [Bhlogisticssystem](./Bhlogisticssystem) | ระบบจัดการงานขนส่งภายในองค์กร ส่งสินค้าจากครัวกลางไปสาขา (Kitchen / Admin / Driver / Branch) | Hono, Prisma, MySQL, React, Vite |
| [PRsystem](./PRsystem) | ระบบขอซื้อสินค้า (Purchase Request) ของร้าน Casa Lapin workflow อนุมัติ 3 ขั้นตอน แนบไฟล์ แจ้งเตือน Discord/Email | Hono, Prisma, MySQL, React, Vite |
| [lms-casa](./lms-casa) | Learning Management System สำหรับเทรนพนักงานและสอบ รองรับผู้ใช้ 500–5,000 คน | React, Node.js, Prisma |
| [xBloom-sytem](./xBloom-sytem) | ระบบจัดการประกันและงานบริการ xBloom มี Customer Portal และ Staff Backend | Hono, Drizzle ORM, MySQL, React |
| [QSC-Sytem](./QSC-Sytem) | เว็บแอปตรวจประเมินมาตรฐานสาขา (QSC) แบบ Yes/No พร้อม Dashboard | PHP, SQLite |
| [issues-dashboard](./issues-dashboard) | Dashboard กลาง รวมรายการ "แจ้งปัญหา" จากทั้ง 5 ระบบข้างต้นมาแสดงในหน้าเดียว (read-only) | Hono, React, Vite |

## หมายเหตุ

- แต่ละโปรเจกต์รันแยกอิสระจากกัน ต้อง `cd` เข้าไปในโฟลเดอร์นั้นก่อนติดตั้ง/รัน
- ไฟล์ `.env`, `node_modules`, ไฟล์ upload และ backup ถูก ignore ไว้แล้วในระดับ root — ดูรายละเอียดใน `.gitignore`
- ห้าม commit ไฟล์ `.env` หรือ secret ใดๆ ของแต่ละโปรเจกต์
