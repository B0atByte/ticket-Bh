<?php
// การเชื่อมต่อฐานข้อมูล SQLite (PDO) + สร้างตารางอัตโนมัติครั้งแรก
require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dir = dirname(DB_PATH);
        if (!is_dir($dir)) @mkdir($dir, 0777, true);

        $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        qsc_init_schema($pdo);
    }
    return $pdo;
}

// สร้างตารางถ้ายังไม่มี + seed บัญชี admin เริ่มต้น
function qsc_init_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_date TEXT NOT NULL,
        branch     TEXT NOT NULL,
        mod_name   TEXT NOT NULL,
        am_name    TEXT,
        auditor    TEXT NOT NULL,
        note       TEXT,
        total      INTEGER NOT NULL,
        grade      TEXT NOT NULL,
        sec_bar    INTEGER NOT NULL DEFAULT 0,
        sec_call   INTEGER NOT NULL DEFAULT 0,
        sec_food   INTEGER NOT NULL DEFAULT 0,
        sec_env    INTEGER NOT NULL DEFAULT 0,
        sec_admin  INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_audits_branch ON audits(branch)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(audit_date)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        score INTEGER NOT NULL,
        FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ans_audit ON audit_answers(audit_id)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username  TEXT NOT NULL UNIQUE,
        password  TEXT NOT NULL,
        full_name TEXT,
        role      TEXT NOT NULL DEFAULT 'evaluator',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS criteria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        section TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT,
        max INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_log_created ON activity_log(created_at)");

    // บัญชีเริ่มต้น admin / admin123
    $pdo->exec("INSERT OR IGNORE INTO users (username, password, full_name, role)
        VALUES ('admin', '\$2y\$10\$ZAIkUOdZ8iGxDBZAX0WJSOtJRAfqU7HDMRwOIlwTsKutKLU0LAioe', 'ผู้ดูแลระบบ', 'admin')");
}
