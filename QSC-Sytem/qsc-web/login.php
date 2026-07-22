<?php
require_once __DIR__ . '/auth.php';
if (current_user()) { header('Location: index.php'); exit; }

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $u = trim($_POST['username'] ?? '');
    $p = (string)($_POST['password'] ?? '');
    if (attempt_login($u, $p)) { header('Location: index.php'); exit; }
    $error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
}

$PAGE_TITLE = 'เข้าสู่ระบบ — WaTerFruit QSC';
$BODY_CLASS = 'bg-gradient-to-br from-brand-50 via-slate-50 to-slate-100 text-slate-800 font-sans antialiased min-h-screen grid place-items-center px-4';
require __DIR__ . '/partials/head.php';
?>
<main class="w-full max-w-sm">
  <div class="text-center mb-6">
    <span class="inline-grid place-items-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-lift mb-3">
      <i data-lucide="leaf" class="w-7 h-7" aria-hidden="true"></i>
    </span>
    <h1 class="text-xl font-bold text-slate-800">WaTerFruit</h1>
    <p class="text-sm text-slate-400 mt-0.5">ระบบตรวจประเมินมาตรฐานสาขา (QSC)</p>
  </div>

  <div class="rounded-3xl bg-white shadow-soft border border-slate-100 p-6">
    <?php if ($error): ?>
      <div class="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium px-3.5 py-2.5 mb-4">
        <i data-lucide="alert-circle" class="w-4 h-4 shrink-0" aria-hidden="true"></i><?= htmlspecialchars($error) ?>
      </div>
    <?php endif; ?>

    <form method="post" autocomplete="off" class="space-y-3.5">
      <label class="block">
        <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i>ชื่อผู้ใช้</span>
        <input name="username" required autofocus placeholder="username"
          class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">
      </label>
      <label class="block">
        <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5"><i data-lucide="lock" class="w-3.5 h-3.5"></i>รหัสผ่าน</span>
        <input name="password" type="password" required placeholder="••••••••"
          class="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition">
      </label>
      <button type="submit"
        class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[.98] text-white font-semibold py-2.5 shadow-soft transition">
        <i data-lucide="log-in" class="w-4 h-4" aria-hidden="true"></i> เข้าสู่ระบบ
      </button>
    </form>

    <p class="text-center text-xs text-slate-400 mt-4">
      บัญชีเริ่มต้น · <span class="font-num font-medium text-slate-500">admin / admin123</span>
    </p>

    <form method="post" class="mt-3">
      <input type="hidden" name="username" value="admin">
      <input type="hidden" name="password" value="admin123">
      <button type="submit"
        class="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 text-xs font-medium py-2.5 transition">
        <i data-lucide="zap" class="w-3.5 h-3.5" aria-hidden="true"></i> Quick Access — Admin
      </button>
    </form>
  </div>
</main>
<script>lucide.createIcons();</script>
</body>
</html>
