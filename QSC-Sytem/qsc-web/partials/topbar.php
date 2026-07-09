<?php
/**
 * แถบนำทางด้านบน — ใช้ไอคอน Lucide (SVG) ทั้งหมด ไม่มี emoji
 * ตัวแปรที่รับ: $ACTIVE ('form' | 'dashboard'), $user (array)
 */
$ACTIVE = $ACTIVE ?? 'form';
$name   = $user['full_name'] ?: $user['username'];

function navpill(bool $on): string
{
    return $on
        ? 'bg-white text-brand-700 shadow-sm'
        : 'text-slate-500 hover:text-slate-700';
}
?>
<header class="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100">
  <div class="mx-auto max-w-3xl px-4">
    <div class="h-14 flex items-center justify-between gap-3">

      <!-- โลโก้แบรนด์ -->
      <a href="index.php" class="flex items-center gap-2.5 shrink-0">
        <span class="grid place-items-center w-9 h-9 rounded-xl bg-brand-600 text-white shadow-soft">
          <i data-lucide="leaf" class="w-5 h-5" aria-hidden="true"></i>
        </span>
        <span class="leading-tight">
          <span class="block font-semibold text-slate-800 text-[15px]">WaTerFruit</span>
          <span class="block text-[10.5px] tracking-wide text-slate-400 -mt-0.5">QSC BRANCH AUDIT</span>
        </span>
      </a>

      <div class="flex items-center gap-2">
        <!-- สลับหน้า ฟอร์ม / Dashboard -->
        <nav class="flex items-center gap-1 bg-slate-100 rounded-xl p-1" aria-label="เมนูหลัก">
          <a href="index.php" aria-label="ฟอร์มตรวจ"
             class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium <?= navpill($ACTIVE==='form') ?>">
            <i data-lucide="clipboard-list" class="w-4 h-4" aria-hidden="true"></i>
            <span class="hidden xs:inline">ฟอร์มตรวจ</span>
          </a>
          <a href="dashboard.php" aria-label="Dashboard"
             class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium <?= navpill($ACTIVE==='dashboard') ?>">
            <i data-lucide="bar-chart-3" class="w-4 h-4" aria-hidden="true"></i>
            <span class="hidden xs:inline">Dashboard</span>
          </a>
        </nav>

        <!-- โปรไฟล์ผู้ใช้ -->
        <div class="relative">
          <button type="button" onclick="document.getElementById('userMenu').classList.toggle('hidden')"
                  class="flex items-center gap-2 rounded-xl pl-1 pr-1.5 py-1 hover:bg-slate-100" aria-label="เมนูผู้ใช้">
            <span class="grid place-items-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500">
              <i data-lucide="user" class="w-4 h-4" aria-hidden="true"></i>
            </span>
            <span class="hidden sm:block text-sm font-medium text-slate-600 max-w-[120px] truncate"><?= htmlspecialchars($name) ?></span>
            <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 hidden sm:block" aria-hidden="true"></i>
          </button>
          <div id="userMenu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lift border border-slate-100 p-1.5 z-40">
            <div class="px-3 py-2 border-b border-slate-50">
              <div class="text-[11px] text-slate-400">เข้าสู่ระบบเป็น</div>
              <div class="text-sm font-medium text-slate-700 truncate"><?= htmlspecialchars($name) ?></div>
              <div class="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
                <i data-lucide="<?= is_admin() ? 'shield-check' : 'clipboard-check' ?>" class="w-3 h-3"></i>
                <?= is_admin() ? 'ผู้ดูแลระบบ' : 'ผู้ประเมิน' ?>
              </div>
            </div>
            <?php if (is_admin()): ?>
            <a href="admin.php" class="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 <?= ($ACTIVE==='admin'?'bg-slate-50':'') ?>">
              <i data-lucide="settings" class="w-4 h-4" aria-hidden="true"></i> จัดการระบบ
            </a>
            <?php endif; ?>
            <a href="logout.php" class="mt-0.5 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50">
              <i data-lucide="log-out" class="w-4 h-4" aria-hidden="true"></i> ออกจากระบบ
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
