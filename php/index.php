<?php
require_once __DIR__ . '/auth.php';
if (!current_user()) { header('Location: login.php'); exit; }
$sessionUser = current_user();
$appBaseUrl  = app_base_url();
?>
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SMS Gateway — Dashboard</title>
<meta name="description" content="SMS Gateway Dashboard — Gestão de mensagens em tempo real" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
/* ══════════════════════════════════════════════════════
   RESET & VARIABLES
══════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #0A0E1A;
  --surface:    #111827;
  --card:       #1A2236;
  --card-hover: #1F2A40;
  --glass:      rgba(26, 34, 54, 0.8);
  --stroke:     rgba(255,255,255,.06);
  --stroke-hover: rgba(0,201,177,.3);

  --primary:    #00C9B1;
  --primary-d:  #00A896;
  --primary-glow: rgba(0,201,177,.18);
  --accent:     #7C73FF;
  --amber:      #F5A623;
  --rose:       #FF5C6B;
  --green:      #22C55E;

  --text:       #EAF0FF;
  --text-muted: #7A90B8;
  --text-dim:   #3D506E;

  --radius:     18px;
  --radius-sm:  12px;
  --radius-xs:  8px;

  --sidebar-w:  260px;
  --transition: .2s cubic-bezier(.4,0,.2,1);
}

html { scroll-behavior: smooth; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar personalizada */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--stroke); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--primary); }

/* ══════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════ */
.app { display: flex; min-height: 100vh; }

/* ── Sidebar ── */
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--stroke);
  display: flex; flex-direction: column;
  padding: 24px 16px;
  z-index: 200;
  transition: transform var(--transition);
}

.logo {
  display: flex; align-items: center; gap: 12px;
  padding: 4px 8px 24px;
  border-bottom: 1px solid var(--stroke);
  margin-bottom: 20px;
}
.logo-icon {
  width: 40px; height: 40px; border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: grid; place-items: center;
  font-weight: 800; font-size: 15px; color: #fff;
  box-shadow: 0 4px 16px var(--primary-glow);
  flex-shrink: 0;
}
.logo-title { font-size: 16px; font-weight: 700; letter-spacing: -.3px; }
.logo-sub   { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

.nav-section { font-size: 10px; font-weight: 700; letter-spacing: .12em;
               color: var(--text-dim); text-transform: uppercase;
               padding: 0 8px; margin: 16px 0 6px; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-xs);
  font-size: 14px; font-weight: 500;
  color: var(--text-muted);
  cursor: pointer; transition: all var(--transition);
  text-decoration: none; margin-bottom: 2px;
  border: 1px solid transparent;
  user-select: none;
}
.nav-item:hover { background: var(--card); color: var(--text); }
.nav-item.active { background: var(--primary-glow); color: var(--primary);
                   border-color: rgba(0,201,177,.15); }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }

.sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--stroke);
}
.status-badge {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-xs);
  background: rgba(34,197,94,.08);
  border: 1px solid rgba(34,197,94,.15);
  font-size: 12px; color: var(--green); font-weight: 500;
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green);
              animation: pulse 2s infinite; }
.server-info { font-size: 11px; color: var(--text-dim); padding: 8px 12px 0; }

/* ── Main ── */
.main { margin-left: var(--sidebar-w); flex: 1; min-width: 0; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--stroke);
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(12px);
}
.topbar-title h1 { font-size: 20px; font-weight: 700; }
.topbar-title p  { font-size: 13px; color: var(--text-muted); }

.topbar-actions { display: flex; align-items: center; gap: 12px; }

.btn-refresh {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-xs);
  background: transparent; border: 1px solid var(--stroke);
  color: var(--text-muted); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all var(--transition); font-family: inherit;
}
.btn-refresh:hover { border-color: var(--primary); color: var(--primary); }
.btn-refresh.spin svg { animation: spin 1s linear infinite; }

.time-badge {
  font-size: 12px; color: var(--text-dim); padding: 6px 12px;
  border: 1px solid var(--stroke); border-radius: var(--radius-xs);
}

.content { padding: 28px 32px; }

/* ══════════════════════════════════════════════════════
   STATS GRID
══════════════════════════════════════════════════════ */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 22px 24px;
  cursor: default;
  transition: all var(--transition);
  position: relative; overflow: hidden;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent-color, var(--primary));
  opacity: 0; transition: opacity var(--transition);
}
.stat-card:hover { border-color: var(--stroke-hover); transform: translateY(-2px);
                   box-shadow: 0 8px 32px rgba(0,0,0,.3); }
.stat-card:hover::before { opacity: 1; }

.stat-label { font-size: 11px; font-weight: 700; letter-spacing: .1em;
              text-transform: uppercase; color: var(--text-muted); }
.stat-value { font-size: 38px; font-weight: 800; letter-spacing: -1px;
              margin: 10px 0 6px; color: var(--accent-color, var(--primary));
              line-height: 1; }
.stat-sub   { font-size: 12px; color: var(--text-dim); }
.stat-icon  { position: absolute; right: 20px; top: 20px; font-size: 28px; opacity: .12; }

/* ══════════════════════════════════════════════════════
   PANELS
══════════════════════════════════════════════════════ */
.grid-2 { display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px; margin-bottom: 24px; }

.panel {
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  overflow: hidden;
}
.panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--stroke);
}
.panel-title { font-size: 13px; font-weight: 700; letter-spacing: .06em;
               text-transform: uppercase; color: var(--text-muted); }
.panel-badge { font-size: 12px; font-weight: 700; color: var(--primary);
               background: var(--primary-glow); padding: 3px 10px;
               border-radius: 99px; }
.panel-body { padding: 24px; }

/* ── Form ── */
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: 1/-1; }

label { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: .04em; }

input[type="text"], input[type="tel"], textarea, select {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--stroke);
  border-radius: var(--radius-xs);
  color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px;
  padding: 11px 14px; width: 100%; outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}
input::placeholder, textarea::placeholder { color: var(--text-dim); }
input:focus, textarea:focus { border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow); }
textarea { resize: vertical; min-height: 100px; }
input:disabled { opacity: .5; cursor: not-allowed; }

.char-count { font-size: 11px; color: var(--text-dim); text-align: right; }

.btn-primary {
  background: var(--primary); color: #0A0E1A;
  border: none; border-radius: var(--radius-xs);
  padding: 12px 24px; font-family: 'Inter', sans-serif;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all var(--transition); letter-spacing: .03em;
  display: flex; align-items: center; gap: 8px;
}
.btn-primary:hover   { background: var(--primary-d); transform: translateY(-1px);
                       box-shadow: 0 6px 20px var(--primary-glow); }
.btn-primary:active  { transform: translateY(0); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

.btn-row { display: flex; justify-content: flex-end; margin-top: 16px; }

.queue-banner {
  padding: 10px 14px; border-radius: var(--radius-xs);
  font-size: 13px; font-weight: 500; margin-bottom: 14px;
  border: 1px solid;
}
.banner-ok    { background: rgba(34,197,94,.08);  border-color: rgba(34,197,94,.2);  color: var(--green); }
.banner-warn  { background: rgba(245,166,35,.08); border-color: rgba(245,166,35,.2); color: var(--amber); }
.banner-error { background: rgba(255,92,107,.08); border-color: rgba(255,92,107,.2); color: var(--rose); }

.pairing-box {
  margin-top: 20px; padding: 18px; border-radius: var(--radius-sm);
  background: rgba(0,201,177,.06); border: 1px solid rgba(0,201,177,.2);
}
.pairing-grid { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start; }
.pairing-qr-wrap {
  background: #fff; padding: 10px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.pairing-label { font-size: 11px; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.pairing-code { font-size: 22px; font-weight: 800; letter-spacing: .18em; margin-top: 4px; color: var(--primary); }
.pairing-expiry { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.pairing-expired { color: var(--rose); }
.pairing-link-row { display: flex; gap: 8px; margin-top: 6px; }
.pairing-link-input {
  flex: 1; min-width: 0; background: rgba(255,255,255,.04); border: 1px solid var(--stroke);
  border-radius: var(--radius-xs); color: var(--text-muted); font-size: 12px; padding: 8px 10px;
}
.pairing-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.btn-secondary-sm {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 12px; border-radius: var(--radius-xs); font-size: 12px; font-weight: 600;
  text-decoration: none; color: var(--text); border: 1px solid var(--stroke); background: rgba(255,255,255,.03);
}
.btn-secondary-sm:hover { border-color: var(--stroke-hover); color: var(--primary); }
.pairing-hint { font-size: 12px; color: var(--text-dim); margin-top: 14px; line-height: 1.5; }
@media (max-width: 720px) {
  .pairing-grid { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .pairing-link-row { flex-direction: column; }
}

.badge-status { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 99px; }
.badge-pending { background: rgba(245,166,35,.15); color: var(--amber); }
.badge-sent    { background: rgba(34,197,94,.15); color: var(--green); }
.badge-failed  { background: rgba(255,92,107,.15); color: var(--rose); }

/* ══════════════════════════════════════════════════════
   SMS TABLE
══════════════════════════════════════════════════════ */
.table-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 1px solid var(--stroke); gap: 12px;
}
.search-wrap { position: relative; flex: 1; max-width: 360px; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
               color: var(--text-dim); font-size: 14px; pointer-events: none; }
.search-wrap input { padding-left: 36px; }
.table-meta { font-size: 12px; color: var(--text-dim); flex-shrink: 0; }

.sort-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.sort-controls label { font-size: 11px; color: var(--text-dim); font-weight: 600; white-space: nowrap; }
.sort-controls select {
  background: rgba(255,255,255,.04); border: 1px solid var(--stroke);
  border-radius: var(--radius-xs); color: var(--text-muted);
  font-family: inherit; font-size: 12px; padding: 7px 10px; outline: none; cursor: pointer;
}
.sort-controls select:focus { border-color: var(--primary); color: var(--text); }

.th-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.th-sortable:hover { color: var(--primary); }
.th-sortable.active { color: var(--primary); }
.sort-arrow { font-size: 10px; margin-left: 4px; opacity: .7; }

.sms-table { width: 100%; border-collapse: collapse; }
.sms-table th {
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--text-dim); padding: 12px 20px; text-align: left;
  border-bottom: 1px solid var(--stroke); background: rgba(255,255,255,.02);
}
.sms-table td { padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,.03);
                vertical-align: middle; font-size: 13px; }
.sms-table tr:last-child td { border-bottom: none; }
.sms-table tbody tr { transition: background var(--transition); cursor: default; }
.sms-table tbody tr:hover td { background: rgba(255,255,255,.02); }

.cell-phone { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: grid; place-items: center;
  font-size: 13px; font-weight: 800; color: #fff;
}
.phone-num { font-weight: 700; color: var(--primary); font-size: 13px; }
.phone-num-sub { font-size: 11px; color: var(--text-dim); }

.msg-text { color: var(--text); line-height: 1.5; }
.msg-text.truncate { display: -webkit-box; -webkit-line-clamp: 2;
                     -webkit-box-orient: vertical; overflow: hidden; }

.date-text { color: var(--text-muted); font-size: 12px; white-space: nowrap; }

/* ── Pagination ── */
.pagination {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 20px 24px; border-top: 1px solid var(--stroke);
}
.page-btn {
  min-width: 36px; height: 36px; border-radius: var(--radius-xs);
  border: 1px solid var(--stroke); background: transparent;
  color: var(--text-muted); font-family: 'Inter', sans-serif;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--transition); display: grid; place-items: center;
}
.page-btn:hover   { border-color: var(--primary); color: var(--primary); }
.page-btn.active  { background: var(--primary); border-color: var(--primary);
                    color: #0A0E1A; }
.page-btn:disabled { opacity: .3; cursor: not-allowed; }

/* ── Empty / Loading ── */
.empty-state { text-align: center; padding: 60px 24px; }
.empty-icon  { font-size: 48px; margin-bottom: 16px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); }
.empty-sub   { font-size: 13px; color: var(--text-dim); margin-top: 6px; }

.skeleton { background: linear-gradient(90deg, var(--card), var(--card-hover), var(--card));
            background-size: 200% 100%; animation: shimmer 1.5s infinite;
            border-radius: var(--radius-xs); }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.skeleton-row { display: flex; align-items: center; gap: 14px; padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,.03); }
.sk-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.sk-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.sk-line  { height: 12px; }

/* ══════════════════════════════════════════════════════
   TOASTS
══════════════════════════════════════════════════════ */
.toast-container {
  position: fixed; top: 20px; right: 20px; z-index: 9999;
  display: flex; flex-direction: column; gap: 10px;
  pointer-events: none;
}
.toast {
  padding: 14px 18px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  display: flex; align-items: center; gap: 10px;
  min-width: 260px; max-width: 380px;
  backdrop-filter: blur(16px);
  border: 1px solid;
  animation: slideIn .3s ease;
  pointer-events: all;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}
.toast.success { background: rgba(0,201,177,.12); border-color: rgba(0,201,177,.3);
                 color: var(--primary); }
.toast.error   { background: rgba(255,92,107,.12); border-color: rgba(255,92,107,.3);
                 color: var(--rose); }
.toast.info    { background: rgba(124,115,255,.12); border-color: rgba(124,115,255,.3);
                 color: var(--accent); }
@keyframes slideIn { from { transform: translateX(120%); opacity: 0; }
                     to   { transform: translateX(0);    opacity: 1; } }

/* ══════════════════════════════════════════════════════
   MOBILE NAV (< 1024px)
══════════════════════════════════════════════════════ */
.mobile-topbar {
  display: none;
  position: sticky; top: 0; z-index: 200;
  background: var(--surface);
  border-bottom: 1px solid var(--stroke);
  padding: 14px 20px;
  align-items: center; justify-content: space-between;
}
.mobile-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
.hamburger { background: none; border: none; color: var(--text); cursor: pointer;
             padding: 4px; border-radius: 6px; }
.hamburger:hover { background: var(--card); }

.bottom-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: var(--surface);
  border-top: 1px solid var(--stroke);
  padding: 8px 0 env(safe-area-inset-bottom, 8px);
}
.bottom-nav-inner { display: flex; justify-content: space-around; }
.bottom-nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 20px; border-radius: var(--radius-xs);
  font-size: 10px; font-weight: 600; color: var(--text-dim);
  cursor: pointer; transition: all var(--transition);
  letter-spacing: .04em; text-transform: uppercase;
}
.bottom-nav-item.active { color: var(--primary); }
.bottom-nav-item .bn-icon { font-size: 20px; }

/* Overlay sidebar mobile */
.sidebar-overlay {
  display: none; position: fixed; inset: 0; z-index: 190;
  background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
}

/* ══════════════════════════════════════════════════════
   ANIMATIONS
══════════════════════════════════════════════════════ */
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; transform:scale(1.3); } }
@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity:0; transform:translateY(16px); }
                    to   { opacity:1; transform:translateY(0); } }

.fade-up { animation: fadeUp .4s ease both; }
.fade-up-1 { animation-delay: .05s; }
.fade-up-2 { animation-delay: .10s; }
.fade-up-3 { animation-delay: .15s; }
.fade-up-4 { animation-delay: .20s; }

/* ══════════════════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════════════════ */
@media (max-width: 1280px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .grid-2 { grid-template-columns: 1fr; }
}

@media (max-width: 1024px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); box-shadow: 0 0 60px rgba(0,0,0,.6); }
  .sidebar-overlay { display: block; }
  .main { margin-left: 0; padding-bottom: 70px; }
  .mobile-topbar { display: flex; }
  .topbar { display: none; }
  .bottom-nav { display: block; }
  .content { padding: 20px 16px; }
}

@media (max-width: 640px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .table-toolbar { flex-direction: column; align-items: stretch; }
  .search-wrap { max-width: none; }
  .sort-controls { flex-wrap: wrap; }
  /* Tabela: esconder coluna data no mobile */
  .sms-table .col-date { display: none; }
  .stat-value { font-size: 30px; }
  .content { padding: 16px 12px; }
}

@media (max-width: 380px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div id="app">

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║  TOASTS                              ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
      <span>{{ t.icon }}</span> {{ t.message }}
    </div>
  </div>

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║  MOBILE TOPBAR                       ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <div class="mobile-topbar">
    <div class="mobile-logo">
      <div class="logo-icon">SG</div>
      SMS Gateway
    </div>
    <button class="hamburger" @click="sidebarOpen = !sidebarOpen">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║  SIDEBAR OVERLAY (mobile)            ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

  <div class="app">
    <!-- ╔══════════════════════════════════════╗ -->
    <!-- ║  SIDEBAR                             ║ -->
    <!-- ╚══════════════════════════════════════╝ -->
    <aside :class="['sidebar', {open: sidebarOpen}]">
      <div class="logo">
        <div class="logo-icon">SG</div>
        <div>
          <div class="logo-title">SMS Gateway</div>
          <div class="logo-sub">Dashboard v2.0</div>
        </div>
      </div>

      <div class="nav-section">Principal</div>
      <a :class="['nav-item', {active: activeTab==='dashboard'}]" href="#" @click.prevent="activeTab='dashboard'; sidebarOpen=false">
        <span class="nav-icon">📊</span> Dashboard
      </a>
      <a :class="['nav-item', {active: activeTab==='sms'}]" href="#" @click.prevent="activeTab='sms'; sidebarOpen=false; fetchSms()">
        <span class="nav-icon">📨</span> SMS Recebidos
      </a>
      <a class="nav-item" href="#" @click.prevent="activeTab='sent'; sidebarOpen=false; fetchSent()">
        <span class="nav-icon">📤</span> SMS Enviados
      </a>
      <a class="nav-item" href="#" @click.prevent="activeTab='devices'; sidebarOpen=false; fetchDevices()">
        <span class="nav-icon">📱</span> Dispositivos
      </a>
      <a v-if="canWebhook" :class="['nav-item', {active: activeTab==='webhook'}]" href="#"
         @click.prevent="activeTab='webhook'; sidebarOpen=false; loadWebhook()">
        <span class="nav-icon">🔗</span> Webhook n8n
      </a>
      <a class="nav-item" href="#" @click.prevent="activeTab='api'; sidebarOpen=false">
        <span class="nav-icon">🔑</span> API
      </a>
      <a v-if="isAdmin" :class="['nav-item', {active: activeTab==='users'}]" href="#"
         @click.prevent="activeTab='users'; sidebarOpen=false; fetchUsers()">
        <span class="nav-icon">👥</span> Utilizadores
      </a>

      <a class="nav-item" href="#" @click.prevent="activeTab='app'; sidebarOpen=false; loadApkInfo()">
        <span class="nav-icon">📲</span> App Android
      </a>

      <div class="nav-section">Sistema</div>
      <a class="nav-item" href="logout.php">
        <span class="nav-icon">🚪</span> Sair (<?= htmlspecialchars($sessionUser['name']) ?>)
      </a>
      <a class="nav-item" href="health.php" target="_blank">
        <span class="nav-icon">🩺</span> Health Check
      </a>
      <a class="nav-item" href="http://localhost:8080" target="_blank">
        <span class="nav-icon">🗄️</span> phpMyAdmin
      </a>

      <div class="sidebar-footer">
        <div class="status-badge">
          <div class="status-dot"></div>
          Servidor Ativo
        </div>
        <div class="server-info" v-if="stats.server_time">
          🕐 {{ stats.server_time }}<br>
          📡 <?= htmlspecialchars($appBaseUrl) ?>
        </div>
      </div>
    </aside>

    <!-- ╔══════════════════════════════════════╗ -->
    <!-- ║  MAIN                                ║ -->
    <!-- ╚══════════════════════════════════════╝ -->
    <main class="main">

      <!-- Desktop Topbar -->
      <div class="topbar">
        <div class="topbar-title">
          <h1>Dashboard</h1>
          <p>Gestão de mensagens em tempo real</p>
        </div>
        <div class="topbar-actions">
          <div class="time-badge" v-if="stats.server_time">🕐 {{ stats.server_time }}</div>
          <button :class="['btn-refresh', {spin: refreshing}]" @click="refreshAll">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      <div class="content">

        <!-- ══════════════ DASHBOARD TAB ══════════════ -->
        <div v-show="activeTab === 'dashboard'">

        <div class="stats-grid">
          <div class="stat-card fade-up" style="--accent-color: var(--primary)">
            <div class="stat-label">Total SMS</div>
            <div class="stat-value">{{ animatedTotal }}</div>
            <div class="stat-sub">Todos os registos</div>
            <div class="stat-icon">📨</div>
          </div>
          <div class="stat-card fade-up fade-up-1" style="--accent-color: var(--amber)">
            <div class="stat-label">SMS Hoje</div>
            <div class="stat-value">{{ animatedToday }}</div>
            <div class="stat-sub">{{ todayDate }}</div>
            <div class="stat-icon">📅</div>
          </div>
          <div class="stat-card fade-up fade-up-2" style="--accent-color: var(--accent)">
            <div class="stat-label">Números únicos</div>
            <div class="stat-value">{{ animatedUnique }}</div>
            <div class="stat-sub">Remetentes distintos</div>
            <div class="stat-icon">👥</div>
          </div>
          <div class="stat-card fade-up fade-up-3" style="--accent-color: var(--green)">
            <div class="stat-label">Dispositivos</div>
            <div class="stat-value">{{ stats.total_devices ?? 0 }}</div>
            <div class="stat-sub">Registados</div>
            <div class="stat-icon">📱</div>
          </div>
        </div>

        <!-- ══════════════ COMPOSE + RECENT ══════════════ -->
        <div class="grid-2 fade-up fade-up-4">

          <!-- Compose SMS -->
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">✉️ &nbsp;Enviar SMS</span>
            </div>
            <div class="panel-body">
              <div v-if="stats.queue_pending > 0 || !stats.device_online" class="queue-banner" :class="stats.device_online ? 'banner-warn' : 'banner-error'">
                <span v-if="!stats.device_online">📵 Telefone offline — abra o app SMSGateway no Android (mesma WiFi)</span>
                <span v-else-if="stats.queue_pending > 0">⏳ {{ stats.queue_pending }} SMS na fila — a enviar pelo telefone...</span>
              </div>
              <div v-else-if="stats.device_online" class="queue-banner banner-ok">📱 Telefone online — envio automático activo</div>
              <div class="form-row">
                <div class="form-group">
                  <label>Número de destino</label>
                  <input type="tel" v-model="form.phone" placeholder="+351 912 345 678" />
                </div>
                <div class="form-group">
                  <label>Via dispositivo</label>
                  <input type="text" :value="stats.device_online ? 'Gateway Android (online)' : 'Gateway Android (offline)'" disabled />
                </div>
                <div class="form-group full">
                  <label>Mensagem</label>
                  <textarea v-model="form.msg" :placeholder="'Escreva a mensagem aqui...'" :maxlength="160"></textarea>
                  <div class="char-count">{{ form.msg.length }}/160</div>
                </div>
              </div>
              <div class="btn-row">
                <button class="btn-primary" @click="sendSms" :disabled="sending || !form.phone || !form.msg">
                  <span v-if="sending">⏳</span><span v-else>⬆</span>
                  {{ sending ? 'A enviar...' : 'Enviar SMS' }}
                </button>
              </div>
            </div>
          </div>

          <!-- SMS recentes -->
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">🕐 &nbsp;SMS Recentes</span>
              <span class="panel-badge">{{ stats.total_sms ?? 0 }} total</span>
            </div>
            <div v-if="statsLoading">
              <div class="skeleton-row" v-for="n in 4" :key="n">
                <div class="skeleton sk-avatar"></div>
                <div class="sk-lines">
                  <div class="skeleton sk-line" :style="{width: (50+n*10)+'%'}"></div>
                  <div class="skeleton sk-line" style="width:80%"></div>
                </div>
              </div>
            </div>
            <div v-else-if="stats.recent && stats.recent.length">
              <table class="sms-table">
                <tbody>
                  <tr v-for="s in stats.recent" :key="s.id">
                    <td style="width:44px; padding: 12px 8px 12px 20px;">
                      <div class="avatar">{{ getInitial(s.phone_num) }}</div>
                    </td>
                    <td>
                      <div class="phone-num">{{ s.phone_num }}</div>
                      <div class="msg-text truncate" style="font-size:12px; color: var(--text-muted); margin-top:2px">{{ s.message }}</div>
                    </td>
                    <td class="date-text" style="padding-right:20px; white-space:nowrap; font-size:11px">{{ formatDate(s.record_stamp || s.datestamp) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state" style="padding: 32px;">
              <div class="empty-icon">📭</div>
              <div class="empty-title">Nenhum SMS ainda</div>
            </div>
          </div>
        </div>

        <!-- ══════════════ FULL SMS TABLE ══════════════ -->
        <div class="panel fade-up">
          <div class="panel-head">
            <span class="panel-title">📥 &nbsp;Todos os SMS</span>
            <span class="panel-badge">{{ smsData.total ?? 0 }} mensagens</span>
          </div>

          <div class="table-toolbar">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" v-model="searchQuery" @input="debouncedSearch"
                     placeholder="Pesquisar número ou mensagem..." />
            </div>
            <div class="sort-controls">
              <label>Ordenar</label>
              <select v-model="sortOrder" @change="applySort">
                <option value="desc">Mais recentes primeiro</option>
                <option value="asc">Mais antigos primeiro</option>
              </select>
              <select v-model="sortBy" @change="applySort">
                <option value="received">Por receção</option>
                <option value="date">Por data SMS</option>
                <option value="phone">Por remetente</option>
              </select>
            </div>
            <div class="table-meta">
              Página {{ smsData.page ?? 1 }} de {{ smsData.pages ?? 1 }}
            </div>
          </div>

          <!-- Loading skeletons -->
          <div v-if="smsLoading">
            <div class="skeleton-row" v-for="n in 8" :key="n">
              <div class="skeleton sk-avatar"></div>
              <div class="sk-lines">
                <div class="skeleton sk-line" :style="{width: (40+n*5)+'%'}"></div>
                <div class="skeleton sk-line" style="width:70%"></div>
              </div>
            </div>
          </div>

          <!-- Table -->
          <div v-else-if="smsData.data && smsData.data.length" style="overflow-x:auto">
            <table class="sms-table">
              <thead>
                <tr>
                  <th class="th-sortable" :class="{active: sortBy === 'phone'}" style="width:200px"
                      @click="toggleSort('phone')">
                    Remetente<span class="sort-arrow" v-if="sortBy === 'phone'">{{ sortOrder === 'desc' ? '▼' : '▲' }}</span>
                  </th>
                  <th>Mensagem</th>
                  <th class="col-date th-sortable" :class="{active: sortBy === 'received' || sortBy === 'date'}" style="width:160px"
                      @click="toggleSort(sortBy === 'date' ? 'date' : 'received')">
                    {{ sortBy === 'date' ? 'Data SMS' : 'Recebido' }}<span class="sort-arrow" v-if="sortBy === 'received' || sortBy === 'date'">{{ sortOrder === 'desc' ? '▼' : '▲' }}</span>
                  </th>
                  <th v-if="canWebhook" style="width:120px">Webhook</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in smsData.data" :key="s.id">
                  <td>
                    <div class="cell-phone">
                      <div class="avatar">{{ getInitial(s.phone_num) }}</div>
                      <div>
                        <div class="phone-num">{{ s.phone_num }}</div>
                      </div>
                    </div>
                  </td>
                  <td><div class="msg-text truncate">{{ s.message }}</div></td>
                  <td class="col-date">
                    <div class="date-text">{{ formatDate(sortBy === 'date' ? s.datestamp : (s.record_stamp || s.datestamp)) }}</div>
                  </td>
                  <td v-if="canWebhook">
                    <button class="page-btn" @click="forwardSms(s.id)" :disabled="forwardingId === s.id" title="Reenviar para n8n">
                      {{ forwardingId === s.id ? '…' : '↗' }}
                    </button>
                    <span v-if="s.webhook_last_status" :class="'badge-status badge-' + (s.webhook_last_status === 'sent' ? 'sent' : 'failed')" style="margin-left:4px;font-size:10px">
                      {{ s.webhook_last_status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty -->
          <div v-else class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Nenhum resultado</div>
            <div class="empty-sub">Tente uma pesquisa diferente</div>
          </div>

          <!-- Pagination -->
          <div class="pagination" v-if="smsData.pages > 1">
            <button class="page-btn" @click="goPage(smsData.page - 1)" :disabled="smsData.page <= 1">‹</button>
            <button v-for="p in visiblePages" :key="p"
                    :class="['page-btn', { active: p === smsData.page }]"
                    @click="goPage(p)">{{ p }}</button>
            <button class="page-btn" @click="goPage(smsData.page + 1)" :disabled="smsData.page >= smsData.pages">›</button>
          </div>
        </div>
        </div><!-- /dashboard tab -->

        <!-- ══════════════ SMS ENVIADOS TAB ══════════════ -->
        <div v-show="activeTab === 'sent'" class="panel">
          <div class="panel-head">
            <span class="panel-title">📤 SMS Enviados</span>
            <span class="panel-badge">{{ sentData.total ?? 0 }} mensagens</span>
          </div>
          <div class="table-toolbar">
            <div class="sort-controls">
              <label>Estado</label>
              <select v-model="sentFilter" @change="fetchSent(1)">
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="sent">Enviados</option>
                <option value="failed">Falhados</option>
              </select>
            </div>
          </div>
          <div v-if="sentLoading"><div class="skeleton-row" v-for="n in 6" :key="n"><div class="skeleton sk-avatar"></div><div class="sk-lines"><div class="skeleton sk-line" style="width:60%"></div></div></div></div>
          <div v-else-if="sentData.data?.length" style="overflow-x:auto">
            <table class="sms-table">
              <thead><tr><th>Destino</th><th>Mensagem</th><th>Estado</th><th>Data</th></tr></thead>
              <tbody>
                <tr v-for="s in sentData.data" :key="s.id">
                  <td><div class="phone-num">{{ s.phone }}</div></td>
                  <td><div class="msg-text truncate">{{ s.message }}</div></td>
                  <td><span :class="'badge-status badge-'+s.status">{{ s.status }}</span></td>
                  <td class="date-text">{{ formatDate(s.sent_at || s.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state"><div class="empty-icon">📤</div><div class="empty-title">Nenhum SMS enviado</div></div>
          <div class="pagination" v-if="sentData.pages > 1">
            <button class="page-btn" @click="fetchSent(sentData.page - 1)" :disabled="sentData.page <= 1">‹</button>
            <button class="page-btn active">{{ sentData.page }}</button>
            <button class="page-btn" @click="fetchSent(sentData.page + 1)" :disabled="sentData.page >= sentData.pages">›</button>
          </div>
        </div>

        <!-- ══════════════ DISPOSITIVOS TAB ══════════════ -->
        <div v-show="activeTab === 'devices'">
          <div class="panel" style="margin-bottom:20px">
            <div class="panel-head"><span class="panel-title">📱 Registar dispositivo</span></div>
            <div class="panel-body">
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
                Gere um QR code ou link — o telefone liga-se automaticamente à sua conta.
                <a href="download.php" style="color:var(--primary)">Descarregar APK (painel)</a>
              </p>
              <div class="form-row">
                <div class="form-group"><label>Nome</label><input type="text" v-model="pairForm.name" placeholder="Galaxy S21 Plus" /></div>
                <div class="form-group"><label>Número SIM</label><input type="tel" v-model="pairForm.phone" placeholder="+34 620 047 118" /></div>
              </div>
              <div class="btn-row">
                <button class="btn-primary" @click="createPairing" :disabled="pairingLoading">
                  {{ pairingLoading ? 'A gerar...' : 'Gerar QR / link de pareamento' }}
                </button>
              </div>

              <div v-if="pairingInfo.code" class="pairing-box">
                <div class="pairing-grid">
                  <div class="pairing-qr-wrap">
                    <canvas ref="pairingQrCanvas" width="200" height="200" aria-label="QR code de pareamento"></canvas>
                  </div>
                  <div class="pairing-meta">
                    <p class="pairing-label">Código manual (fallback)</p>
                    <p class="pairing-code">{{ pairingInfo.code }}</p>
                    <p class="pairing-expiry" v-if="pairingCountdown > 0">Expira em {{ formatCountdown(pairingCountdown) }}</p>
                    <p class="pairing-expiry pairing-expired" v-else>Expirado — gere um novo código</p>

                    <p class="pairing-label" style="margin-top:14px">Link de pareamento</p>
                    <div class="pairing-link-row">
                      <input type="text" class="pairing-link-input" :value="pairingInfo.url" readonly @focus="$event.target.select()" />
                      <button class="page-btn" @click="copyPairingLink" title="Copiar link">📋</button>
                    </div>

                    <div class="pairing-actions">
                      <a :href="pairingInfo.url" target="_blank" rel="noopener" class="btn-secondary-sm">Abrir página</a>
                      <a v-if="pairingInfo.apk_url" :href="pairingInfo.apk_url" class="btn-secondary-sm">APK via link</a>
                    </div>

                    <p class="pairing-hint">No telefone: leia o QR ou abra o link → descarregue o APK (se necessário) → a app regista-se sozinha.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="panel-title">Dispositivos activos</span></div>
            <div v-if="devicesLoading" class="panel-body">A carregar...</div>
            <div v-else-if="devices.length" style="overflow-x:auto">
              <table class="sms-table">
                <thead><tr><th>Nome</th><th>Número</th><th>Estado</th><th>Último contacto</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="d in devices" :key="d.id">
                    <td>{{ d.device_name }}</td>
                    <td class="phone-num">{{ d.phone_number || '—' }}</td>
                    <td><span :class="d.online == 1 ? 'badge-status badge-sent' : 'badge-status badge-failed'">{{ d.online == 1 ? 'online' : 'offline' }}</span></td>
                    <td class="date-text">{{ d.last_seen ? formatDate(d.last_seen) : '—' }}</td>
                    <td><button class="page-btn" @click="deleteDevice(d.id)" title="Desactivar">✕</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state"><div class="empty-icon">📱</div><div class="empty-title">Nenhum dispositivo registado</div></div>
          </div>
        </div>

        <!-- ══════════════ UTILIZADORES TAB (admin) ══════════════ -->
        <div v-show="activeTab === 'users' && isAdmin">
          <div class="panel" style="margin-bottom:20px">
            <div class="panel-head"><span class="panel-title">👤 Criar utilizador</span></div>
            <div class="panel-body">
              <div class="form-row">
                <div class="form-group"><label>Nome</label><input type="text" v-model="userForm.name" placeholder="João Silva" /></div>
                <div class="form-group"><label>Email</label><input type="email" v-model="userForm.email" placeholder="joao@empresa.com" /></div>
                <div class="form-group"><label>Palavra-passe</label><input type="password" v-model="userForm.password" placeholder="Mín. 6 caracteres" /></div>
                <div class="form-group">
                  <label>Perfil</label>
                  <select v-model="userForm.role">
                    <option value="user">Utilizador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">Novos utilizadores ficam <strong>inactivos</strong> até os activar na tabela abaixo.</p>
              <div class="btn-row">
                <button class="btn-primary" @click="createUser" :disabled="creatingUser">
                  {{ creatingUser ? 'A criar...' : 'Criar utilizador' }}
                </button>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">👥 Contas registadas</span>
              <span class="panel-badge">{{ usersList.length }} utilizadores</span>
            </div>
            <div v-if="usersLoading" class="panel-body">A carregar...</div>
            <div v-else style="overflow-x:auto">
              <table class="sms-table">
                <thead>
                  <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Estado</th><th>Webhook</th><th>Dispositivos</th><th>SMS</th><th>Registo</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="u in usersList" :key="u.id">
                    <td>{{ u.name }}</td>
                    <td>{{ u.email }}</td>
                    <td><span :class="'badge-status badge-' + (u.role === 'admin' ? 'sent' : 'pending')">{{ u.role }}</span></td>
                    <td><span :class="'badge-status badge-' + (u.is_active == 1 ? 'sent' : 'failed')">{{ u.is_active == 1 ? 'activo' : 'inactivo' }}</span></td>
                    <td>
                      <template v-if="u.role === 'user'">
                        <span :class="'badge-status badge-' + (u.webhook_enabled == 1 ? 'sent' : 'failed')">{{ u.webhook_enabled == 1 ? 'activo' : 'inactivo' }}</span>
                        <button v-if="u.webhook_enabled != 1" class="page-btn" @click="toggleWebhookProfile(u.id, 1)" title="Activar webhook">✓</button>
                        <button v-else class="page-btn" @click="toggleWebhookProfile(u.id, 0)" title="Desactivar webhook">✕</button>
                      </template>
                      <span v-else class="date-text">—</span>
                    </td>
                    <td>{{ u.devices }}</td>
                    <td>{{ u.sms_count }}</td>
                    <td class="date-text">{{ formatDate(u.created_at) }}</td>
                    <td>
                      <button v-if="u.is_active != 1" class="page-btn" @click="toggleUser(u.id, 1)" title="Activar">✓</button>
                      <button v-else-if="u.id != currentUserId" class="page-btn" @click="toggleUser(u.id, 0)" title="Desactivar">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ══════════════ APP ANDROID TAB ══════════════ -->
        <div v-show="activeTab === 'app'" class="panel">
          <div class="panel-head"><span class="panel-title">📲 App Android</span></div>
          <div class="panel-body" style="text-align:center;padding:40px 24px">
            <div style="font-size:64px;margin-bottom:16px">📱</div>
            <h2 style="font-size:20px;margin-bottom:8px">SMSGateway v3.0</h2>
            <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px;max-width:400px;margin-left:auto;margin-right:auto">
              Instale o app no telefone Android, depois registe-o na aba <strong>Dispositivos</strong> com o código de pareamento.
            </p>
            <div v-if="apkInfo.available" style="margin-bottom:20px;font-size:13px;color:var(--text-dim)">
              {{ apkInfo.size_human }} · Actualizado {{ apkInfo.updated_at }}
            </div>
            <a v-if="apkInfo.available" href="download.php" class="btn-primary" style="display:inline-flex;text-decoration:none;padding:14px 32px">
              ⬇ Descarregar APK
            </a>
            <p v-else style="color:var(--rose)">APK não disponível no servidor.</p>
          </div>
        </div>

        <!-- ══════════════ WEBHOOK TAB ══════════════ -->
        <div v-show="activeTab === 'webhook' && canWebhook" class="panel">
          <div class="panel-head"><span class="panel-title">🔗 Webhook n8n</span></div>
          <div class="panel-body">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
              Reenvie SMS recebidos para o seu fluxo n8n. O header <code style="color:var(--primary)">X-Api-Key</code> é enviado com a API key configurada.
            </p>
            <div class="form-row">
              <div class="form-group full">
                <label>URL do Webhook n8n</label>
                <input type="url" v-model="webhookForm.url" placeholder="https://n8n.seudominio.com/webhook/..." />
              </div>
              <div class="form-group full">
                <label>API Key (enviada no header X-Api-Key)</label>
                <input type="text" v-model="webhookForm.api_key" :placeholder="webhookForm.api_key_masked || 'Chave secreta do webhook'" />
              </div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:12px 0 20px;cursor:pointer">
              <input type="checkbox" v-model="webhookForm.auto" style="width:auto" />
              Reenviar automaticamente quando um SMS chega ao dispositivo
            </label>
            <div class="btn-row">
              <button class="btn-primary" @click="saveWebhook" :disabled="savingWebhook">
                {{ savingWebhook ? 'A guardar...' : 'Guardar configuração' }}
              </button>
              <button class="btn-refresh" @click="testWebhook" :disabled="testingWebhook">
                {{ testingWebhook ? 'A testar...' : 'Testar webhook' }}
              </button>
            </div>
            <div style="margin-top:20px;background:rgba(0,0,0,.25);border-radius:12px;padding:16px;font-family:monospace;font-size:12px;line-height:1.8;color:var(--text-muted)">
              <div><strong style="color:var(--text)">Payload JSON (POST)</strong></div>
              <div>{ "event": "sms_received", "sms_id": 1, "phone": "+351...", "message": "...", ... }</div>
              <div style="margin-top:8px"><strong style="color:var(--text)">Reenvio manual</strong> — botão ↗ na tabela de SMS recebidos (event: sms_forward)</div>
            </div>
          </div>
        </div>

        <!-- ══════════════ API TAB ══════════════ -->
        <div v-show="activeTab === 'api'" class="panel">
          <div class="panel-head"><span class="panel-title">🔑 API REST</span></div>
          <div class="panel-body">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Use a API key para enviar SMS e consultar o estado de entrega.</p>
            <label style="font-size:12px;color:var(--text-muted)">A sua API Key</label>
            <div style="display:flex;gap:10px;margin:8px 0 20px">
              <input type="text" :value="apiKey" readonly style="flex:1;font-family:monospace;font-size:12px" />
              <button class="btn-primary" @click="copyApiKey" style="margin:0">Copiar</button>
              <button class="btn-refresh" @click="regenApiKey">Regenerar</button>
            </div>
            <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:16px;font-family:monospace;font-size:12px;line-height:1.8;color:var(--text-muted)">
              <div><span style="color:var(--primary)">POST</span> /api_v1.php?action=send&api_key=<em>KEY</em>&phone=<em>NUM</em>&msg=<em>TEXT</em></div>
              <div style="margin-top:8px"><span style="color:var(--primary)">GET</span>  /api_v1.php?action=status&api_key=<em>KEY</em>&id=<em>ID</em></div>
              <div style="margin-top:12px;color:var(--text-dim)">Resposta send: {"status":"queued","id":123}</div>
              <div style="color:var(--text-dim)">Resposta status: {"delivery":"sent","delivered":true,...}</div>
            </div>
          </div>
        </div>

      </div><!-- /content -->
    </main>
  </div><!-- /app -->

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║  BOTTOM NAVIGATION (mobile)          ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <div class="bottom-nav">
    <div class="bottom-nav-inner">
      <div class="bottom-nav-item active">
        <span class="bn-icon">📊</span> Stats
      </div>
      <div class="bottom-nav-item" @click="scrollToTable">
        <span class="bn-icon">📨</span> SMS
      </div>
      <div class="bottom-nav-item" @click="scrollToCompose">
        <span class="bn-icon">✉️</span> Enviar
      </div>
    </div>
  </div>

</div><!-- /#app -->

<script src="https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js"></script>
<script src="https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js"></script>
<script>
const { createApp, ref, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

createApp({
  setup() {
    /* ── State ─────────────────────────────────────────── */
    const stats        = ref({});
    const smsData      = ref({ data: [], total: 0, page: 1, pages: 1 });
    const statsLoading = ref(true);
    const smsLoading   = ref(true);
    const refreshing   = ref(false);
    const sending      = ref(false);
    const sidebarOpen  = ref(false);
    const searchQuery  = ref('');
    const activeTab    = ref('dashboard');
    const toasts       = ref([]);
    let searchTimer    = null;
    let refreshTimer   = null;
    let toastId        = 0;

    /* Animated counters */
    const animatedTotal  = ref(0);
    const animatedToday  = ref(0);
    const animatedUnique = ref(0);

    const form = ref({ phone: '', msg: '' });
    const sortBy    = ref('received');
    const sortOrder = ref('desc');
    const sentData      = ref({ data: [], total: 0, page: 1, pages: 1 });
    const sentLoading   = ref(false);
    const sentFilter    = ref('all');
    const devices       = ref([]);
    const devicesLoading= ref(false);
    const pairForm         = ref({ name: 'Android', phone: '' });
    const pairingInfo      = ref({ code: '', url: '', apk_url: '', expires_in: 0 });
    const pairingLoading   = ref(false);
    const pairingCountdown = ref(0);
    const pairingQrCanvas  = ref(null);
    let pairingTimer       = null;
    const apiKey        = ref('');
    const isAdmin       = ref(false);
    const canWebhook    = ref(false);
    const webhookForm   = ref({ url: '', api_key: '', api_key_masked: '', auto: false });
    const savingWebhook = ref(false);
    const testingWebhook= ref(false);
    const forwardingId  = ref(0);
    const usersList     = ref([]);
    const usersLoading  = ref(false);
    const creatingUser  = ref(false);
    const userForm      = ref({ name: '', email: '', password: '', role: 'user' });
    const currentUserId = ref(<?= (int)$sessionUser['id'] ?>);
    const apkInfo       = ref({ available: false, size_human: '', updated_at: '' });

    const fetchOpts = { credentials: 'include' };

    /* ── Computed ──────────────────────────────────────── */
    const todayDate = computed(() => new Date().toLocaleDateString('pt-PT'));

    const visiblePages = computed(() => {
      const cur  = smsData.value.page;
      const max  = smsData.value.pages;
      const delta = 2;
      const pages = [];
      for (let i = Math.max(1, cur - delta); i <= Math.min(max, cur + delta); i++) pages.push(i);
      return pages;
    });

    /* ── Helpers ───────────────────────────────────────── */
    function getInitial(phone) {
      if (!phone) return '?';
      const clean = phone.replace(/\D/g, '');
      return clean ? clean.slice(-1).toUpperCase() : phone[0].toUpperCase();
    }

    function formatDate(d) {
      if (!d) return '—';
      try {
        const dt = new Date(d.replace(' ', 'T'));
        return dt.toLocaleDateString('pt-PT') + ' ' + dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      } catch { return d; }
    }

    function addToast(message, type = 'info', icon = 'ℹ️') {
      const id = ++toastId;
      toasts.value.push({ id, message, type, icon });
      setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3500);
    }

    function animateCount(refVal, target, duration = 800) {
      const start = refVal.value;
      const diff  = target - start;
      if (diff === 0) return;
      const startTime = performance.now();
      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        refVal.value = Math.round(start + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* ── API Calls ─────────────────────────────────────── */
    async function loadMe() {
      try {
        const r = await fetch('api.php?action=me', fetchOpts);
        const d = await r.json();
        if (d.user) {
          apiKey.value = d.user.api_key || '';
          isAdmin.value = !!d.user.is_admin;
          canWebhook.value = !!d.user.can_webhook;
          webhookForm.value.url = d.user.webhook_url || '';
          webhookForm.value.api_key_masked = d.user.webhook_api_key || '';
          webhookForm.value.auto = !!d.user.webhook_auto;
        }
      } catch (e) {}
    }

    async function fetchUsers() {
      if (!isAdmin.value) return;
      usersLoading.value = true;
      try {
        const r = await fetch('api.php?action=users', fetchOpts);
        const d = await r.json();
        if (d.status === 'error') addToast(d.message, 'error', '❌');
        else usersList.value = d.data || [];
      } catch (e) { addToast('Erro ao carregar utilizadores', 'error', '❌'); }
      finally { usersLoading.value = false; }
    }

    async function toggleWebhookProfile(id, enabled) {
      const action = enabled ? 'activar' : 'desactivar';
      if (!confirm(`Confirma ${action} o perfil webhook deste utilizador?`)) return;
      try {
        const r = await fetch(`api.php?action=toggle_webhook_profile&id=${id}&enabled=${enabled}`, fetchOpts);
        const d = await r.json();
        if (d.status === 'success') { addToast(d.message, 'success', '✅'); fetchUsers(); }
        else addToast(d.message || 'Erro', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
    }

    async function loadWebhook() {
      if (!canWebhook.value) return;
      try {
        const r = await fetch('api.php?action=webhook_settings', fetchOpts);
        const d = await r.json();
        if (d.data) {
          webhookForm.value.url = d.data.webhook_url || '';
          webhookForm.value.api_key_masked = d.data.webhook_api_key || '';
          webhookForm.value.auto = !!d.data.webhook_auto;
        }
      } catch (e) {}
    }

    async function saveWebhook() {
      savingWebhook.value = true;
      try {
        const body = new URLSearchParams({
          webhook_url: webhookForm.value.url,
          webhook_api_key: webhookForm.value.api_key || '',
          webhook_auto: webhookForm.value.auto ? '1' : '0',
        });
        const r = await fetch('api.php?action=save_webhook', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const d = await r.json();
        if (d.status === 'success') {
          addToast(d.message, 'success', '✅');
          webhookForm.value.api_key = '';
          loadMe();
        } else addToast(d.message || 'Erro', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { savingWebhook.value = false; }
    }

    async function testWebhook() {
      testingWebhook.value = true;
      try {
        const r = await fetch('api.php?action=test_webhook', { method: 'POST', credentials: 'include' });
        const d = await r.json();
        if (d.status === 'success') addToast(d.message, 'success', '✅');
        else addToast(d.message || 'Falha no teste', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { testingWebhook.value = false; }
    }

    async function forwardSms(id) {
      forwardingId.value = id;
      try {
        const r = await fetch(`api.php?action=forward_webhook&id=${id}`, { method: 'POST', credentials: 'include' });
        const d = await r.json();
        if (d.status === 'success') {
          addToast(d.message, 'success', '✅');
          fetchSms(smsData.value.page);
        } else addToast(d.message || 'Erro ao reenviar', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { forwardingId.value = 0; }
    }

    async function toggleUser(id, active) {
      const action = active ? 'activar' : 'desactivar';
      if (!confirm(`Confirma ${action} este utilizador?`)) return;
      try {
        const r = await fetch(`api.php?action=toggle_user&id=${id}&active=${active}`, fetchOpts);
        const d = await r.json();
        if (d.status === 'success') { addToast(d.message, 'success', '✅'); fetchUsers(); }
        else addToast(d.message || 'Erro', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
    }

    async function loadApkInfo() {
      try {
        const r = await fetch('apk_info.php', fetchOpts);
        const d = await r.json();
        if (d.status === 'success') apkInfo.value = d;
      } catch (e) {}
    }

    async function createUser() {
      if (!userForm.value.name || !userForm.value.email || !userForm.value.password) {
        addToast('Preencha todos os campos', 'error', '❌'); return;
      }
      creatingUser.value = true;
      try {
        const body = new URLSearchParams(userForm.value);
        const r = await fetch('api.php?action=create_user', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const d = await r.json();
        if (d.status === 'success') {
          addToast(d.message, 'success', '✅');
          userForm.value = { name: '', email: '', password: '', role: 'user' };
          fetchUsers();
        } else addToast(d.message || 'Erro', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { creatingUser.value = false; }
    }

    async function fetchStats() {
      statsLoading.value = true;
      try {
        const r = await fetch('api.php?action=stats', fetchOpts);
        const d = await r.json();
        const old = { ...stats.value };
        stats.value = d;
        animateCount(animatedTotal,  d.total_sms     ?? 0);
        animateCount(animatedToday,  d.today_sms     ?? 0);
        animateCount(animatedUnique, d.unique_numbers ?? 0);
      } catch (e) { addToast('Erro ao carregar estatísticas', 'error', '❌'); }
      finally { statsLoading.value = false; }
    }

    async function fetchSms(page = 1) {
      smsLoading.value = true;
      const q = searchQuery.value.trim();
      try {
        const url = `api.php?action=sms&page=${page}&limit=20&sort_by=${sortBy.value}&order=${sortOrder.value}${q ? '&q=' + encodeURIComponent(q) : ''}`;
        const r = await fetch(url, fetchOpts);
        smsData.value = await r.json();
      } catch (e) { addToast('Erro ao carregar SMS', 'error', '❌'); }
      finally { smsLoading.value = false; }
    }

    async function fetchSent(page = 1) {
      sentLoading.value = true;
      try {
        const url = `api.php?action=sent&page=${page}&limit=20&status=${sentFilter.value}`;
        const r = await fetch(url, fetchOpts);
        sentData.value = await r.json();
      } catch (e) { addToast('Erro ao carregar enviados', 'error', '❌'); }
      finally { sentLoading.value = false; }
    }

    async function fetchDevices() {
      devicesLoading.value = true;
      try {
        const r = await fetch('api.php?action=devices', fetchOpts);
        const d = await r.json();
        devices.value = d.data || [];
      } catch (e) { addToast('Erro ao carregar dispositivos', 'error', '❌'); }
      finally { devicesLoading.value = false; }
    }

    function clearPairingTimer() {
      if (pairingTimer) {
        clearInterval(pairingTimer);
        pairingTimer = null;
      }
    }

    function startPairingCountdown(seconds) {
      clearPairingTimer();
      pairingCountdown.value = Math.max(0, parseInt(seconds, 10) || 0);
      if (pairingCountdown.value <= 0) return;
      pairingTimer = setInterval(() => {
        if (pairingCountdown.value > 0) pairingCountdown.value -= 1;
        else clearPairingTimer();
      }, 1000);
    }

    function formatCountdown(total) {
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    async function renderPairingQr(url) {
      await nextTick();
      const canvas = pairingQrCanvas.value;
      if (!canvas || !url || typeof QRCode === 'undefined') return;
      try {
        await QRCode.toCanvas(canvas, url, {
          width: 200,
          margin: 1,
          color: { dark: '#0A0E1A', light: '#FFFFFF' },
        });
      } catch (e) {
        addToast('Não foi possível gerar o QR code', 'error', '❌');
      }
    }

    function copyPairingLink() {
      if (!pairingInfo.value.url) return;
      navigator.clipboard.writeText(pairingInfo.value.url);
      addToast('Link de pareamento copiado', 'success', '📋');
    }

    async function createPairing() {
      pairingLoading.value = true;
      const url = `api.php?action=create_pairing&device_name=${encodeURIComponent(pairForm.value.name)}&phone_number=${encodeURIComponent(pairForm.value.phone)}`;
      try {
        const r = await fetch(url, fetchOpts);
        const d = await r.json();
        if (d.pairing_code) {
          pairingInfo.value = {
            code: d.pairing_code,
            url: d.pairing_url || '',
            apk_url: d.apk_url || '',
            expires_in: d.expires_in || 1800,
          };
          startPairingCountdown(pairingInfo.value.expires_in);
          await renderPairingQr(pairingInfo.value.url);
          addToast('QR gerado! Leia com o telefone para ligar automaticamente.', 'success', '✅');
          fetchDevices();
        } else addToast(d.message || 'Erro', 'error', '❌');
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { pairingLoading.value = false; }
    }

    async function deleteDevice(id) {
      if (!confirm('Desactivar este dispositivo?')) return;
      await fetch(`api.php?action=delete_device&id=${id}`, fetchOpts);
      fetchDevices();
      addToast('Dispositivo desactivado', 'info', '📱');
    }

    function copyApiKey() {
      navigator.clipboard.writeText(apiKey.value);
      addToast('API key copiada', 'success', '📋');
    }

    async function regenApiKey() {
      if (!confirm('Regenerar API key? Integrações existentes deixarão de funcionar.')) return;
      const r = await fetch('api.php?action=regenerate_api_key', fetchOpts);
      const d = await r.json();
      if (d.api_key) { apiKey.value = d.api_key; addToast('Nova API key gerada', 'success', '🔑'); }
    }

    function applySort() {
      fetchSms(1);
    }

    function toggleSort(column) {
      if (sortBy.value === column) {
        sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
      } else {
        sortBy.value = column;
        sortOrder.value = column === 'phone' ? 'asc' : 'desc';
      }
      fetchSms(1);
    }

    async function sendSms() {
      if (!form.value.phone || !form.value.msg) return;
      sending.value = true;
      try {
        const url = `api.php?action=send&phone=${encodeURIComponent(form.value.phone)}&msg=${encodeURIComponent(form.value.msg)}`;
        const r = await fetch(url, fetchOpts);
        const d = await r.json();
        if (d.status === 'warning') {
          addToast(d.message, 'info', '⚠️');
        } else if (d.status === 'error') {
          addToast(d.message, 'error', '❌');
        } else {
          addToast(d.message || 'SMS adicionado à fila!', 'success', '📤');
          form.value = { phone: '', msg: '' };
          fetchStats();
        }
      } catch (e) { addToast('Erro de rede', 'error', '❌'); }
      finally { sending.value = false; }
    }

    async function refreshAll() {
      refreshing.value = true;
      await Promise.all([fetchStats(), fetchSms(smsData.value.page)]);
      refreshing.value = false;
      addToast('Dados atualizados', 'success', '✅');
    }

    function debouncedSearch() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => fetchSms(1), 400);
    }

    function goPage(p) {
      if (p < 1 || p > smsData.value.pages) return;
      fetchSms(p);
    }

    function scrollToTable()   { document.querySelector('.sms-table')?.closest('.panel')?.scrollIntoView({ behavior: 'smooth' }); }
    function scrollToCompose() { document.querySelector('.form-row')?.scrollIntoView({ behavior: 'smooth' }); }

    /* ── Lifecycle ─────────────────────────────────────── */
    onMounted(() => {
      loadMe();
      fetchStats();
      fetchSms(1);
      refreshTimer = setInterval(fetchStats, 30000);
    });

    onUnmounted(() => {
      clearInterval(refreshTimer);
      clearPairingTimer();
    });

    return {
      stats, smsData, statsLoading, smsLoading, refreshing, sending,
      sidebarOpen, searchQuery, activeTab, toasts, form, sortBy, sortOrder,
      sentData, sentLoading, sentFilter, devices, devicesLoading, pairForm, pairingInfo, pairingLoading,
      pairingCountdown, pairingQrCanvas, apiKey,
      isAdmin, canWebhook, webhookForm, savingWebhook, testingWebhook, forwardingId,
      usersList, usersLoading, creatingUser, userForm, currentUserId, apkInfo,
      animatedTotal, animatedToday, animatedUnique,
      todayDate, visiblePages,
      getInitial, formatDate, fetchStats, fetchSms, fetchSent, fetchDevices,
      sendSms, createPairing, deleteDevice, copyPairingLink, formatCountdown, copyApiKey, regenApiKey, fetchUsers, createUser, toggleUser, toggleWebhookProfile,
      loadWebhook, saveWebhook, testWebhook, forwardSms, loadApkInfo,
      refreshAll, debouncedSearch, goPage, applySort, toggleSort,
      scrollToTable, scrollToCompose,
    };
  }
}).mount('#app');
</script>
</body>
</html>
