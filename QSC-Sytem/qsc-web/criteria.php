<?php
// ===========================================================
//  หัวข้อประเมิน (criteria) — เก็บใน DB เพื่อให้ admin แก้ไข/เพิ่ม/ลบได้
//  ครั้งแรกที่ตารางว่าง จะ seed อัตโนมัติจากค่าเริ่มต้นด้านล่าง
//  ตัวแปรที่ได้: $CRITERIA, $SECTION_MAX, $SECTION_ORDER, $SECTION_COLS
// ===========================================================
require_once __DIR__ . '/db.php';

// ลำดับหมวด (คงที่ 5 หมวด — ใช้คุมการเรียงและ map คอลัมน์คะแนน)
$SECTION_ORDER = [
    'Bar Coffee Station',
    'Call Order & Service Station',
    'Food & Bakery Station',
    'Environment Station',
    'Administration',
];

// ชื่อหมวด -> คอลัมน์ในตาราง audits
$SECTION_COLS = [
    'Bar Coffee Station'           => 'sec_bar',
    'Call Order & Service Station' => 'sec_call',
    'Food & Bakery Station'        => 'sec_food',
    'Environment Station'          => 'sec_env',
    'Administration'               => 'sec_admin',
];

$CRITERIA_DEFAULT = json_decode(<<<'JSON'
[
{"code":"Q01-Juice","section":"Bar Coffee Station","title":"มาตรฐานเครื่องดื่มเมนู Juice ต้องเป็นไปตามมาตรฐานตามสูตร","max":5,"note":"สุ่มเช็คเมนู"},
{"code":"Q01-Smoothie","section":"Bar Coffee Station","title":"มาตรฐานเครื่องดื่มเมนู Smoothie ต้องเป็นไปตามมาตรฐานตามสูตร","max":5,"note":"สุ่มเช็คเมนู"},
{"code":"Q01-Signature","section":"Bar Coffee Station","title":"มาตรฐานเครื่องดื่มเมนู Signature ต้องเป็นไปตามมาตรฐานตามสูตร","max":5,"note":"สุ่มเช็คเมนู"},
{"code":"Q02","section":"Bar Coffee Station","title":"ลำดับขั้นตอนและวิธีการทำเครื่องดื่มถูกต้อง","max":2,"note":""},
{"code":"Q03","section":"Bar Coffee Station","title":"มีการ Check อุปกรณ์ให้อยู่ในสภาพดี ใช้งานได้ตามปกติ ไม่เสียหาย และเพียงพอต่อการใช้งาน เช่น เครื่องปั่น หม้อต้มน้ำร้อน Digital Scale ฟิลเตอร์เครื่องกรองน้ำ และอุปกรณ์ในบาร์","max":5,"note":""},
{"code":"Q04","section":"Bar Coffee Station","title":"สินค้าและวัตถุดิบของแต่ละสถานีมีใช้อย่างเหมาะสม จัดเก็บถูกต้อง ไม่หมดอายุ ไม่มี Shot หรือ Over Stock และติดวันหมดอายุวัตถุดิบ","max":5,"note":"ตรวจสอบจากวัตถุดิบ"},
{"code":"Q05","section":"Bar Coffee Station","title":"ผ้าทุกผืนในบาร์อยู่ในสภาพใช้งานได้ ทำความสะอาดถูกต้อง ไม่มีกลิ่น ไม่แห้งหรือเปียกแฉะจนเกินไป","max":2,"note":""},
{"code":"Q06","section":"Bar Coffee Station","title":"รักษาความสะอาดพื้นที่บริเวณที่ทำงานตามหลัก Clean as you go และเคลียร์บริเวณบาร์ให้สะอาด","max":2,"note":"ตรวจสอบจากทำเครื่องดื่มเสร็จ"},
{"code":"Q07","section":"Bar Coffee Station","title":"ใช้ที่ตักน้ำแข็งในการตักน้ำแข็งเท่านั้น และที่ตัก/ช่องตักน้ำแข็งต้องสะอาด ไม่มีคราบ","max":2,"note":""},
{"code":"Q08","section":"Bar Coffee Station","title":"น้ำแข็งที่ใช้ต้องผลิตจากเครื่องทำน้ำแข็งเท่านั้น และมีเพียงพอต่อการขาย","max":2,"note":""},
{"code":"Q09","section":"Bar Coffee Station","title":"การปฏิบัติงานด้านเครื่องดื่มถูกต้องตามมาตรฐาน Food hygiene and safety (ล้างมือ สวมถุงมือทั้งสองข้าง)","max":2,"note":"สุ่มเช็คพนักงานที่เข้างานในวัน"},
{"code":"Q10","section":"Bar Coffee Station","title":"ตู้เย็น Chiller 1-5 องศา / ตู้เย็น Freezer -16 ถึง -18 องศา และสภาพตู้เย็นต้องสะอาด","max":2,"note":""},
{"code":"Q11","section":"Call Order & Service Station","title":"พนักงานบริการลูกค้าด้วยความสุภาพ ยิ้มแย้ม พร้อมให้บริการ ไม่เล่นโทรศัพท์ และปฏิบัติงานตามขั้นตอนการบริการ","max":5,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q12","section":"Call Order & Service Station","title":"พนักงานแนะนำเมนูเครื่องดื่ม Signature กับลูกค้า พร้อมแนะนำเพิ่มเติมสำหรับเมนูของหวานหรือแซนด์วิช","max":2,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q13","section":"Call Order & Service Station","title":"แจ้งลูกค้าให้ทราบจุดรับเครื่องดื่ม และขั้นตอนการตรวจสอบรายการเมนู","max":2,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q14","section":"Call Order & Service Station","title":"ขณะเรียกรับออเดอร์ มีการขอบคุณลูกค้าทุกครั้ง","max":2,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q15","section":"Call Order & Service Station","title":"พื้นที่บริเวณ POS, EDC และเครื่อง Grab ใช้งานได้ดี สะอาด เป็นระเบียบเรียบร้อย ไม่รก มีฝุ่นหรือเศษขยะ","max":2,"note":""},
{"code":"Q16","section":"Call Order & Service Station","title":"พนักงานทุกคนแต่งกายถูกต้องตามแบบฟอร์มมาตรฐานที่กำหนด สะอาด เรียบร้อย (เสื้อ ผ้า หน้า ผม)","max":2,"note":""},
{"code":"Q17","section":"Call Order & Service Station","title":"ทุก 10 นาที หรือทุกครั้งที่ว่าง สำหรับการ on floor ตรวจเช็คความเรียบร้อยภายนอก และสร้างปฏิสัมพันธ์ที่ดีกับลูกค้า","max":2,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q18","section":"Call Order & Service Station","title":"พนักงานทุกคนในร้านต้องสวมผ้ากันเปื้อนในขณะทำงาน","max":2,"note":""},
{"code":"Q19","section":"Food & Bakery Station","title":"จัดเตรียมเมนูอาหารตาม SOP ทุกขั้นตอน และรูปลักษณ์สวยงามตามมาตรฐานที่กำหนดไว้","max":5,"note":""},
{"code":"Q20","section":"Food & Bakery Station","title":"การปฏิบัติงานด้านอาหารถูกต้องตามมาตรฐาน Food hygiene and safety (ล้างมือ สวมถุงมือทั้งสองข้าง)","max":5,"note":""},
{"code":"Q21","section":"Food & Bakery Station","title":"รายการอาหารต้องเสิร์ฟภายใน 10-15 นาที (กรณี Order มากต้องแจ้งเวลารอให้ลูกค้า)","max":5,"note":"สุ่มเช็คจากการบริการลูกค้า"},
{"code":"Q22","section":"Food & Bakery Station","title":"อุปกรณ์ทุกอย่างในครัวต้องสะอาด ไม่ชำรุด และอยู่ในสภาพพร้อมใช้งาน","max":2,"note":""},
{"code":"Q23","section":"Food & Bakery Station","title":"วัตถุดิบต้องมีวันหมดอายุชัดเจนและไม่พบวัตถุดิบหมดอายุ (กรณีผักผลไม้ตรวจสอบว่าไม่เหี่ยวและแห้ง)","max":2,"note":"ตรวจสอบจากวัตถุดิบ"},
{"code":"Q24","section":"Food & Bakery Station","title":"วัตถุดิบทุกอย่างต้องมีใช้อย่างเหมาะสม ไม่ขาด Stock และไม่ Over stock","max":2,"note":"ตรวจสอบจากวัตถุดิบ"},
{"code":"Q25","section":"Food & Bakery Station","title":"เครื่องใช้ไฟฟ้าทุกประเภทต้องสะอาด และสภาพการใช้งานครบสมบูรณ์","max":2,"note":""},
{"code":"Q26","section":"Food & Bakery Station","title":"ตู้เย็น Chiller 1-5 องศา / ตู้เย็น Freezer -16 ถึง -18 องศา และสภาพตู้เย็นต้องสะอาด","max":2,"note":""},
{"code":"Q27","section":"Food & Bakery Station","title":"รักษาความสะอาดพื้นที่บริเวณที่ทำงานตามหลัก Clean as you go และเคลียร์บริเวณบาร์ให้สะอาด","max":2,"note":""},
{"code":"Q28","section":"Environment Station","title":"ป้ายสื่อเมนู จอ TV สื่อเมนูหน้า POS และป้ายตั้งหน้าร้าน ติดครบ อยู่ในสภาพสวยงาม ไม่มีฝุ่น ภาพสีไม่ซีดจาง และป้ายสมบูรณ์","max":2,"note":""},
{"code":"Q29","section":"Environment Station","title":"ตู้เฟอร์นิเจอร์เก็บของ ฟิลเตอร์ตู้เย็น ผนัง กระจก พัดลม และซิงค์ล้างจาน รวมถึงพื้นภายใน-ภายนอกและถังขยะ สะอาด ไม่มีคราบสกปรกและพร้อมใช้งาน","max":2,"note":""},
{"code":"Q30","section":"Environment Station","title":"ห้องสต็อกและชั้นเก็บสต็อกจัดเก็บของเรียบร้อย สะอาด และโซนกินข้าวของพนักงานจัดเรียงเป็นระเบียบ","max":2,"note":""},
{"code":"Q31","section":"Environment Station","title":"บริเวณเคาน์เตอร์การขายและสถานีการทำอาหาร/เครื่องดื่มสะอาด ไม่มีของส่วนตัวพนักงานวางปะปน และจัดเก็บเป็นระเบียบ","max":2,"note":""},
{"code":"Q32","section":"Environment Station","title":"ตู้โชว์สินค้าและชั้นวางสินค้าสะอาด จัดวางสินค้าเป็นระเบียบ โชว์ป้ายสินค้าชัดเจน และมีจำนวนเหมาะสม","max":2,"note":""},
{"code":"Q33","section":"Environment Station","title":"บ่อลักไขมันสะอาด ไม่มีกลิ่นเหม็น และต้องตักทุกวัน","max":1,"note":""},
{"code":"Q34","section":"Administration","title":"คู่มือปฏิบัติงานของฝ่ายปฏิบัติการ / SOP อัปเดตให้เป็นปัจจุบัน","max":1,"note":""},
{"code":"Q35","section":"Administration","title":"เอกสารรับในระบบ HQ / เอกสารรับตรง รับเข้าระบบให้เรียบร้อยและตรวจสอบจาก ณ วันปัจจุบัน","max":1,"note":""},
{"code":"Q36","section":"Administration","title":"เอกสาร Petty Cash: กรณีค้างเบิกต้องมีให้ตรวจสอบ และกรณีเบิกต้องมีหลักฐานในการเบิก","max":1,"note":""},
{"code":"Q37","section":"Administration","title":"Nimbly ต้องทำให้ครบถ้วน 100% ในระบบ ดูย้อนหลัง 1 เดือน","max":1,"note":""}
]
JSON, true);

// seed ครั้งแรกถ้าตารางว่าง
function qsc_seed_criteria(array $default, array $order): void
{
    $pdo = db();
    if ((int)$pdo->query('SELECT COUNT(*) FROM criteria')->fetchColumn() > 0) return;
    $ins = $pdo->prepare('INSERT INTO criteria (code, section, title, note, max, sort_order) VALUES (?,?,?,?,?,?)');
    $i = 0;
    foreach ($default as $q) {
        $ins->execute([$q['code'], $q['section'], $q['title'], $q['note'] ?? '', (int)$q['max'], $i++]);
    }
}

// สร้าง CASE สำหรับเรียงตามลำดับหมวด (ใช้แทน FIELD() ของ MySQL — รองรับ SQLite)
function qsc_section_order_sql(array $order, string $col = 'section'): string
{
    if (!$order) return '0';
    $cases = '';
    foreach (array_values($order) as $i => $s) {
        $cases .= ' WHEN ' . db()->quote($s) . " THEN $i";
    }
    return "CASE $col$cases ELSE 999 END";
}

// โหลดหัวข้อจาก DB เรียงตามหมวดและลำดับ
function qsc_load_criteria(array $order): array
{
    $sql = 'SELECT code, section, title, note, max FROM criteria ORDER BY '
         . qsc_section_order_sql($order) . ', sort_order, id';
    $rows = db()->query($sql)->fetchAll();
    return array_map(fn($r) => [
        'code'    => $r['code'],
        'section' => $r['section'],
        'title'   => $r['title'],
        'note'    => $r['note'] ?? '',
        'max'     => (int)$r['max'],
    ], $rows);
}

qsc_seed_criteria($CRITERIA_DEFAULT, $SECTION_ORDER);
$CRITERIA = qsc_load_criteria($SECTION_ORDER);

// คะแนนเต็มแต่ละหมวด (คำนวณจากหัวข้อจริงใน DB)
$SECTION_MAX = [];
foreach ($CRITERIA as $q) {
    $SECTION_MAX[$q['section']] = ($SECTION_MAX[$q['section']] ?? 0) + (int)$q['max'];
}

function qsc_grade(int $score): array
{
    if ($score >= 95) return ['Excellent', 'excellent'];
    if ($score >= 85) return ['Good', 'good'];
    if ($score >= 75) return ['Fair', 'fair'];
    return ['Poor', 'poor'];
}
