<?php
require_once __DIR__ . '/auth.php';
require_admin_page();
require_once __DIR__ . '/criteria.php';   // ได้ $SECTION_ORDER, $SECTION_MAX
$user = current_user();
$pdo  = db();

// ---- ข้อมูลผู้ใช้ ----
$users = $pdo->query("SELECT id, username, full_name, role, created_at FROM users ORDER BY (role='admin') DESC, id")->fetchAll();

// ---- หัวข้อประเมิน (พร้อม id สำหรับแก้ไข/ลบ) ----
$topics = $pdo->query("SELECT id, code, section, title, note, max FROM criteria ORDER BY " . qsc_section_order_sql($SECTION_ORDER) . ", sort_order, id")->fetchAll();
$bySection = [];
foreach ($topics as $t) $bySection[$t['section']][] = $t;

// ---- log ----
$logs = $pdo->query('SELECT user_id, username, action, detail, created_at FROM activity_log ORDER BY id DESC LIMIT 200')->fetchAll();

function roleBadge(string $r): string {
    return $r === 'admin'
        ? '<span class="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 px-2 py-0.5 text-[11px] font-semibold"><i data-lucide="shield-check" class="w-3 h-3"></i>ผู้ดูแลระบบ</span>'
        : '<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-semibold"><i data-lucide="clipboard-check" class="w-3 h-3"></i>ผู้ประเมิน</span>';
}
function actionMeta(string $a): array {
    $m = [
        'login'        => ['เข้าสู่ระบบ','log-in','text-brand-600'],
        'login_failed' => ['ล็อกอินล้มเหลว','shield-alert','text-red-500'],
        'logout'       => ['ออกจากระบบ','log-out','text-slate-400'],
        'create_audit' => ['บันทึกผลตรวจ','clipboard-check','text-brand-600'],
        'delete_audit' => ['ลบผลตรวจ','trash-2','text-red-500'],
        'clear_audits' => ['ล้างผลตรวจ','trash','text-red-500'],
        'user_create'  => ['สร้างผู้ใช้','user-plus','text-sky-600'],
        'user_delete'  => ['ลบผู้ใช้','user-minus','text-red-500'],
        'topic_create' => ['เพิ่มหัวข้อ','plus-circle','text-sky-600'],
        'topic_update' => ['แก้ไขหัวข้อ','pencil','text-amber-600'],
        'topic_delete' => ['ลบหัวข้อ','trash-2','text-red-500'],
        'log_clear'    => ['ล้าง log','eraser','text-slate-400'],
    ];
    return $m[$a] ?? [$a,'dot','text-slate-400'];
}
function h($s){ return htmlspecialchars((string)$s); }

$PAGE_TITLE = 'จัดการระบบ — WaTerFruit QSC';
$BODY_CLASS = 'bg-slate-50 text-slate-800 font-sans antialiased pb-10';
require __DIR__ . '/partials/head.php';
$ACTIVE = 'admin';
require __DIR__ . '/partials/topbar.php';
?>

<main class="mx-auto max-w-3xl px-4 py-5 space-y-4">
  <div class="flex items-center gap-2">
    <i data-lucide="settings" class="w-5 h-5 text-brand-600"></i>
    <h1 class="text-lg font-bold text-slate-800">จัดการระบบ</h1>
  </div>

  <!-- แท็บ -->
  <div class="flex items-center gap-1 bg-white rounded-2xl shadow-soft border border-slate-100 p-1">
    <button onclick="tab('users')" id="tab-users" class="tabbtn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition">
      <i data-lucide="users" class="w-4 h-4"></i><span class="hidden xs:inline">ผู้ใช้</span>
    </button>
    <button onclick="tab('topics')" id="tab-topics" class="tabbtn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition">
      <i data-lucide="list-checks" class="w-4 h-4"></i><span class="hidden xs:inline">หัวข้อประเมิน</span>
    </button>
    <button onclick="tab('logs')" id="tab-logs" class="tabbtn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition">
      <i data-lucide="scroll-text" class="w-4 h-4"></i><span class="hidden xs:inline">บันทึกใช้งาน</span>
    </button>
  </div>

  <!-- ============ ผู้ใช้ ============ -->
  <section id="panel-users" class="space-y-4">
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
      <div class="flex items-center gap-2 mb-4"><i data-lucide="user-plus" class="w-5 h-5 text-brand-600"></i><h2 class="font-semibold text-slate-800">เพิ่มผู้ใช้ใหม่</h2></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">ชื่อผู้ใช้ (username) <span class="text-red-500">*</span></span>
          <input id="u_username" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">ชื่อ-สกุล</span>
          <input id="u_fullname" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">รหัสผ่าน <span class="text-red-500">*</span></span>
          <input id="u_password" type="text" placeholder="อย่างน้อย 4 ตัว" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">บทบาท (role)</span>
          <select id="u_role" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
            <option value="evaluator">ผู้ประเมิน</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select></label>
      </div>
      <button onclick="createUser()" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 transition">
        <i data-lucide="plus" class="w-4 h-4"></i> เพิ่มผู้ใช้
      </button>
    </div>

    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden">
      <div class="p-4 border-b border-slate-50 flex items-center gap-2"><i data-lucide="users" class="w-5 h-5 text-brand-600"></i><h2 class="font-semibold text-slate-800">รายชื่อผู้ใช้</h2><span class="text-xs text-slate-400 tnum">(<?= count($users) ?>)</span></div>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50/60">
          <th class="px-4 py-2.5 font-medium">ผู้ใช้</th><th class="px-4 py-2.5 font-medium">บทบาท</th><th class="px-4 py-2.5 font-medium hidden sm:table-cell">สร้างเมื่อ</th><th class="px-4 py-2.5"></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">
          <?php foreach ($users as $u): ?>
          <tr id="urow-<?= (int)$u['id'] ?>" class="hover:bg-slate-50/60">
            <td class="px-4 py-3"><div class="font-medium text-slate-700"><?= h($u['username']) ?></div><div class="text-[11px] text-slate-400"><?= h($u['full_name']) ?></div></td>
            <td class="px-4 py-3"><?= roleBadge($u['role']) ?></td>
            <td class="px-4 py-3 text-slate-500 font-num tnum hidden sm:table-cell"><?= h(date('d/m/y', strtotime($u['created_at']))) ?></td>
            <td class="px-4 py-3 text-right">
              <?php if ((int)$u['id'] !== (int)$user['id']): ?>
                <button onclick="delUser(<?= (int)$u['id'] ?>)" aria-label="ลบผู้ใช้" class="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
              <?php else: ?><span class="text-[11px] text-slate-300">บัญชีคุณ</span><?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table></div>
    </div>
  </section>

  <!-- ============ หัวข้อประเมิน ============ -->
  <section id="panel-topics" class="space-y-4 hidden">
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
      <div class="flex items-center gap-2 mb-4"><i data-lucide="plus-circle" class="w-5 h-5 text-brand-600"></i><h2 class="font-semibold text-slate-800">เพิ่มหัวข้อประเมิน</h2></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label class="block col-span-2"><span class="text-xs font-medium text-slate-500 mb-1.5 block">หมวด <span class="text-red-500">*</span></span>
          <select id="t_section" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
            <?php foreach ($SECTION_ORDER as $s): ?><option value="<?= h($s) ?>"><?= h($s) ?></option><?php endforeach; ?>
          </select></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">รหัส <span class="text-red-500">*</span></span>
          <input id="t_code" placeholder="เช่น Q38" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">คะแนนเต็ม <span class="text-red-500">*</span></span>
          <input id="t_max" type="number" min="1" value="2" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block col-span-2 sm:col-span-4"><span class="text-xs font-medium text-slate-500 mb-1.5 block">หัวข้อ/เกณฑ์ <span class="text-red-500">*</span></span>
          <textarea id="t_title" rows="2" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 resize-y"></textarea></label>
        <label class="block col-span-2 sm:col-span-4"><span class="text-xs font-medium text-slate-500 mb-1.5 block">แนวทางตรวจ (ไม่บังคับ)</span>
          <input id="t_note" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
      </div>
      <button onclick="createTopic()" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 transition"><i data-lucide="plus" class="w-4 h-4"></i> เพิ่มหัวข้อ</button>
    </div>

    <?php foreach ($SECTION_ORDER as $sec): $items = $bySection[$sec] ?? []; $smax = array_sum(array_map(fn($x)=>(int)$x['max'], $items)); ?>
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden">
      <div class="p-4 border-b border-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0"><span class="font-semibold text-slate-800 truncate"><?= h($sec) ?></span></div>
        <span class="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] font-num font-semibold text-slate-500 tnum"><?= count($items) ?> ข้อ · <?= $smax ?> คะแนน</span>
      </div>
      <div class="divide-y divide-slate-50">
        <?php foreach ($items as $t): ?>
        <div class="p-4 flex items-start gap-3" id="trow-<?= (int)$t['id'] ?>">
          <span class="shrink-0 inline-flex items-center rounded-lg bg-slate-100 text-slate-500 font-num text-[11px] font-semibold px-2 py-1 tnum"><?= h($t['code']) ?></span>
          <div class="flex-1 min-w-0">
            <p class="text-[14px] leading-relaxed text-slate-700"><?= h($t['title']) ?></p>
            <?php if ($t['note']): ?><p class="text-[11px] text-amber-600 mt-0.5"><?= h($t['note']) ?></p><?php endif; ?>
          </div>
          <span class="shrink-0 rounded-md bg-brand-50 text-brand-700 text-[11px] font-num font-bold px-2 py-1 tnum"><?= (int)$t['max'] ?></span>
          <div class="shrink-0 flex items-center gap-1">
            <button aria-label="แก้ไข" class="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
              onclick='openEditTopic(<?= json_encode(["id"=>(int)$t["id"],"code"=>$t["code"],"section"=>$t["section"],"title"=>$t["title"],"note"=>$t["note"],"max"=>(int)$t["max"]], JSON_UNESCAPED_UNICODE|JSON_HEX_APOS|JSON_HEX_QUOT) ?>)'>
              <i data-lucide="pencil" class="w-4 h-4"></i></button>
            <button aria-label="ลบ" onclick="delTopic(<?= (int)$t['id'] ?>)" class="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
        <?php endforeach; ?>
        <?php if (!$items): ?><div class="p-4 text-sm text-slate-400">ยังไม่มีหัวข้อในหมวดนี้</div><?php endif; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </section>

  <!-- ============ Log ============ -->
  <section id="panel-logs" class="space-y-4 hidden">
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden">
      <div class="p-4 border-b border-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2"><i data-lucide="scroll-text" class="w-5 h-5 text-brand-600"></i><h2 class="font-semibold text-slate-800">บันทึกการใช้งาน</h2><span class="text-xs text-slate-400 tnum">(<?= count($logs) ?> ล่าสุด)</span></div>
        <button onclick="clearLogs()" class="inline-flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold px-3 py-2 transition"><i data-lucide="eraser" class="w-4 h-4"></i> ล้าง</button>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50/60">
          <th class="px-4 py-2.5 font-medium">เวลา</th><th class="px-4 py-2.5 font-medium">ผู้ใช้</th><th class="px-4 py-2.5 font-medium">การกระทำ</th><th class="px-4 py-2.5 font-medium hidden sm:table-cell">รายละเอียด</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">
          <?php foreach ($logs as $l): [$lbl,$ic,$tone] = actionMeta($l['action']); ?>
          <tr class="hover:bg-slate-50/60">
            <td class="px-4 py-2.5 text-slate-500 font-num tnum whitespace-nowrap text-[12px]"><?= h(date('d/m/y H:i', strtotime($l['created_at']))) ?></td>
            <td class="px-4 py-2.5 text-slate-600"><?= h($l['username'] ?? '-') ?></td>
            <td class="px-4 py-2.5"><span class="inline-flex items-center gap-1.5 font-medium <?= $tone ?>"><i data-lucide="<?= $ic ?>" class="w-3.5 h-3.5"></i><?= $lbl ?></span></td>
            <td class="px-4 py-2.5 text-slate-500 hidden sm:table-cell"><?= h($l['detail']) ?></td>
          </tr>
          <?php endforeach; ?>
          <?php if (!$logs): ?><tr><td colspan="4" class="px-4 py-6 text-center text-slate-400 text-sm">ยังไม่มีบันทึกการใช้งาน</td></tr><?php endif; ?>
        </tbody>
      </table></div>
    </div>
  </section>
</main>

<!-- modal แก้ไขหัวข้อ -->
<div id="editModal" class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4">
  <div class="w-full max-w-md rounded-2xl bg-white shadow-lift border border-slate-100 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-800 flex items-center gap-2"><i data-lucide="pencil" class="w-5 h-5 text-amber-600"></i> แก้ไขหัวข้อ <span id="e_code" class="font-num text-sm text-slate-400"></span></h3>
      <button onclick="closeEdit()" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <input type="hidden" id="e_id">
    <div class="space-y-3">
      <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">หมวด</span>
        <select id="e_section" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
          <?php foreach ($SECTION_ORDER as $s): ?><option value="<?= h($s) ?>"><?= h($s) ?></option><?php endforeach; ?>
        </select></label>
      <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">หัวข้อ/เกณฑ์</span>
        <textarea id="e_title" rows="3" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 resize-y"></textarea></label>
      <div class="grid grid-cols-3 gap-3">
        <label class="block col-span-2"><span class="text-xs font-medium text-slate-500 mb-1.5 block">แนวทางตรวจ</span>
          <input id="e_note" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
        <label class="block"><span class="text-xs font-medium text-slate-500 mb-1.5 block">คะแนนเต็ม</span>
          <input id="e_max" type="number" min="1" class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"></label>
      </div>
    </div>
    <div class="flex gap-2 mt-5">
      <button onclick="closeEdit()" class="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2.5 transition">ยกเลิก</button>
      <button onclick="saveTopic()" class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 transition"><i data-lucide="save" class="w-4 h-4"></i> บันทึก</button>
    </div>
  </div>
</div>

<div id="toast" class="toast fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] max-w-[92%] opacity-0 translate-y-2 pointer-events-none">
  <div class="flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lift"><i data-lucide="info" class="w-4 h-4 text-brand-400 shrink-0"></i><span id="toastMsg"></span></div>
</div>

<script>
const TABS = ['users','topics','logs'];
const ON = 'bg-brand-600 text-white', OFF = 'text-slate-500 hover:text-slate-700';
function tab(name){
  TABS.forEach(t=>{
    document.getElementById('panel-'+t).classList.toggle('hidden', t!==name);
    const b=document.getElementById('tab-'+t);
    b.className = 'tabbtn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ' + (t===name?ON:OFF);
  });
  location.hash = name;
}

async function post(action, body){
  const res = await fetch('api.php?action='+action, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body||{})});
  if(res.status===401){ location.href='login.php'; return {ok:false}; }
  return res.json();
}
function val(id){ return document.getElementById(id).value.trim(); }

async function createUser(){
  const b={username:val('u_username'), full_name:val('u_fullname'), password:val('u_password'), role:document.getElementById('u_role').value};
  if(!b.username||!b.password){ toast('กรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
  const d=await post('user_create',b);
  if(!d.ok){ toast(d.error||'ไม่สำเร็จ'); return; }
  toast('เพิ่มผู้ใช้แล้ว'); setTimeout(()=>location.reload(),500);
}
async function delUser(id){ if(!confirm('ลบผู้ใช้นี้?')) return;
  const d=await post('user_delete',{id}); if(!d.ok){ toast(d.error||'ลบไม่สำเร็จ'); return; }
  document.getElementById('urow-'+id)?.remove(); toast('ลบผู้ใช้แล้ว'); }

async function createTopic(){
  const b={section:document.getElementById('t_section').value, code:val('t_code'), title:val('t_title'), note:val('t_note'), max:+val('t_max')};
  if(!b.code||!b.title){ toast('กรอกรหัสและหัวข้อ'); return; }
  const d=await post('topic_create',b);
  if(!d.ok){ toast(d.error||'ไม่สำเร็จ'); return; }
  toast('เพิ่มหัวข้อแล้ว'); setTimeout(()=>location.reload(),500);
}
async function delTopic(id){ if(!confirm('ลบหัวข้อนี้? (ผลตรวจเก่ายังคงอยู่)')) return;
  const d=await post('topic_delete',{id}); if(!d.ok){ toast(d.error||'ลบไม่สำเร็จ'); return; }
  document.getElementById('trow-'+id)?.remove(); toast('ลบหัวข้อแล้ว'); }

function openEditTopic(t){
  document.getElementById('e_id').value=t.id;
  document.getElementById('e_code').textContent=t.code;
  document.getElementById('e_section').value=t.section;
  document.getElementById('e_title').value=t.title;
  document.getElementById('e_note').value=t.note||'';
  document.getElementById('e_max').value=t.max;
  document.getElementById('editModal').classList.remove('hidden');
}
function closeEdit(){ document.getElementById('editModal').classList.add('hidden'); }
async function saveTopic(){
  const b={id:+val('e_id'), section:document.getElementById('e_section').value, title:val('e_title'), note:val('e_note'), max:+val('e_max')};
  if(!b.title){ toast('กรอกหัวข้อ'); return; }
  const d=await post('topic_update',b);
  if(!d.ok){ toast(d.error||'ไม่สำเร็จ'); return; }
  toast('บันทึกแล้ว'); setTimeout(()=>location.reload(),500);
}

async function clearLogs(){ if(!confirm('ล้างบันทึกการใช้งานทั้งหมด?')) return;
  const d=await post('log_clear',{}); if(!d.ok){ toast(d.error||'ไม่สำเร็จ'); return; }
  toast('ล้าง log แล้ว'); setTimeout(()=>location.reload(),500); }

let tt; function toast(m){ document.getElementById('toastMsg').textContent=m;
  const w=document.getElementById('toast'); w.classList.remove('opacity-0','translate-y-2');
  clearTimeout(tt); tt=setTimeout(()=>w.classList.add('opacity-0','translate-y-2'),2600); }

document.addEventListener('click', e=>{ const m=document.getElementById('userMenu');
  if(m && !m.classList.contains('hidden') && !e.target.closest('.relative')) m.classList.add('hidden'); });

tab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'users');
lucide.createIcons();
</script>
</body>
</html>
