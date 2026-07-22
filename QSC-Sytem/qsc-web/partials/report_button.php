<?php
/**
 * Modal "รายงานปัญหา" — include หลัง topbar.php ในทุกหน้าที่ login แล้ว
 * เปิดผ่านแท็บ "รายงานปัญหา" ใน dropdown เมนูผู้ใช้ (topbar.php) โดยเรียก:
 *   document.getElementById('reportIssueModal').classList.remove('hidden')
 * ยิง POST ตรงไปที่ issue-service กลาง (ไม่ใช่ report_issue.php เดิมของระบบนี้แล้ว)
 *
 * ทุกหน้าที่ include ไฟล์นี้ผ่าน require_login_page()/require_admin_page() มาก่อนแล้ว
 * เสมอ — current_user() การันตีว่าไม่ null ตรงนี้
 */
$u = current_user();
?>

<div id="reportIssueModal" class="hidden fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
  <div class="w-full max-w-sm rounded-2xl bg-white shadow-lift border border-slate-100 p-5">
    <div class="flex items-center gap-2 mb-3">
      <i data-lucide="bug" class="w-5 h-5 text-red-500" aria-hidden="true"></i>
      <h3 class="font-semibold text-slate-800">รายงานปัญหา</h3>
    </div>

    <div class="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
      <button type="button" id="reportTabNew" onclick="switchReportView('new')"
        class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-white text-slate-900 shadow-sm">
        <i data-lucide="bug" class="w-3.5 h-3.5" aria-hidden="true"></i>
        แจ้งปัญหาใหม่
      </button>
      <button type="button" id="reportTabHistory" onclick="switchReportView('history')"
        class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors text-slate-500 hover:text-slate-700">
        <i data-lucide="history" class="w-3.5 h-3.5" aria-hidden="true"></i>
        ประวัติของฉัน
      </button>
    </div>

    <div id="reportViewNew">
      <p class="mb-1.5 text-xs font-medium text-slate-500">ระดับความเร่งด่วน</p>
      <div id="reportSeverityGroup" class="mb-3 grid grid-cols-3 gap-1.5">
        <button type="button" data-severity="critical" onclick="setReportSeverity('critical')"
          class="report-severity-btn rounded-xl px-2 py-2 text-xs font-semibold transition-all bg-red-600 hover:bg-red-700 text-white opacity-50 hover:opacity-80"
          title="ระบบพังถาวร ทำงานต่อไม่ได้เลย">
          ด่วนที่สุด
        </button>
        <button type="button" data-severity="high" onclick="setReportSeverity('high')"
          class="report-severity-btn rounded-xl px-2 py-2 text-xs font-semibold transition-all bg-amber-500 hover:bg-amber-600 text-white opacity-50 hover:opacity-80"
          title="ทำงานได้บางส่วน แต่กระทบงานหลัก">
          ด่วน
        </button>
        <button type="button" data-severity="normal" onclick="setReportSeverity('normal')"
          class="report-severity-btn rounded-xl px-2 py-2 text-xs font-semibold transition-all bg-green-600 hover:bg-green-700 text-white ring-2 ring-offset-2 ring-slate-900"
          title="ปัญหาทั่วไป/ข้อเสนอแนะ">
          ทั่วไป
        </button>
      </div>

      <textarea id="reportIssueText" rows="4" placeholder="อธิบายปัญหาที่เจอ..."
        class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition resize-y"></textarea>

      <label class="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 cursor-pointer hover:bg-slate-50">
        <i data-lucide="paperclip" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"></i>
        <span id="reportAttachmentLabel" class="truncate">แนบภาพหน้าจอ (ไม่บังคับ)</span>
        <input type="file" id="reportAttachmentInput" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" class="hidden">
      </label>

      <div class="mt-4 flex gap-2">
        <button type="button" onclick="document.getElementById('reportIssueModal').classList.add('hidden')"
          class="flex-1 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm py-2.5 hover:bg-slate-50 transition">
          ยกเลิก
        </button>
        <button type="button" id="reportIssueSend" onclick="submitReportIssue()"
          class="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 transition">
          ส่ง
        </button>
      </div>
    </div>

    <div id="reportViewHistory" class="hidden space-y-2.5 max-h-[60vh] overflow-y-auto"></div>
  </div>
</div>

<script>
const ISSUE_SERVICE_URL = <?= json_encode(ISSUE_SERVICE_URL) ?>;
const CURRENT_USER = <?= json_encode(['id' => (string)$u['id'], 'name' => $u['full_name'] ?: $u['username'], 'role' => $u['role']]) ?>;

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → pending_user → resolved) — labels match what
// admins see elsewhere (dashboard) so the reporter isn't shown different
// wording for the same state.
const REPORT_STATUS_STEPS = [
  { key: 'submitted', label: 'ส่งเรื่องแล้ว' },
  { key: 'acknowledged', label: 'รับเรื่องแล้ว' },
  { key: 'pending_user', label: 'รอข้อมูลเพิ่มเติม' },
  { key: 'resolved', label: 'แก้ไขเรียบร้อย' },
];
const REPORT_SEVERITY_DOT = { critical: 'bg-red-500', high: 'bg-amber-500', normal: 'bg-green-500' };

function switchReportView(view) {
  const isNew = view === 'new';
  document.getElementById('reportViewNew').classList.toggle('hidden', !isNew);
  document.getElementById('reportViewHistory').classList.toggle('hidden', isNew);
  document.getElementById('reportTabNew').classList.toggle('bg-white', isNew);
  document.getElementById('reportTabNew').classList.toggle('shadow-sm', isNew);
  document.getElementById('reportTabNew').classList.toggle('text-slate-900', isNew);
  document.getElementById('reportTabNew').classList.toggle('text-slate-500', !isNew);
  document.getElementById('reportTabHistory').classList.toggle('bg-white', !isNew);
  document.getElementById('reportTabHistory').classList.toggle('shadow-sm', !isNew);
  document.getElementById('reportTabHistory').classList.toggle('text-slate-900', !isNew);
  document.getElementById('reportTabHistory').classList.toggle('text-slate-500', isNew);
  if (!isNew) loadMyIssues();
}

function issueProgressHtml(status) {
  const currentIndex = REPORT_STATUS_STEPS.findIndex((s) => s.key === status);
  const activeColor = status === 'resolved' ? 'bg-green-500' : 'bg-red-500';
  return `<div class="flex items-start">${REPORT_STATUS_STEPS.map((step, i) => {
    const reached = i <= currentIndex;
    const dot = `<div class="h-2.5 w-2.5 rounded-full ${reached ? activeColor : 'bg-slate-200'}"></div>`;
    const label = `<span class="text-center text-[9px] leading-tight ${reached ? 'font-medium text-slate-700' : 'text-slate-400'}">${step.label}</span>`;
    const connector = i < REPORT_STATUS_STEPS.length - 1
      ? `<div class="mt-[5px] h-0.5 flex-1 ${i < currentIndex ? activeColor : 'bg-slate-200'}"></div>` : '';
    const isLast = i === REPORT_STATUS_STEPS.length - 1;
    return `<div class="flex ${isLast ? 'flex-none' : 'flex-1'} items-start">
      <div class="flex w-14 flex-col items-center gap-1 shrink-0">${dot}${label}</div>${connector}
    </div>`;
  }).join('')}</div>`;
}

function issueHistoryCardHtml(issue) {
  const dot = REPORT_SEVERITY_DOT[issue.severity] || 'bg-slate-300';
  const date = new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  return `<div class="rounded-xl border border-slate-200 p-3.5">
    <div class="mb-1.5 flex items-start justify-between gap-2">
      <p class="flex-1 line-clamp-2 text-sm text-slate-800">${escapeHtml(issue.description)}</p>
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}"></span>
    </div>
    <p class="mb-3 text-[11px] text-slate-400">${date}</p>
    ${issueProgressHtml(issue.status)}
  </div>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

let myIssuesLoaded = false;
async function loadMyIssues() {
  const box = document.getElementById('reportViewHistory');
  box.innerHTML = '<div class="flex items-center justify-center py-10 text-slate-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i></div>';
  if (window.lucide) lucide.createIcons();
  try {
    const params = new URLSearchParams({ system: 'QSC-Sytem', reporterId: CURRENT_USER.id });
    const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues/mine?${params.toString()}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'โหลดประวัติการแจ้งปัญหาไม่สำเร็จ');
    const issues = body.issues || [];
    box.innerHTML = issues.length === 0
      ? '<p class="py-6 text-center text-sm text-slate-400">ยังไม่มีประวัติการแจ้งปัญหา</p>'
      : issues.map(issueHistoryCardHtml).join('');
  } catch (e) {
    box.innerHTML = `<p class="py-6 text-center text-sm text-red-600">${escapeHtml(e.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')}</p>`;
  }
}

let reportSeverity = 'normal';
function setReportSeverity(value) {
  reportSeverity = value;
  document.querySelectorAll('.report-severity-btn').forEach((btn) => {
    const active = btn.dataset.severity === value;
    btn.classList.toggle('ring-2', active);
    btn.classList.toggle('ring-offset-2', active);
    btn.classList.toggle('ring-slate-900', active);
    btn.classList.toggle('opacity-50', !active);
    btn.classList.toggle('hover:opacity-80', !active);
  });
}

document.getElementById('reportAttachmentInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('reportAttachmentLabel').textContent = file ? file.name : 'แนบภาพหน้าจอ (ไม่บังคับ)';
});

async function submitReportIssue() {
  const el = document.getElementById('reportIssueText');
  const description = el.value.trim();
  if (description.length < 5) {
    toast('กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร', 'alert-triangle');
    return;
  }
  const btn = document.getElementById('reportIssueSend');
  btn.disabled = true;
  try {
    const fd = new FormData();
    fd.set('system', 'QSC-Sytem');
    fd.set('description', description);
    fd.set('severity', reportSeverity);
    fd.set('reporterId', CURRENT_USER.id);
    fd.set('reporterName', CURRENT_USER.name);
    fd.set('reporterRole', CURRENT_USER.role);
    fd.set('page', location.pathname);
    const file = document.getElementById('reportAttachmentInput').files[0];
    if (file) fd.set('attachment', file);

    const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) { toast(d.error || 'ส่งไม่สำเร็จ', 'alert-triangle'); return; }
    toast('ส่งแจ้งปัญหาแล้ว ขอบคุณครับ', 'check-circle-2');
    el.value = '';
    document.getElementById('reportAttachmentInput').value = '';
    document.getElementById('reportAttachmentLabel').textContent = 'แนบภาพหน้าจอ (ไม่บังคับ)';
    setReportSeverity('normal');
    switchReportView('new');
    document.getElementById('reportIssueModal').classList.add('hidden');
  } catch (e) {
    toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'wifi-off');
  } finally {
    btn.disabled = false;
  }
}
</script>
