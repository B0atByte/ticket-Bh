<?php
// ===========================================================
//  ระบบยืนยันตัวตน + สิทธิ์ตาม role + บันทึกการใช้งาน (activity log)
//  role: 'admin' (ผู้ดูแลระบบ) | 'evaluator' (ผู้ประเมิน)
// ===========================================================
require_once __DIR__ . '/db.php';

function auth_boot(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function current_user(): ?array
{
    auth_boot();
    return $_SESSION['user'] ?? null;
}

function is_admin(): bool
{
    $u = current_user();
    return $u && ($u['role'] ?? '') === 'admin';
}

// ---- ป้องกันหน้าเว็บ ----
function require_login_page(): void
{
    if (!current_user()) { header('Location: login.php'); exit; }
}

function require_admin_page(): void
{
    require_login_page();
    if (!is_admin()) { http_response_code(403); echo 'ต้องเป็นผู้ดูแลระบบเท่านั้น'; exit; }
}

// ---- ป้องกัน API ----
function require_login_api(): void
{
    if (!current_user()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'กรุณาเข้าสู่ระบบก่อน']);
        exit;
    }
}

function require_admin_api(): void
{
    require_login_api();
    if (!is_admin()) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'ต้องเป็นผู้ดูแลระบบเท่านั้น']);
        exit;
    }
}

// ---- บันทึกการใช้งาน + แจ้งเตือน Discord ----
function log_action(string $action, string $detail = ''): void
{
    $u = current_user();
    try {
        $detail = preg_replace('/^(.{0,255}).*$/su', '$1', $detail);  // ตัดความยาวแบบปลอดภัย UTF-8 (ไม่ต้องใช้ mbstring)
        db()->prepare('INSERT INTO activity_log (user_id, username, action, detail) VALUES (?,?,?,?)')
            ->execute([$u['id'] ?? null, $u['username'] ?? null, $action, $detail]);
    } catch (Throwable $e) { /* ไม่ให้ log ล่มกระทบงานหลัก */ }
    discord_notify($action, $detail, $u['username'] ?? '-');
}

// ป้ายชื่อ (ไทย) + สีของแต่ละ action สำหรับ embed Discord
function qsc_action_meta(string $a): array
{
    $m = [
        'login'        => ['เข้าสู่ระบบ',        0x22c55e],
        'login_failed' => ['ล็อกอินล้มเหลว',     0xef4444],
        'logout'       => ['ออกจากระบบ',         0x94a3b8],
        'create_audit' => ['บันทึกผลตรวจ',        0x16a34a],
        'delete_audit' => ['ลบผลตรวจ',            0xf97316],
        'clear_audits' => ['ล้างผลตรวจทั้งหมด',   0xef4444],
        'user_create'  => ['สร้างผู้ใช้',         0x0ea5e9],
        'user_delete'  => ['ลบผู้ใช้',            0xef4444],
        'topic_create' => ['เพิ่มหัวข้อประเมิน',  0x0ea5e9],
        'topic_update' => ['แก้ไขหัวข้อประเมิน',  0xf59e0b],
        'topic_delete' => ['ลบหัวข้อประเมิน',     0xef4444],
        'log_clear'    => ['ล้างบันทึกการใช้งาน', 0x94a3b8],
        'report_issue' => ['🐞 แจ้งปัญหาใหม่',    0xef4444],
    ];
    return $m[$a] ?? [$a, 0x64748b];
}

// ส่งแจ้งเตือนเข้า Discord (กันล่ม + timeout สั้น ไม่ให้กระทบ UX)
function discord_notify(string $action, string $detail, string $username): void
{
    if (!defined('DISCORD_WEBHOOK') || DISCORD_WEBHOOK === '') return;
    [$label, $color] = qsc_action_meta($action);

    $payload = [
        'username'   => 'WaTerFruit QSC',
        'embeds'     => [[
            'title'  => $label,
            'color'  => $color,
            'fields' => [
                ['name' => 'ผู้ใช้',       'value' => $username !== '' ? $username : '-', 'inline' => true],
                ['name' => 'เวลา',         'value' => date('d/m/Y H:i:s'),                'inline' => true],
                ['name' => 'รายละเอียด',   'value' => $detail !== '' ? $detail : '-',     'inline' => false],
            ],
            'footer' => ['text' => 'QSC Branch Audit'],
        ]],
    ];
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);

    try {
        if (function_exists('curl_init')) {
            $ch = curl_init(DISCORD_WEBHOOK);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS     => $json,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 3,
                CURLOPT_CONNECTTIMEOUT => 2,
            ]);
            curl_exec($ch);
            curl_close($ch);
        } else {
            $ctx = stream_context_create(['http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/json\r\n",
                'content' => $json,
                'timeout' => 3,
            ]]);
            @file_get_contents(DISCORD_WEBHOOK, false, $ctx);
        }
    } catch (Throwable $e) { /* เงียบไว้ ไม่กระทบงานหลัก */ }
}

function attempt_login(string $username, string $password): bool
{
    $stmt = db()->prepare('SELECT id, username, password, full_name, role FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $u = $stmt->fetch();
    if ($u && password_verify($password, $u['password'])) {
        auth_boot();
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id'        => (int)$u['id'],
            'username'  => $u['username'],
            'full_name' => $u['full_name'],
            'role'      => $u['role'],
        ];
        log_action('login', 'เข้าสู่ระบบ');
        return true;
    }
    log_action('login_failed', 'ชื่อผู้ใช้: ' . $username);
    return false;
}

function logout(): void
{
    log_action('logout', 'ออกจากระบบ');
    auth_boot();
    $_SESSION = [];
    session_destroy();
}
