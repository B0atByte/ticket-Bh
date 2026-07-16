<?php
/**
 * ปุ่ม "แจ้งปัญหา" (ลอย หรือฝังในแถบอื่น) + modal — include หลัง topbar.php ในทุกหน้าที่ login แล้ว
 * ยิงไปที่ report_issue.php (ไม่บังคับ login)
 *
 * หน้าที่มีแถบคงที่ติดขอบล่างอยู่แล้ว (เช่น index.php มีแถบ progress+บันทึก) ให้ตั้ง
 * $REPORT_BUTTON_HIDE_TRIGGER = true ก่อน include เพื่อไม่ให้ render ปุ่มลอยซ้ำ แล้วฝัง
 * ปุ่มของตัวเองในแถบนั้นแทน โดยเรียก onclick เดียวกัน:
 *   document.getElementById('reportIssueModal').classList.remove('hidden')
 */
$REPORT_BUTTON_HIDE_TRIGGER = $REPORT_BUTTON_HIDE_TRIGGER ?? false;
$REPORT_BUTTON_BOTTOM = $REPORT_BUTTON_BOTTOM ?? 'bottom-5';
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
    <textarea id="reportIssueText" rows="4" placeholder="อธิบายปัญหาที่เจอ..."
      class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-300 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition resize-y"></textarea>
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
    const res = await fetch('report_issue.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, page: location.pathname }),
    });
    const d = await res.json();
    if (!d.ok) { toast(d.error || 'ส่งไม่สำเร็จ', 'alert-triangle'); return; }
    toast('ส่งแจ้งปัญหาแล้ว ขอบคุณครับ', 'check-circle-2');
    el.value = '';
    document.getElementById('reportIssueModal').classList.add('hidden');
  } catch (e) {
    toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'wifi-off');
  } finally {
    btn.disabled = false;
  }
}
</script>
