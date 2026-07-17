<?php
// ===========================================================
//  ตั้งค่าระบบ — ใช้ฐานข้อมูล SQLite (ไฟล์เดียว ไม่ต้องมี DB server)
// ===========================================================

// ที่อยู่ไฟล์ฐานข้อมูล SQLite (อยู่นอก web root เพื่อความปลอดภัย)
define('DB_PATH', getenv('DB_PATH') ?: '/data/qsc.sqlite');

// ===========================================================
//  Discord Webhook — แจ้งเตือนทุก action เข้าช่อง Discord
//  ตั้งผ่าน env (DISCORD_WEBHOOK) หรือใช้ค่าด้านล่าง / ตั้ง '' เพื่อปิด
// ===========================================================
define('DISCORD_WEBHOOK', getenv('DISCORD_WEBHOOK') !== false
    ? getenv('DISCORD_WEBHOOK')
    : '');

// ===========================================================
//  Dashboard API key — ต้องแนบ header X-Dashboard-Key ให้ตรงกัน
//  เพื่อเรียก get_issues.php (ใช้โดย issues-dashboard เท่านั้น)
// ===========================================================
define('DASHBOARD_API_KEY', getenv('DASHBOARD_API_KEY') ?: '');

// ===========================================================
//  Issue Service — ปลายทางกลางที่ปุ่ม "แจ้งปัญหา" ยิง POST ไปตรงๆ จาก browser
//  (แทนที่ report_issue.php เดิมของระบบนี้)
// ===========================================================
define('ISSUE_SERVICE_URL', getenv('ISSUE_SERVICE_URL') ?: 'http://localhost:4003');

// ===========================================================
//  Quick access — ลิงก์ไปยังอีก 4 ระบบ (โชว์ในเมนูผู้ใช้)
//  ค่า default ชี้ไปที่ dev port ในเครื่อง override ได้ผ่าน env ตอน deploy จริง
// ===========================================================
define('URL_BHLOGISTICS', getenv('URL_BHLOGISTICS') ?: 'http://localhost:5173');
define('URL_PRSYSTEM', getenv('URL_PRSYSTEM') ?: 'http://localhost:5174');
define('URL_LMSCASA', getenv('URL_LMSCASA') ?: 'http://localhost:5175');
define('URL_XBLOOM', getenv('URL_XBLOOM') ?: 'http://localhost:5176');
