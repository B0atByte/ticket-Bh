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

    <div id="reportTabs" class="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
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
      <p class="mb-1.5 text-xs font-medium text-slate-500">หมวดหมู่</p>
      <select id="reportCategorySelect" onchange="reportCategory = this.value"
        class="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">
        <option value="system_error">ระบบขัดข้อง</option>
        <option value="payment">การชำระเงินผิดพลาด</option>
        <option value="account">บัญชีผู้ใช้</option>
        <option value="feedback">ข้อเสนอแนะ</option>
        <option value="other" selected>อื่นๆ</option>
      </select>

      <input type="text" id="reportSubjectInput" maxlength="120" placeholder="หัวข้อสั้นๆ" required
        class="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">

      <p class="mb-1.5 text-xs font-medium text-slate-500">ระดับความเร่งด่วน</p>
      <div id="reportSeverityGroup" class="mb-3 grid grid-cols-3 gap-1.5">
        <button type="button" data-severity="critical" onclick="setReportSeverity('critical')"
          class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-slate-200 text-slate-600 hover:bg-slate-50"
          title="ระบบพังถาวร ทำงานต่อไม่ได้เลย">
          ด่วนที่สุด
        </button>
        <button type="button" data-severity="high" onclick="setReportSeverity('high')"
          class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-slate-200 text-slate-600 hover:bg-slate-50"
          title="ทำงานได้บางส่วน แต่กระทบงานหลัก">
          ด่วน
        </button>
        <button type="button" data-severity="normal" onclick="setReportSeverity('normal')"
          class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-slate-900 bg-slate-900 text-white"
          title="ปัญหาทั่วไป/ข้อเสนอแนะ">
          ทั่วไป
        </button>
      </div>

      <textarea id="reportIssueText" rows="4" placeholder="อธิบายปัญหาที่เจอ..."
        class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition resize-y"></textarea>

      <input type="text" id="reportContactInput" placeholder="เบอร์โทร/อีเมล ติดต่อกลับ (ไม่บังคับ)"
        class="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">

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

    <div id="reportViewDetail" class="hidden space-y-3.5 max-h-[70vh] overflow-y-auto"></div>
  </div>
</div>

<script>
const ISSUE_SERVICE_URL = <?= json_encode(ISSUE_SERVICE_URL) ?>;
const APP_VERSION = <?= json_encode(APP_VERSION) ?>;
const CURRENT_USER = <?= json_encode(['id' => (string)$u['id'], 'name' => $u['full_name'] ?: $u['username'], 'role' => $u['role']]) ?>;
const CATEGORY_LABELS = { system_error: 'ระบบขัดข้อง', payment: 'การชำระเงินผิดพลาด', account: 'บัญชีผู้ใช้', feedback: 'ข้อเสนอแนะ', other: 'อื่นๆ' };
let reportCategory = 'other';

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → resolved). Issue Management shows its own
// admin-facing wording for the same states — these are reporter-facing.
const REPORT_STATUS_STEPS = [
  { key: 'submitted', label: 'ส่งเรื่องแล้ว' },
  { key: 'acknowledged', label: 'รับเรื่องแล้ว' },
  { key: 'resolved', label: 'แก้ไขเสร็จสิ้น' },
];
const REPORT_SEVERITY_LABEL = { critical: 'ด่วนที่สุด', high: 'ด่วน', normal: 'ทั่วไป' };

function switchReportView(view) {
  const isNew = view === 'new';
  document.getElementById('reportTabs').classList.remove('hidden');
  document.getElementById('reportViewNew').classList.toggle('hidden', !isNew);
  document.getElementById('reportViewHistory').classList.toggle('hidden', isNew);
  document.getElementById('reportViewDetail').classList.add('hidden');
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

function issueHistoryCardHtml(issue, index) {
  const label = REPORT_SEVERITY_LABEL[issue.severity] || issue.severity;
  const date = new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  const heading = issue.subject ? escapeHtml(issue.subject) : escapeHtml(issue.description);
  return `<div class="rounded-xl border border-slate-200 p-3.5">
    <div class="mb-1.5 flex items-start justify-between gap-2">
      <p class="flex-1 line-clamp-2 text-sm font-medium text-slate-800">${heading}</p>
      <span class="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">${label}</span>
    </div>
    <p class="mb-3 text-[11px] text-slate-400">${date}</p>
    ${issueProgressHtml(issue.status)}
    <button type="button" onclick="viewIssueDetail(${index})" class="mt-3 text-xs font-medium text-blue-600 hover:underline">
      ดูเพิ่ม
    </button>
  </div>`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

let myIssuesLoaded = false;
let currentMyIssues = [];

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
    currentMyIssues = issues;
    box.innerHTML = issues.length === 0
      ? '<p class="py-6 text-center text-sm text-slate-400">ยังไม่มีประวัติการแจ้งปัญหา</p>'
      : issues.map(issueHistoryCardHtml).join('');
  } catch (e) {
    box.innerHTML = `<p class="py-6 text-center text-sm text-red-600">${escapeHtml(e.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')}</p>`;
  }
}

function commentHtml(c) {
  const who = c.authorType === 'admin' ? 'แอดมิน' : 'ผู้แจ้ง';
  const badgeClass = c.authorType === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700';
  const date = new Date(c.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  return `<div class="rounded-lg bg-slate-50 px-3 py-2">
    <div class="mb-0.5 flex items-center gap-1.5">
      <span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}">${who}</span>
      <span class="text-[11px] text-slate-400">${date}</span>
    </div>
    <p class="whitespace-pre-wrap text-sm text-slate-800">${escapeHtml(c.message)}</p>
  </div>`;
}

function issueDetailHtml(issue) {
  const label = REPORT_SEVERITY_LABEL[issue.severity] || issue.severity;
  const catLabel = CATEGORY_LABELS[issue.category] || issue.category;
  const date = new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  const history = (issue.history || []).map((h) => `
    <div class="flex gap-2.5">
      <div class="mt-1 h-2 w-2 shrink-0 rounded-full ${h.status === 'resolved' ? 'bg-green-500' : 'bg-red-500'}"></div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-slate-700">${escapeHtml(h.label)}</p>
        ${h.note ? `<p class="text-xs text-slate-500">${escapeHtml(h.note)}</p>` : ''}
        <p class="text-[11px] text-slate-400">${new Date(h.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>
    </div>`).join('');
  const comments = (issue.comments || []).length === 0
    ? '<p class="text-xs text-slate-400">ยังไม่มีความคิดเห็น</p>'
    : issue.comments.map(commentHtml).join('');

  return `
    <button type="button" onclick="backToHistory()" class="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
      <i data-lucide="arrow-left" class="w-3.5 h-3.5" aria-hidden="true"></i>
      ย้อนกลับ
    </button>
    <div class="flex flex-wrap gap-1.5">
      <span class="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">${label}</span>
      <span class="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">${catLabel}</span>
    </div>
    ${issue.subject ? `<p class="text-sm font-semibold text-slate-900">${escapeHtml(issue.subject)}</p>` : ''}
    <p class="whitespace-pre-wrap text-sm text-slate-800">${escapeHtml(issue.description)}</p>
    ${issue.contactInfo ? `<p class="text-xs text-slate-500">ติดต่อกลับ: ${escapeHtml(issue.contactInfo)}</p>` : ''}
    <p class="text-[11px] text-slate-400">แจ้งเมื่อ ${date}</p>
    <div class="border-t border-slate-100 pt-3 space-y-3">${history}</div>
    <div class="border-t border-slate-100 pt-3">
      <p class="mb-2 text-xs font-semibold text-slate-600">ความคิดเห็น</p>
      <div id="reportCommentsList" class="space-y-2">${comments}</div>
      <p id="reportCommentError" class="mt-2 text-xs text-red-500 hidden"></p>
      <div class="mt-2 flex gap-2">
        <textarea id="reportCommentInput" rows="2" placeholder="พิมพ์ข้อความ..."
          class="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-500"></textarea>
        <button type="button" id="reportCommentSend" onclick="submitReportComment()"
          class="self-end rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
          ส่ง
        </button>
      </div>
    </div>
  `;
}

let currentDetailIssue = null;

function viewIssueDetail(index) {
  const issue = currentMyIssues[index];
  if (!issue) return;
  currentDetailIssue = issue;
  document.getElementById('reportTabs').classList.add('hidden');
  document.getElementById('reportViewHistory').classList.add('hidden');
  const box = document.getElementById('reportViewDetail');
  box.classList.remove('hidden');
  box.innerHTML = issueDetailHtml(issue);
  if (window.lucide) lucide.createIcons();
}

function backToHistory() {
  currentDetailIssue = null;
  document.getElementById('reportViewDetail').classList.add('hidden');
  switchReportView('history');
}

async function submitReportComment() {
  if (!currentDetailIssue) return;
  const input = document.getElementById('reportCommentInput');
  const message = input.value.trim();
  const errEl = document.getElementById('reportCommentError');
  errEl.classList.add('hidden');
  if (!message) return;
  const btn = document.getElementById('reportCommentSend');
  btn.disabled = true;
  try {
    const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues/${currentDetailIssue.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, system: 'QSC-Sytem', reporterId: CURRENT_USER.id }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'ส่งข้อความไม่สำเร็จ');
    currentDetailIssue.comments = body.comments;
    document.getElementById('reportCommentsList').innerHTML = body.comments.map(commentHtml).join('');
    input.value = '';
  } catch (e) {
    errEl.textContent = e.message || 'ส่งข้อความไม่สำเร็จ';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

let reportSeverity = 'normal';
function setReportSeverity(value) {
  reportSeverity = value;
  document.querySelectorAll('.report-severity-btn').forEach((btn) => {
    const active = btn.dataset.severity === value;
    btn.classList.toggle('border-slate-900', active);
    btn.classList.toggle('bg-slate-900', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-slate-200', !active);
    btn.classList.toggle('text-slate-600', !active);
  });
}

async function submitReportIssue() {
  const el = document.getElementById('reportIssueText');
  const description = el.value.trim();
  const subject = document.getElementById('reportSubjectInput').value.trim();
  if (!subject) {
    toast('กรุณาใส่หัวข้อ', 'alert-triangle');
    return;
  }
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
    fd.set('category', reportCategory);
    fd.set('subject', subject);
    const contactInfo = document.getElementById('reportContactInput').value.trim();
    if (contactInfo) fd.set('contactInfo', contactInfo);
    fd.set('deviceInfo', JSON.stringify({ ua: navigator.userAgent, screen: `${screen.width}x${screen.height}`, lang: navigator.language }));
    fd.set('appVersion', APP_VERSION);

    const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) { toast(d.error || 'ส่งไม่สำเร็จ', 'alert-triangle'); return; }
    toast('ส่งแจ้งปัญหาแล้ว ขอบคุณครับ', 'check-circle-2');
    el.value = '';
    document.getElementById('reportSubjectInput').value = '';
    document.getElementById('reportContactInput').value = '';
    document.getElementById('reportCategorySelect').value = 'other';
    reportCategory = 'other';
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
