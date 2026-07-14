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
