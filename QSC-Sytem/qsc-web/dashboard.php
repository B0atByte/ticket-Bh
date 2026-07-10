<?php
require_once __DIR__ . '/auth.php';
require_login_page();
require_once __DIR__ . '/criteria.php';
$user = current_user();
$pdo  = db();

// ---- ตัวกรอง ----
$where = []; $params = [];
$fBranch = trim($_GET['branch'] ?? '');
$fFrom   = trim($_GET['from'] ?? '');
$fTo     = trim($_GET['to'] ?? '');
if ($fBranch !== '') { $where[] = 'branch LIKE ?';   $params[] = '%' . $fBranch . '%'; }
if ($fFrom   !== '') { $where[] = 'audit_date >= ?'; $params[] = $fFrom; }
if ($fTo     !== '') { $where[] = 'audit_date <= ?'; $params[] = $fTo; }
$W  = $where ? (' WHERE ' . implode(' AND ', $where)) : '';
$qs = http_build_query(array_filter(['branch'=>$fBranch,'from'=>$fFrom,'to'=>$fTo], fn($v)=>$v!==''));

function dq(PDO $pdo, string $sql, array $p) { $s = $pdo->prepare($sql); $s->execute($p); return $s; }

$ov = dq($pdo, "SELECT COUNT(*) cnt, ROUND(AVG(total),1) avg_total,
                       COUNT(DISTINCT branch) branches, SUM(total>=85) pass_cnt
                FROM audits$W", $params)->fetch();
$cnt   = (int)($ov['cnt'] ?? 0);
$avg   = $ov['avg_total'] !== null ? $ov['avg_total'] : '–';
$brCnt = (int)($ov['branches'] ?? 0);
$pass  = $cnt ? round(($ov['pass_cnt'] / $cnt) * 100) : 0;

$branches = dq($pdo, "SELECT branch, COUNT(*) cnt, ROUND(AVG(total),1) avg_total, MAX(audit_date) last_date
                      FROM audits$W GROUP BY branch ORDER BY avg_total DESC", $params)->fetchAll();

$gradesRaw = dq($pdo, "SELECT grade, COUNT(*) c FROM audits$W GROUP BY grade", $params)->fetchAll();
$grades = ['Excellent'=>0,'Good'=>0,'Fair'=>0,'Poor'=>0];
foreach ($gradesRaw as $r) $grades[$r['grade']] = (int)$r['c'];

$trend = array_reverse(
    dq($pdo, "SELECT branch, audit_date, total FROM audits$W ORDER BY id DESC LIMIT 15", $params)->fetchAll()
);

$history = dq($pdo, "SELECT id, audit_date, branch, mod_name, auditor, total, grade
                     FROM audits$W ORDER BY id DESC LIMIT 100", $params)->fetchAll();

$allBranches = $pdo->query("SELECT DISTINCT branch FROM audits ORDER BY branch")->fetchAll(PDO::FETCH_COLUMN);

function badgeCls(string $g): string {
    return [
        'Excellent'=>'bg-brand-100 text-brand-700',
        'Good'=>'bg-lime-100 text-lime-700',
        'Fair'=>'bg-amber-100 text-amber-700',
        'Poor'=>'bg-red-100 text-red-600',
    ][$g] ?? 'bg-slate-100 text-slate-600';
}
function h($s){ return htmlspecialchars((string)$s); }

$PAGE_TITLE  = 'Dashboard — WaTerFruit QSC';
$BODY_CLASS  = 'bg-slate-50 text-slate-800 font-sans antialiased pb-10';
$NEED_CHARTS = true;
require __DIR__ . '/partials/head.php';
$ACTIVE = 'dashboard';
require __DIR__ . '/partials/topbar.php';
require __DIR__ . '/partials/report_button.php';
?>

<main class="mx-auto max-w-3xl px-4 py-5 space-y-4">

  <!-- ตัวกรอง -->
  <form method="get" class="rounded-2xl bg-white shadow-soft border border-slate-100 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
    <label class="block col-span-2 sm:col-span-1">
      <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5"><i data-lucide="store" class="w-3.5 h-3.5"></i>สาขา</span>
      <input name="branch" list="brList" value="<?= h($fBranch) ?>" placeholder="ทุกสาขา"
        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
      <datalist id="brList"><?php foreach($allBranches as $b): ?><option value="<?= h($b) ?>"></option><?php endforeach; ?></datalist>
    </label>
    <label class="block">
      <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5"><i data-lucide="calendar" class="w-3.5 h-3.5"></i>ตั้งแต่</span>
      <input name="from" type="date" value="<?= h($fFrom) ?>" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
    </label>
    <label class="block">
      <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5"><i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>ถึง</span>
      <input name="to" type="date" value="<?= h($fTo) ?>" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25">
    </label>
    <div class="flex gap-2 col-span-2 sm:col-span-1">
      <button type="submit" class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 transition">
        <i data-lucide="filter" class="w-4 h-4"></i> กรอง
      </button>
      <a href="dashboard.php" aria-label="ล้างตัวกรอง" class="inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-2 transition">
        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
      </a>
    </div>
  </form>

  <!-- การ์ดสรุปตัวเลข -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <?php
      $stats = [
        ['clipboard-list','bg-brand-50 text-brand-600', $cnt,        'ครั้งที่ตรวจ'],
        ['gauge',         'bg-sky-50 text-sky-600',     $avg,        'คะแนนเฉลี่ย /100'],
        ['store',         'bg-violet-50 text-violet-600',$brCnt,     'จำนวนสาขา'],
        ['circle-check-big','bg-accent-50 text-accent-500', $pass.'%','อัตราผ่าน (≥85)'],
      ];
      foreach ($stats as [$icon,$tone,$num,$label]):
    ?>
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4">
      <span class="grid place-items-center w-10 h-10 rounded-xl <?= $tone ?> mb-3"><i data-lucide="<?= $icon ?>" class="w-5 h-5"></i></span>
      <div class="font-num font-extrabold text-2xl text-slate-800 tnum leading-none"><?= h($num) ?></div>
      <div class="text-xs text-slate-400 mt-1"><?= $label ?></div>
    </div>
    <?php endforeach; ?>
  </div>

  <?php if ($cnt === 0): ?>
    <div class="rounded-2xl bg-white shadow-soft border border-slate-100 p-10 text-center">
      <span class="grid place-items-center w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 mx-auto mb-3"><i data-lucide="inbox" class="w-7 h-7"></i></span>
      <p class="text-slate-500 text-sm">ยังไม่มีข้อมูลผลตรวจตามเงื่อนไข</p>
      <a href="index.php" class="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-brand-600 text-white text-sm font-semibold px-4 py-2.5"><i data-lucide="plus" class="w-4 h-4"></i> เริ่มบันทึกผลตรวจ</a>
    </div>
  <?php else: ?>

  <!-- กราฟแนวโน้ม -->
  <section class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
    <div class="flex items-center gap-2 mb-4">
      <i data-lucide="trending-up" class="w-5 h-5 text-brand-600"></i>
      <h2 class="font-semibold text-slate-800">แนวโน้มคะแนน</h2>
      <span class="text-xs text-slate-400">(<?= count($trend) ?> ครั้งล่าสุด)</span>
    </div>
    <div class="h-56"><canvas id="trendChart"></canvas></div>
  </section>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- เปรียบเทียบรายสาขา -->
    <section class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="bar-chart-3" class="w-5 h-5 text-brand-600"></i>
        <h2 class="font-semibold text-slate-800">คะแนนเฉลี่ยรายสาขา</h2>
      </div>
      <div style="height: <?= max(120, count($branches)*42) ?>px"><canvas id="branchChart"></canvas></div>
    </section>

    <!-- การกระจายเกรด -->
    <section class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="pie-chart" class="w-5 h-5 text-brand-600"></i>
        <h2 class="font-semibold text-slate-800">การกระจายเกรด</h2>
      </div>
      <div class="h-56 flex items-center justify-center"><canvas id="gradeChart"></canvas></div>
    </section>
  </div>

  <!-- ประวัติผลตรวจ -->
  <section class="rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden">
    <div class="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-50">
      <div class="flex items-center gap-2">
        <i data-lucide="history" class="w-5 h-5 text-brand-600"></i>
        <h2 class="font-semibold text-slate-800">ประวัติผลตรวจ</h2>
        <span class="text-xs text-slate-400 tnum">(<?= count($history) ?>)</span>
      </div>
      <a href="api.php?action=export<?= $qs ? '&'.h($qs) : '' ?>"
         class="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-sm font-semibold px-3 py-2 transition">
        <i data-lucide="download" class="w-4 h-4"></i> CSV
      </a>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50/60">
            <th class="px-4 py-2.5 font-medium">วันที่</th>
            <th class="px-4 py-2.5 font-medium">สาขา</th>
            <th class="px-4 py-2.5 font-medium hidden sm:table-cell">ผู้ตรวจ</th>
            <th class="px-4 py-2.5 font-medium text-right">คะแนน</th>
            <th class="px-4 py-2.5 font-medium text-center">เกรด</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <?php foreach ($history as $a): ?>
          <tr class="hover:bg-slate-50/60" id="row-<?= (int)$a['id'] ?>">
            <td class="px-4 py-3 text-slate-500 font-num tnum whitespace-nowrap"><?= h(date('d/m/y', strtotime($a['audit_date']))) ?></td>
            <td class="px-4 py-3">
              <div class="font-medium text-slate-700"><?= h($a['branch']) ?></div>
              <div class="text-[11px] text-slate-400 sm:hidden"><?= h($a['auditor']) ?></div>
            </td>
            <td class="px-4 py-3 text-slate-500 hidden sm:table-cell"><?= h($a['auditor']) ?></td>
            <td class="px-4 py-3 text-right font-num font-bold text-slate-700 tnum"><?= (int)$a['total'] ?><span class="text-slate-300 font-medium">/100</span></td>
            <td class="px-4 py-3 text-center">
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold <?= badgeCls($a['grade']) ?>"><?= h($a['grade']) ?></span>
            </td>
            <td class="px-4 py-3 text-right">
              <button onclick="delAudit(<?= (int)$a['id'] ?>)" aria-label="ลบรายการ"
                class="inline-grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>
  <?php endif; ?>
</main>

<div id="toast" class="toast fixed left-1/2 -translate-x-1/2 bottom-6 z-50 max-w-[92%] opacity-0 translate-y-2 pointer-events-none">
  <div class="flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lift">
    <i data-lucide="info" class="w-4 h-4 text-brand-400 shrink-0"></i><span id="toastMsg"></span>
  </div>
</div>

<script>
const TREND  = <?= json_encode(array_map(fn($t)=>['label'=>date('d/m',strtotime($t['audit_date'])),'total'=>(int)$t['total']], $trend), JSON_UNESCAPED_UNICODE) ?>;
const BR     = <?= json_encode(array_map(fn($b)=>['branch'=>$b['branch'],'avg'=>(float)$b['avg_total']], $branches), JSON_UNESCAPED_UNICODE) ?>;
const GRADES = <?= json_encode($grades, JSON_UNESCAPED_UNICODE) ?>;

const FONT = '"IBM Plex Sans Thai", Inter, sans-serif';
const C = { brand:'#16a34a', brand4:'#4ade80', lime:'#65a30d', amber:'#f59e0b', red:'#ef4444', grid:'#eef2f6', text:'#64748b' };
if (window.Chart) { Chart.defaults.font.family = FONT; Chart.defaults.color = C.text; }

function gradeColor(v){ return v>=95?C.brand : v>=85?C.lime : v>=75?C.amber : C.red; }

if (TREND.length) {
  new Chart(document.getElementById('trendChart'), {
    type:'line',
    data:{ labels:TREND.map(t=>t.label), datasets:[{
      data:TREND.map(t=>t.total), borderColor:C.brand, borderWidth:2.5,
      pointBackgroundColor:'#fff', pointBorderColor:C.brand, pointBorderWidth:2, pointRadius:4, pointHoverRadius:6,
      tension:.35, fill:true,
      backgroundColor:(ctx)=>{ const {ctx:c,chartArea}=ctx.chart; if(!chartArea) return 'rgba(22,163,74,.08)';
        const g=c.createLinearGradient(0,chartArea.top,0,chartArea.bottom); g.addColorStop(0,'rgba(22,163,74,.18)'); g.addColorStop(1,'rgba(22,163,74,0)'); return g; }
    }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ y:{ min:0, max:100, grid:{color:C.grid, drawBorder:false}, ticks:{stepSize:25} },
               x:{ grid:{display:false} } } }
  });
}

if (BR.length) {
  new Chart(document.getElementById('branchChart'), {
    type:'bar',
    data:{ labels:BR.map(b=>b.branch), datasets:[{
      data:BR.map(b=>b.avg), backgroundColor:BR.map(b=>gradeColor(b.avg)),
      borderRadius:8, barThickness:20, maxBarThickness:24
    }]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ x:{ min:0, max:100, grid:{color:C.grid, drawBorder:false} },
               y:{ grid:{display:false} } } }
  });
}

const gv = [GRADES.Excellent, GRADES.Good, GRADES.Fair, GRADES.Poor];
if (gv.some(v=>v>0)) {
  new Chart(document.getElementById('gradeChart'), {
    type:'doughnut',
    data:{ labels:['Excellent','Good','Fair','Poor'],
      datasets:[{ data:gv, backgroundColor:[C.brand,C.lime,C.amber,C.red], borderWidth:0, hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ position:'bottom', labels:{ usePointStyle:true, pointStyle:'circle', padding:14, boxWidth:8 } } } }
  });
}

async function delAudit(id){
  if(!confirm('ลบผลตรวจรายการนี้หรือไม่?')) return;
  try{
    const res=await fetch('api.php?action=delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    if(res.status===401){ location.href='login.php'; return; }
    const d=await res.json();
    if(!d.ok){ toast(d.error||'ลบไม่สำเร็จ'); return; }
    const row=document.getElementById('row-'+id); if(row){ row.style.transition='opacity .2s'; row.style.opacity='0'; setTimeout(()=>location.reload(),250); }
  }catch(e){ toast('ลบไม่สำเร็จ'); }
}

let tt;
function toast(msg){ document.getElementById('toastMsg').textContent=msg;
  const w=document.getElementById('toast'); w.classList.remove('opacity-0','translate-y-2');
  clearTimeout(tt); tt=setTimeout(()=>w.classList.add('opacity-0','translate-y-2'),2600); }

document.addEventListener('click', e=>{ const m=document.getElementById('userMenu');
  if(m && !m.classList.contains('hidden') && !e.target.closest('.relative')) m.classList.add('hidden'); });

lucide.createIcons();
</script>
</body>
</html>
