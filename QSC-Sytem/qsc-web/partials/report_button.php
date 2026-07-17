<?php
/**
 * ปุ่ม "แจ้งปัญหา" (ลอย หรือฝังในแถบอื่น) + modal — include หลัง topbar.php ในทุกหน้าที่ login แล้ว
 * ยิง POST ตรงไปที่ issue-service กลาง (ไม่ใช่ report_issue.php เดิมของระบบนี้แล้ว)
 *
 * หน้าที่มีแถบคงที่ติดขอบล่างอยู่แล้ว (เช่น index.php มีแถบ progress+บันทึก) ให้ตั้ง
 * $REPORT_BUTTON_HIDE_TRIGGER = true ก่อน include เพื่อไม่ให้ render ปุ่มลอยซ้ำ แล้วฝัง
 * ปุ่มของตัวเองในแถบนั้นแทน โดยเรียก onclick เดียวกัน:
 *   document.getElementById('reportIssueModal').classList.remove('hidden')
 *
 * ทุกหน้าที่ include ไฟล์นี้ผ่าน require_login_page()/require_admin_page() มาก่อนแล้ว
 * เสมอ — current_user() การันตีว่าไม่ null ตรงนี้
 */
$REPORT_BUTTON_HIDE_TRIGGER = $REPORT_BUTTON_HIDE_TRIGGER ?? false;
$REPORT_BUTTON_BOTTOM = $REPORT_BUTTON_BOTTOM ?? 'bottom-5';
$u = current_user();
?>
<?php if (!$REPORT_BUTTON_HIDE_TRIGGER): ?>
<button type="button" onclick="document.getElementById('reportIssueModal').classList.remove('hidden')"
  class="fixed <?= $REPORT_BUTTON_BOTTOM ?> left-4 z-40 inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 shadow-lift transition"
  aria-label="แจ้งปัญหา">
  <i data-lucide="bug" class="w-4 h-4" aria-hidden="true"></i>
  <span class="hidden xs:inline">แจ้งปัญหา</span>
</button>
<?php endif; ?>

<div id="reportIssueModal" class="hidden fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
  <div class="w-full max-w-sm rounded-2xl bg-white shadow-lift border border-slate-100 p-5">
    <div class="flex items-center gap-2 mb-3">
      <i data-lucide="bug" class="w-5 h-5 text-red-500" aria-hidden="true"></i>
      <h3 class="font-semibold text-slate-800">แจ้งปัญหา</h3>
    </div>

    <p class="mb-1.5 text-xs font-medium text-slate-500">ระดับความเร่งด่วน</p>
    <div id="reportSeverityGroup" class="mb-3 grid grid-cols-3 gap-1.5">
      <button type="button" data-severity="critical" onclick="setReportSeverity('critical')"
        class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-slate-200 text-slate-600 hover:bg-slate-50"
        title="ระบบพังถาวร ทำงานต่อไม่ได้เลย">
        <div>🔴</div><div>ด่วนที่สุด</div>
      </button>
      <button type="button" data-severity="high" onclick="setReportSeverity('high')"
        class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-slate-200 text-slate-600 hover:bg-slate-50"
        title="ทำงานได้บางส่วน แต่กระทบงานหลัก">
        <div>🟡</div><div>ด่วน</div>
      </button>
      <button type="button" data-severity="normal" onclick="setReportSeverity('normal')"
        class="report-severity-btn rounded-xl border px-2 py-2 text-xs font-medium transition-colors border-red-500 bg-red-50 text-red-700"
        title="ปัญหาทั่วไป/ข้อเสนอแนะ">
        <div>🟢</div><div>ทั่วไป</div>
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
</div>

<script>
const ISSUE_SERVICE_URL = <?= json_encode(ISSUE_SERVICE_URL) ?>;
const CURRENT_USER = <?= json_encode(['id' => (string)$u['id'], 'name' => $u['full_name'] ?: $u['username'], 'role' => $u['role']]) ?>;

let reportSeverity = 'normal';
function setReportSeverity(value) {
  reportSeverity = value;
  document.querySelectorAll('.report-severity-btn').forEach((btn) => {
    const active = btn.dataset.severity === value;
    btn.classList.toggle('border-red-500', active);
    btn.classList.toggle('bg-red-50', active);
    btn.classList.toggle('text-red-700', active);
    btn.classList.toggle('border-slate-200', !active);
    btn.classList.toggle('text-slate-600', !active);
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
    document.getElementById('reportIssueModal').classList.add('hidden');
  } catch (e) {
    toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'wifi-off');
  } finally {
    btn.disabled = false;
  }
}
</script>
