<?php
// ===========================================================
//  แจ้งปัญหา — GET /get_issues.php
//  สำหรับ issues-dashboard เท่านั้น (server-to-server, ต้องมี X-Dashboard-Key)
// ===========================================================
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method not allowed']);
    exit;
}

if (DASHBOARD_API_KEY === '') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Dashboard API not configured']);
    exit;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$key = $headers['X-Dashboard-Key'] ?? $headers['x-dashboard-key'] ?? ($_SERVER['HTTP_X_DASHBOARD_KEY'] ?? '');

if (!hash_equals(DASHBOARD_API_KEY, (string)$key)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

$limit = (int)($_GET['limit'] ?? 100);
$limit = max(1, min($limit, 500));

$rows = db()->prepare('
    SELECT id, description, page,
           COALESCE(full_name, username) AS reporterName,
           role AS reporterRole,
           created_at AS createdAt
    FROM issues
    ORDER BY created_at DESC
    LIMIT ?
');
$rows->execute([$limit]);

echo json_encode([
    'system' => 'QSC-Sytem',
    'issues' => $rows->fetchAll(),
], JSON_UNESCAPED_UNICODE);
