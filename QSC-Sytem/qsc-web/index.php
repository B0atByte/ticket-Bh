<?php
require_once __DIR__ . '/auth.php';
require_login_page();
require_once __DIR__ . '/criteria.php';
$user = current_user();

$PAGE_TITLE = 'ฟอร์มตรวจ — WaTerFruit QSC';
$BODY_CLASS = 'bg-slate-50 text-slate-800 font-sans antialiased pb-28';
require __DIR__ . '/partials/head.php';
$ACTIVE = 'form';
require __DIR__ . '/partials/topbar.php';
$REPORT_BUTTON_HIDE_TRIGGER = true; // ปุ่มลอยจะถูกฝังไว้ในแถบ progress+บันทึกด้านล่างแทน (กัน overlap)
require __DIR__ . '/partials/report_button.php';
?>

<main class="mx-auto max-w-3xl px-4 py-5 space-y-4">

  <!-- คำแนะนำการให้คะแนน -->
  <div class="rounded-2xl bg-brand-50/70 border border-brand-100 p-4 flex gap-3">
    <span class="grid place-items-center w-9 h-9 rounded-xl bg-white text-brand-600 shrink-0 shadow-soft">
      <i data-lucide="info" class="w-5 h-5" aria-hidden="true"></i>
    </span>
    <p class="text-[13px] leading-relaxed text-slate-600">
      เลือก <span class="font-semibold text-brand-700">ผ่าน</span> เมื่อทำได้ครบตามเกณฑ์ เพื่อรับคะแนนเต็มของข้อนั้น
      และเลือก <span class="font-semibold text-red-600">ไม่ผ่าน</span> เมื่อไม่ผ่านเกณฑ์ (ได้ 0 คะแนน) — รวมทั้งหมด 100 คะแนน
    </p>
  </div>

  <!-- ข้อมูลการตรวจ -->
  <section class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4 sm:p-5">
    <div class="flex items-center gap-2 mb-4">
      <i data-lucide="file-pen-line" class="w-5 h-5 text-brand-600" aria-hidden="true"></i>
      <h2 class="font-semibold text-slate-800">ข้อมูลการตรวจ</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <?php
        $fields = [
          ['auditDate','วันที่ตรวจ','calendar',true,'date',''],
          ['branch','สาขา / Branch','store',true,'text','พิมพ์ชื่อสาขา'],
          ['modName','MOD','user-check',true,'text','ชื่อ MOD'],
          ['amName','AM','users',false,'text','ชื่อ AM'],
          ['auditor','ผู้ตรวจ / Trainer','clipboard-check',true,'text','ชื่อผู้ตรวจ'],
        ];
        foreach ($fields as [$id,$label,$icon,$req,$type,$ph]):
      ?>
      <label class="block">
        <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
          <i data-lucide="<?= $icon ?>" class="w-3.5 h-3.5" aria-hidden="true"></i><?= $label ?>
          <?php if ($req): ?><span class="text-red-500">*</span><?php endif; ?>
        </span>
        <input id="<?= $id ?>" type="<?= $type ?>" <?= $ph ? 'placeholder="'.$ph.'"' : '' ?>
          class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">
      </label>
      <?php endforeach; ?>
      <label class="block sm:col-span-2">
        <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
          <i data-lucide="message-square-text" class="w-3.5 h-3.5" aria-hidden="true"></i>หมายเหตุทั่วไป
        </span>
        <textarea id="generalNote" rows="3" placeholder="จุดที่ต้องแก้ไข หรือแผนติดตาม"
          class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition resize-y"></textarea>
      </label>
    </div>
  </section>

  <!-- หมวดคำถาม (accordion) -->
  <div id="sections" class="space-y-3"></div>

  <!-- เกณฑ์ระดับคะแนน -->
  <section class="rounded-2xl bg-white shadow-soft border border-slate-100 p-4">
    <div class="flex items-center gap-2 mb-3">
      <i data-lucide="award" class="w-4 h-4 text-slate-400" aria-hidden="true"></i>
      <h3 class="text-sm font-semibold text-slate-600">เกณฑ์ระดับคะแนน</h3>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="rounded-xl bg-red-50 px-3 py-2"><div class="text-xs font-semibold text-red-600">Poor</div><div class="text-[11px] text-slate-500 tnum">ต่ำกว่า 75</div></div>
      <div class="rounded-xl bg-amber-50 px-3 py-2"><div class="text-xs font-semibold text-amber-600">Fair</div><div class="text-[11px] text-slate-500 tnum">75 – 84</div></div>
      <div class="rounded-xl bg-lime-50 px-3 py-2"><div class="text-xs font-semibold text-lime-700">Good</div><div class="text-[11px] text-slate-500 tnum">85 – 94</div></div>
      <div class="rounded-xl bg-brand-50 px-3 py-2"><div class="text-xs font-semibold text-brand-700">Excellent</div><div class="text-[11px] text-slate-500 tnum">95 – 100</div></div>
    </div>
  </section>
</main>

<!-- แถบล่างคงที่: progress + คะแนนรวม + บันทึก -->
<div class="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100"
     style="padding-bottom: env(safe-area-inset-bottom)">
  <div class="mx-auto max-w-3xl px-4 py-2.5 flex items-center gap-3">
    <button type="button" onclick="document.getElementById('reportIssueModal').classList.remove('hidden')"
      class="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
      aria-label="แจ้งปัญหา">
      <i data-lucide="bug" class="w-4 h-4" aria-hidden="true"></i>
    </button>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
        <span id="answeredText" class="tnum">ตอบแล้ว 0/39</span>
        <span id="gradeText">ยังไม่ครบ</span>
      </div>
      <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div id="progressBar" class="h-full w-0 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-300"></div>
      </div>
    </div>
    <div class="text-right shrink-0">
      <div class="font-num font-extrabold text-slate-800 leading-none tnum text-xl">
        <span id="totalScore">0</span><span class="text-slate-300 text-sm font-bold">/100</span>
      </div>
    </div>
    <button onclick="saveAudit()" aria-label="บันทึกผลตรวจ"
      class="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 shadow-soft transition">
      <i data-lucide="save" class="w-4 h-4" aria-hidden="true"></i><span class="hidden xs:inline">บันทึก</span>
    </button>
  </div>
</div>

<!-- toast -->
<div id="toast" class="toast fixed left-1/2 -translate-x-1/2 bottom-24 z-50 max-w-[92%] opacity-0 translate-y-2 pointer-events-none">
  <div class="flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lift">
    <span id="toastIcon" class="text-brand-400 shrink-0"></span>
    <span id="toastMsg"></span>
  </div>
</div>

<script>
const CRITERIA    = <?= json_encode(array_values($CRITERIA), JSON_UNESCAPED_UNICODE) ?>;
const SECTION_MAX = <?= json_encode($SECTION_MAX, JSON_UNESCAPED_UNICODE) ?>;
const SECTION_ICON = {
  'Bar Coffee Station':'coffee',
  'Call Order & Service Station':'bell-ring',
  'Food & Bakery Station':'utensils',
  'Environment Station':'sparkles',
  'Administration':'file-text'
};
const scores = {};

// ----- class ของปุ่ม segmented -----
const SEG = 'seg-btn inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-semibold select-none';
const OFF = 'border-slate-200 bg-white text-slate-500';
const YES_ON = 'border-brand-600 bg-brand-600 text-white shadow-soft';
const NO_ON  = 'border-red-500 bg-red-500 text-white shadow-soft';

function todayLocal(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
document.getElementById('auditDate').value = todayLocal();

function grade(s){
  if (s>=95) return ['Excellent','excellent'];
  if (s>=85) return ['Good','good'];
  if (s>=75) return ['Fair','fair'];
  return ['Poor','poor'];
}
const GRADE_BADGE = {
  excellent:'bg-brand-100 text-brand-700',
  good:'bg-lime-100 text-lime-700',
  fair:'bg-amber-100 text-amber-700',
  poor:'bg-red-100 text-red-600'
};
function slug(t){ return t.replace(/[^a-zA-Z0-9]/g,'_'); }

function renderSections(){
  const host = document.getElementById('sections');
  host.innerHTML = Object.keys(SECTION_MAX).map((section, idx) => {
    const qs = CRITERIA.filter(q => q.section === section).map(q => {
      const note = q.note ? `<div class="mt-1.5 flex items-start gap-1 text-[11px] text-amber-600"><i data-lucide="search" class="w-3 h-3 mt-0.5 shrink-0"></i><span>${q.note}</span></div>` : '';
      const cid = slug(q.code);
      return `
      <div class="q rounded-2xl border border-slate-100 bg-white p-3.5" data-code="${q.code}" id="box-${cid}">
        <div class="flex items-start gap-2.5">
          <span class="shrink-0 inline-flex items-center rounded-lg bg-slate-100 text-slate-500 font-num text-[11px] font-semibold px-2 py-1 tnum">${q.code}</span>
          <p class="flex-1 text-[14.5px] leading-relaxed text-slate-700">${q.title}</p>
          <span class="q-check shrink-0 hidden"><i data-lucide="check-circle-2" class="w-5 h-5 text-brand-500"></i></span>
        </div>
        ${note}
        <div class="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" class="btn-yes ${SEG} ${OFF}" onclick="chooseScore('${q.code}',${q.max},'yes',this)">
            <i data-lucide="check" class="w-4 h-4"></i> ผ่าน <span class="font-num text-xs opacity-80 tnum">+${q.max}</span>
          </button>
          <button type="button" class="btn-no ${SEG} ${OFF}" onclick="chooseScore('${q.code}',0,'no',this)">
            <i data-lucide="x" class="w-4 h-4"></i> ไม่ผ่าน
          </button>
        </div>
      </div>`;
    }).join('');

    return `
    <section class="acc rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden ${idx===0?'open':''}">
      <button type="button" class="acc-head w-full flex items-center justify-between gap-3 p-4 text-left" onclick="toggleAcc(this)">
        <span class="flex items-center gap-3 min-w-0">
          <span class="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600 shrink-0">
            <i data-lucide="${SECTION_ICON[section]||'list'}" class="w-5 h-5"></i>
          </span>
          <span class="min-w-0">
            <span class="block font-semibold text-slate-800 truncate">${section}</span>
            <span class="block text-[11px] text-slate-400 tnum">${qs ? CRITERIA.filter(q=>q.section===section).length : 0} ข้อ</span>
          </span>
        </span>
        <span class="flex items-center gap-2.5 shrink-0">
          <span class="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] font-num font-semibold text-slate-500 tnum">
            <span id="meta-${slug(section)}">0</span>/${SECTION_MAX[section]}
          </span>
          <i data-lucide="chevron-down" class="acc-chev w-5 h-5 text-slate-400"></i>
        </span>
      </button>
      <div class="acc-body"><div class="p-3 pt-0 space-y-2.5">${qs}</div></div>
    </section>`;
  }).join('');

  lucide.createIcons();
  // เปิดหมวดแรก
  const first = host.querySelector('.acc.open .acc-body');
  if (first) first.style.maxHeight = first.scrollHeight + 'px';
}

function toggleAcc(head){
  const sec  = head.closest('.acc');
  const body = head.nextElementSibling;
  const open = sec.classList.toggle('open');
  body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
}

function chooseScore(code, score, kind, btn){
  scores[code] = score;
  const card = btn.closest('[data-code]');
  card.querySelector('.btn-yes').className = 'btn-yes ' + SEG + ' ' + (kind==='yes'?YES_ON:OFF);
  card.querySelector('.btn-no').className  = 'btn-no '  + SEG + ' ' + (kind==='no' ?NO_ON :OFF);
  card.classList.remove('border-slate-100'); card.classList.add('border-brand-200','bg-brand-50/20');
  card.querySelector('.q-check').classList.remove('hidden');
  lucide.createIcons();
  // ปรับความสูง accordion เผื่อ note/ความสูงเปลี่ยน
  const body = card.closest('.acc-body');
  if (body && card.closest('.acc').classList.contains('open')) body.style.maxHeight = body.scrollHeight + 'px';
  updateTotals();
}

function updateTotals(){
  let total=0, answered=0;
  const sec={}; Object.keys(SECTION_MAX).forEach(s=>sec[s]=0);
  CRITERIA.forEach(q=>{ if(scores[q.code]!==undefined){ answered++; total+=+scores[q.code]; sec[q.section]+=+scores[q.code]; }});

  document.getElementById('totalScore').textContent = total;
  document.getElementById('answeredText').textContent = `ตอบแล้ว ${answered}/${CRITERIA.length}`;
  document.getElementById('progressBar').style.width = (answered/CRITERIA.length*100)+'%';

  const [g,cls] = grade(total);
  document.getElementById('gradeText').innerHTML = (answered===CRITERIA.length)
    ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${GRADE_BADGE[cls]}">${g}</span>`
    : `<span class="text-slate-400">เหลืออีก ${CRITERIA.length-answered} ข้อ</span>`;

  Object.keys(SECTION_MAX).forEach(s=>{ const n=document.getElementById('meta-'+slug(s)); if(n) n.textContent=sec[s]; });
}

function requiredMetaOK(){
  const ids=['auditDate','branch','modName','auditor'];
  const miss=ids.filter(id=>!document.getElementById(id).value.trim());
  if(miss.length){ toast('กรุณากรอก วันที่ สาขา MOD และผู้ตรวจให้ครบ','alert-triangle'); document.getElementById(miss[0]).focus(); return false; }
  return true;
}

async function saveAudit(){
  if(!requiredMetaOK()) return;
  const un = CRITERIA.filter(q=>scores[q.code]===undefined);
  if(un.length){
    toast(`ยังให้คะแนนไม่ครบ อีก ${un.length} ข้อ`,'alert-triangle');
    const box=document.getElementById('box-'+slug(un[0].code));
    const sec=box.closest('.acc'); if(sec && !sec.classList.contains('open')) toggleAcc(sec.querySelector('.acc-head'));
    box.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  const payload={
    auditDate:val('auditDate'), branch:val('branch'), modName:val('modName'),
    amName:val('amName'), auditor:val('auditor'), note:val('generalNote'),
    scores:Object.fromEntries(CRITERIA.map(q=>[q.code,scores[q.code]]))
  };
  try{
    const res=await fetch('api.php?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.status===401){ location.href='login.php'; return; }
    const d=await res.json();
    if(!d.ok){ toast(d.error||'บันทึกไม่สำเร็จ','alert-triangle'); return; }
    toast(`บันทึกแล้ว · ${d.branch} · ${d.total}/100 · ${d.grade}`,'check-circle-2');
  }catch(e){ toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้','wifi-off'); }
}
function val(id){ return document.getElementById(id).value.trim(); }

let toastTimer;
function toast(msg, icon){
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').innerHTML = '<i data-lucide="'+(icon||'check-circle-2')+'" class="w-4 h-4"></i>';
  lucide.createIcons();
  const wrap=document.getElementById('toast');
  wrap.classList.remove('opacity-0','translate-y-2');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>wrap.classList.add('opacity-0','translate-y-2'),2800);
}

// ปิด user menu เมื่อคลิกข้างนอก
document.addEventListener('click', e=>{
  const m=document.getElementById('userMenu');
  if(m && !m.classList.contains('hidden') && !e.target.closest('.relative')) m.classList.add('hidden');
});

renderSections();
updateTotals();
lucide.createIcons();
</script>
</body>
</html>
