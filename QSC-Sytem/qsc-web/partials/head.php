<?php
/**
 * ส่วน <head> ที่ใช้ร่วมกันทุกหน้า — คุม design system (Tailwind config, ฟอนต์, ไอคอน)
 * ตัวแปรที่รับ: $PAGE_TITLE, $BODY_CLASS, $NEED_CHARTS (bool)
 */
$PAGE_TITLE  = $PAGE_TITLE  ?? 'WaTerFruit — QSC Branch Audit';
$BODY_CLASS  = $BODY_CLASS  ?? 'bg-slate-50 text-slate-800 font-sans antialiased';
$NEED_CHARTS = $NEED_CHARTS ?? false;
?>
<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#16a34a">
<title><?= htmlspecialchars($PAGE_TITLE) ?></title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<link rel="stylesheet" href="assets/tailwind.css">
<?php if ($NEED_CHARTS): ?>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<?php endif; ?>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>

<style>
  html { -webkit-text-size-adjust: 100%; }
  .tnum { font-variant-numeric: tabular-nums; }
  .acc-body { overflow: hidden; max-height: 0; transition: max-height .30s cubic-bezier(.4,0,.2,1); }
  .acc-chev { transition: transform .25s ease; }
  .open > .acc-head .acc-chev { transform: rotate(180deg); }
  .seg-btn { transition: transform .12s ease, background-color .15s ease, color .15s ease, border-color .15s ease; }
  .seg-btn:active { transform: scale(.97); }
  .toast { transition: opacity .2s ease, transform .2s ease; }
  /* date input ให้สีไอคอนกลมกลืน */
  input[type=date]::-webkit-calendar-picker-indicator { opacity:.5; cursor:pointer; }
  ::selection { background:#bbf7d0; }
</style>
</head>
<body class="<?= htmlspecialchars($BODY_CLASS) ?>">
