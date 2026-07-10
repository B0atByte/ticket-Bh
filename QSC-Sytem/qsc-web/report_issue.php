<?php
// ===========================================================
//  แจ้งปัญหา — POST /report_issue.php
//  ไม่บังคับ login (ผู้ใช้ login อยู่แล้วจะแนบชื่อ/role อัตโนมัติ)
// ===========================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
$in  = is_array($in) ? $in : [];

$description = trim((string)($in['description'] ?? ''));
$page        = trim((string)($in['page'] ?? ''));

if (mb_strlen($description) < 5) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร']);
    exit;
}
$description = mb_substr($description, 0, 2000);
$page        = $page !== '' ? mb_substr($page, 0, 500) : null;

$u = current_user();

try {
    db()->prepare('INSERT INTO issues (description, page, username, full_name, role) VALUES (?,?,?,?,?)')
        ->execute([
            $description,
            $page,
            $u['username']  ?? null,
            $u['full_name'] ?? null,
            $u['role']      ?? null,
        ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'บันทึกไม่สำเร็จ']);
    exit;
}

$detail = $description . ($page ? "\n\nหน้า: $page" : '');
discord_notify('report_issue', $detail, $u['username'] ?? 'ไม่ระบุ (ยังไม่ได้ login)');

echo json_encode(['ok' => true]);
