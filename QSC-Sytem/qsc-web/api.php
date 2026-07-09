<?php
// ===========================================================
//  API: บันทึก / ดึงประวัติ / ลบ / ดาวน์โหลด CSV
//  เรียกผ่าน: api.php?action=save|list|delete|clear|export
// ===========================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/criteria.php';
require_once __DIR__ . '/auth.php';

require_login_api();   // ทุก endpoint ต้องเข้าสู่ระบบก่อน

$action = $_GET['action'] ?? '';

// export เป็นการ download ไฟล์ ไม่ส่ง JSON
if ($action === 'export') {
    exportCsv();
    exit;
}

header('Content-Type: application/json; charset=utf-8');

try {
    switch ($action) {
        case 'save':   echo json_encode(saveAudit());  break;
        case 'list':   echo json_encode(listAudits());  break;
        case 'stats':  echo json_encode(getStats());    break;
        case 'delete': echo json_encode(deleteAudit()); break;
        case 'clear':  echo json_encode(clearAll());    break;
        // ---- admin only ----
        case 'user_create':   echo json_encode(userCreate());  break;
        case 'user_delete':   echo json_encode(userDelete());  break;
        case 'topic_create':  echo json_encode(topicCreate()); break;
        case 'topic_update':  echo json_encode(topicUpdate()); break;
        case 'topic_delete':  echo json_encode(topicDelete()); break;
        case 'log_clear':     echo json_encode(logClear());    break;
        default:
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'unknown action']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

// ----------------------------------------------------------

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function saveAudit(): array
{
    global $CRITERIA, $SECTION_MAX, $SECTION_COLS;

    $in     = jsonInput();
    $scores = $in['scores'] ?? [];

    // ----- ตรวจ meta ที่จำเป็น -----
    $auditDate = trim((string)($in['auditDate'] ?? ''));
    $branch    = trim((string)($in['branch']    ?? ''));
    $modName   = trim((string)($in['modName']   ?? ''));
    $auditor   = trim((string)($in['auditor']   ?? ''));
    if ($auditDate === '' || $branch === '' || $modName === '' || $auditor === '') {
        http_response_code(422);
        return ['ok' => false, 'error' => 'กรุณากรอก วันที่ สาขา MOD และผู้ตรวจให้ครบ'];
    }

    // ----- ตรวจว่าให้คะแนนครบทุกข้อ + คำนวณคะแนนฝั่งเซิร์ฟเวอร์ (ไม่เชื่อค่าจาก client) -----
    $valid   = [];          // code => max
    foreach ($CRITERIA as $q) $valid[$q['code']] = (int)$q['max'];

    $sectionScores = array_fill_keys(array_keys($SECTION_MAX), 0);
    $total   = 0;
    $missing = [];
    $clean   = [];          // code => score ที่ผ่านการตรวจ

    foreach ($CRITERIA as $q) {
        $code = $q['code'];
        if (!array_key_exists($code, $scores) || $scores[$code] === null || $scores[$code] === '') {
            $missing[] = $code;
            continue;
        }
        // คะแนนต้องเป็น 0 หรือ max ของข้อนั้น (Yes/No)
        $sc = (int)$scores[$code];
        if ($sc !== 0 && $sc !== $valid[$code]) $sc = ($sc > 0) ? $valid[$code] : 0;
        $clean[$code] = $sc;
        $total += $sc;
        $sectionScores[$q['section']] += $sc;
    }

    if ($missing) {
        http_response_code(422);
        return ['ok' => false, 'error' => 'ยังให้คะแนนไม่ครบ ' . count($missing) . ' ข้อ',
                'missing' => $missing];
    }

    [$grade] = qsc_grade($total);

    $pdo = db();
    $pdo->beginTransaction();

    $cols = ['audit_date','branch','mod_name','am_name','auditor','note','total','grade'];
    $vals = [
        $auditDate, $branch, $modName,
        trim((string)($in['amName'] ?? '')),
        $auditor,
        trim((string)($in['note'] ?? '')),
        $total, $grade,
    ];
    // คอลัมน์คะแนนแต่ละหมวด
    foreach ($SECTION_COLS as $section => $col) {
        $cols[] = $col;
        $vals[] = $sectionScores[$section];
    }

    $place = implode(',', array_fill(0, count($cols), '?'));
    $sql   = 'INSERT INTO audits (' . implode(',', $cols) . ") VALUES ($place)";
    $pdo->prepare($sql)->execute($vals);
    $auditId = (int)$pdo->lastInsertId();

    $ins = $pdo->prepare('INSERT INTO audit_answers (audit_id, code, score) VALUES (?,?,?)');
    foreach ($clean as $code => $sc) {
        $ins->execute([$auditId, $code, $sc]);
    }

    $pdo->commit();

    log_action('create_audit', "$branch · $total/100 · $grade");
    return ['ok' => true, 'id' => $auditId, 'total' => $total, 'grade' => $grade,
            'branch' => $branch];
}

// สร้างเงื่อนไข WHERE จากตัวกรองใน query string: branch, from, to
function buildFilter(): array
{
    $where  = [];
    $params = [];
    $branch = trim((string)($_GET['branch'] ?? ''));
    $from   = trim((string)($_GET['from']   ?? ''));
    $to     = trim((string)($_GET['to']     ?? ''));

    if ($branch !== '') { $where[] = 'branch LIKE ?';     $params[] = '%' . $branch . '%'; }
    if ($from   !== '') { $where[] = 'audit_date >= ?';   $params[] = $from; }
    if ($to     !== '') { $where[] = 'audit_date <= ?';   $params[] = $to; }

    $sql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';
    return [$sql, $params];
}

function listAudits(): array
{
    [$where, $params] = buildFilter();
    $stmt = db()->prepare(
        'SELECT id, audit_date, branch, mod_name, am_name, auditor, note,
                total, grade, sec_bar, sec_call, sec_food, sec_env, sec_admin, created_at
         FROM audits' . $where . ' ORDER BY id DESC'
    );
    $stmt->execute($params);
    return ['ok' => true, 'items' => $stmt->fetchAll()];
}

function getStats(): array
{
    [$where, $params] = buildFilter();
    $pdo = db();

    // ภาพรวม
    $s = $pdo->prepare(
        'SELECT COUNT(*) cnt, ROUND(AVG(total),1) avg_total,
                COUNT(DISTINCT branch) branches,
                SUM(total >= 85) pass_cnt
         FROM audits' . $where
    );
    $s->execute($params);
    $overview = $s->fetch() ?: ['cnt'=>0,'avg_total'=>null,'branches'=>0,'pass_cnt'=>0];

    // รายสาขา
    $b = $pdo->prepare(
        'SELECT branch, COUNT(*) cnt, ROUND(AVG(total),1) avg_total, MAX(audit_date) last_date,
                ROUND(AVG(sec_bar),1) a_bar, ROUND(AVG(sec_call),1) a_call,
                ROUND(AVG(sec_food),1) a_food, ROUND(AVG(sec_env),1) a_env,
                ROUND(AVG(sec_admin),1) a_admin
         FROM audits' . $where . '
         GROUP BY branch ORDER BY avg_total DESC'
    );
    $b->execute($params);
    $branches = $b->fetchAll();

    // การกระจายเกรด
    $g = $pdo->prepare(
        'SELECT grade, COUNT(*) cnt FROM audits' . $where . ' GROUP BY grade'
    );
    $g->execute($params);
    $grades = [];
    foreach ($g->fetchAll() as $row) $grades[$row['grade']] = (int)$row['cnt'];

    // แนวโน้ม 15 ครั้งล่าสุด (เรียงเก่า->ใหม่)
    $t = $pdo->prepare(
        'SELECT id, branch, audit_date, total, grade FROM audits' . $where . '
         ORDER BY id DESC LIMIT 15'
    );
    $t->execute($params);
    $trend = array_reverse($t->fetchAll());

    return ['ok' => true, 'overview' => $overview, 'branches' => $branches,
            'grades' => $grades, 'trend' => $trend];
}

function deleteAudit(): array
{
    $in = jsonInput();
    $id = (int)($in['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(422);
        return ['ok' => false, 'error' => 'invalid id'];
    }
    $br = db()->prepare('SELECT branch, audit_date FROM audits WHERE id = ?');
    $br->execute([$id]);
    $row = $br->fetch();
    db()->prepare('DELETE FROM audits WHERE id = ?')->execute([$id]);
    log_action('delete_audit', $row ? ($row['branch'] . ' · ' . $row['audit_date']) : ('id ' . $id));
    return ['ok' => true];
}

function clearAll(): array
{
    db()->exec('DELETE FROM audits');   // answers ถูกลบตาม ON DELETE CASCADE
    log_action('clear_audits', 'ล้างประวัติผลตรวจทั้งหมด');
    return ['ok' => true];
}

// ===================== ADMIN: ผู้ใช้ =====================
function userCreate(): array
{
    require_admin_api();
    $in       = jsonInput();
    $username = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $fullName = trim((string)($in['full_name'] ?? ''));
    $role     = ($in['role'] ?? 'evaluator') === 'admin' ? 'admin' : 'evaluator';

    if ($username === '' || $password === '') {
        http_response_code(422);
        return ['ok' => false, 'error' => 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'];
    }
    if (strlen($password) < 4) {
        http_response_code(422);
        return ['ok' => false, 'error' => 'รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร'];
    }
    $chk = db()->prepare('SELECT 1 FROM users WHERE username = ?');
    $chk->execute([$username]);
    if ($chk->fetch()) {
        http_response_code(409);
        return ['ok' => false, 'error' => 'มีชื่อผู้ใช้นี้อยู่แล้ว'];
    }
    db()->prepare('INSERT INTO users (username, password, full_name, role) VALUES (?,?,?,?)')
        ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $role]);
    log_action('user_create', "$username ($role)");
    return ['ok' => true];
}

function userDelete(): array
{
    require_admin_api();
    $in = jsonInput();
    $id = (int)($in['id'] ?? 0);
    $me = current_user();
    if ($id <= 0) { http_response_code(422); return ['ok' => false, 'error' => 'invalid id']; }
    if ($id === (int)$me['id']) { http_response_code(422); return ['ok' => false, 'error' => 'ลบบัญชีตัวเองไม่ได้']; }

    $s = db()->prepare('SELECT username, role FROM users WHERE id = ?');
    $s->execute([$id]);
    $u = $s->fetch();
    if (!$u) { http_response_code(404); return ['ok' => false, 'error' => 'ไม่พบผู้ใช้']; }
    // กันลบ admin คนสุดท้าย
    if ($u['role'] === 'admin') {
        $cnt = (int)db()->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
        if ($cnt <= 1) { http_response_code(422); return ['ok' => false, 'error' => 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน']; }
    }
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    log_action('user_delete', $u['username']);
    return ['ok' => true];
}

// ===================== ADMIN: หัวข้อประเมิน =====================
function topicCreate(): array
{
    require_admin_api();
    global $SECTION_ORDER;
    $in      = jsonInput();
    $code    = trim((string)($in['code'] ?? ''));
    $section = trim((string)($in['section'] ?? ''));
    $title   = trim((string)($in['title'] ?? ''));
    $note    = trim((string)($in['note'] ?? ''));
    $max     = max(1, (int)($in['max'] ?? 1));

    if ($code === '' || $title === '' || !in_array($section, $SECTION_ORDER, true)) {
        http_response_code(422);
        return ['ok' => false, 'error' => 'กรุณากรอกรหัส หัวข้อ และเลือกหมวดให้ถูกต้อง'];
    }
    $chk = db()->prepare('SELECT 1 FROM criteria WHERE code = ?');
    $chk->execute([$code]);
    if ($chk->fetch()) { http_response_code(409); return ['ok' => false, 'error' => 'มีรหัสหัวข้อนี้อยู่แล้ว']; }

    $ord = (int)db()->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM criteria')->fetchColumn();
    db()->prepare('INSERT INTO criteria (code, section, title, note, max, sort_order) VALUES (?,?,?,?,?,?)')
        ->execute([$code, $section, $title, $note, $max, $ord]);
    log_action('topic_create', "$code · $section");
    return ['ok' => true];
}

function topicUpdate(): array
{
    require_admin_api();
    global $SECTION_ORDER;
    $in    = jsonInput();
    $id    = (int)($in['id'] ?? 0);
    $title = trim((string)($in['title'] ?? ''));
    $note  = trim((string)($in['note'] ?? ''));
    $max   = max(1, (int)($in['max'] ?? 1));
    $section = trim((string)($in['section'] ?? ''));
    if ($id <= 0 || $title === '' || !in_array($section, $SECTION_ORDER, true)) {
        http_response_code(422);
        return ['ok' => false, 'error' => 'ข้อมูลไม่ครบถ้วน'];
    }
    db()->prepare('UPDATE criteria SET section=?, title=?, note=?, max=? WHERE id=?')
        ->execute([$section, $title, $note, $max, $id]);
    log_action('topic_update', 'id ' . $id . ' · ' . $title);
    return ['ok' => true];
}

function topicDelete(): array
{
    require_admin_api();
    $in = jsonInput();
    $id = (int)($in['id'] ?? 0);
    if ($id <= 0) { http_response_code(422); return ['ok' => false, 'error' => 'invalid id']; }
    $s = db()->prepare('SELECT code FROM criteria WHERE id = ?');
    $s->execute([$id]);
    $t = $s->fetch();
    db()->prepare('DELETE FROM criteria WHERE id = ?')->execute([$id]);
    log_action('topic_delete', $t['code'] ?? ('id ' . $id));
    return ['ok' => true];
}

// ===================== ADMIN: log =====================
function logClear(): array
{
    require_admin_api();
    db()->exec('DELETE FROM activity_log');
    log_action('log_clear', 'ล้างบันทึกการใช้งาน');
    return ['ok' => true];
}

function exportCsv(): void
{
    global $CRITERIA, $SECTION_MAX;

    $pdo  = db();
    [$where, $params] = buildFilter();
    $stmt = $pdo->prepare('SELECT * FROM audits' . $where . ' ORDER BY id DESC');
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // ดึงคะแนนรายข้อทั้งหมดมาทำ map: audit_id => [code => score]
    $answers = [];
    foreach ($pdo->query('SELECT audit_id, code, score FROM audit_answers') as $a) {
        $answers[$a['audit_id']][$a['code']] = $a['score'];
    }

    $secCols = ['sec_bar' => 'Bar Coffee Station', 'sec_call' => 'Call Order & Service Station',
                'sec_food' => 'Food & Bakery Station', 'sec_env' => 'Environment Station',
                'sec_admin' => 'Administration'];

    $headers = ['เวลาบันทึก','วันที่ตรวจ','สาขา','MOD','AM','ผู้ตรวจ','คะแนนรวม','Grade'];
    foreach ($secCols as $label) $headers[] = $label;
    $headers[] = 'หมายเหตุ';
    foreach ($CRITERIA as $q) $headers[] = $q['code'];

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="QSC_Audit_History_' . date('Y-m-d') . '.csv"');

    $out = fopen('php://output', 'w');
    echo "\xEF\xBB\xBF"; // BOM ให้ Excel อ่านภาษาไทยถูก
    fputcsv($out, $headers);

    foreach ($rows as $r) {
        $line = [
            $r['created_at'], $r['audit_date'], $r['branch'], $r['mod_name'],
            $r['am_name'], $r['auditor'], $r['total'], $r['grade'],
        ];
        foreach (array_keys($secCols) as $col) $line[] = $r[$col];
        $line[] = $r['note'];
        foreach ($CRITERIA as $q) $line[] = $answers[$r['id']][$q['code']] ?? '';
        fputcsv($out, $line);
    }
    fclose($out);
}
