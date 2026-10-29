const API_URL = '/api/masda';
const TOKEN_KEY = 'siMasDA_sessionToken';
const USER_KEY = 'siMasDA_user';
const menuLabels = {
  dashboard: 'Dashboard', master: 'Data Master', jurnal: 'Jurnal Guru', honor: 'Honor Guru',
  absensi: 'Absensi', kesiswaan: 'Kesiswaan', sarpras: 'Sarpras', ppdb: 'PPDB', profil: 'Profil & Pengaturan'
};
const $ = (id) => document.getElementById(id);

async function api(action, extra = {}) {
  const response = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    cache: 'no-store', body: JSON.stringify({ action, ...extra })
  });
  let data;
  try { data = await response.json(); }
  catch (_) { throw new Error('Respons server tidak dapat dibaca.'); }
  if (!response.ok && !data.message) throw new Error('Permintaan ke server gagal (' + response.status + ').');
  return data;
}

function setLoginMessage(message, type = '') {
  const el = $('loginMessage');
  if (!el) return;
  el.textContent = message;
  el.className = 'small mt-3 ' + (type === 'error' ? 'login-message-error' : type === 'success' ? 'login-message-success' : 'text-secondary');
}
function readUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; } }
function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function saveSession(user) {
  localStorage.setItem(TOKEN_KEY, user.sessionToken);
  const safeUser = { role: user.role, nama: user.nama, username: user.username, akses: user.akses, aksesDetail: user.aksesDetail };
  localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
}
function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function canAccess(user, key) {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'administrator') return true;
  const detail = user.aksesDetail || {};
  if (Object.prototype.hasOwnProperty.call(detail, key)) return detail[key] !== 'off';
  return String(user.akses || '').split(',').map(x => x.trim()).includes(key);
}
function showApp(user) {
  $('loginScreen').classList.add('d-none');
  $('appScreen').classList.remove('d-none');
  $('userName').textContent = user.nama || user.username || 'Pengguna';
  $('userRole').textContent = (user.role || 'Pengguna') + ' · ' + (user.username || '');
  document.querySelectorAll('#mainNav [data-view]').forEach(link => {
    const key = link.dataset.view;
    link.classList.toggle('d-none', !canAccess(user, key));
  });
  loadDashboard();
}
function showLogin(message = '') {
  $('appScreen').classList.add('d-none');
  $('loginScreen').classList.remove('d-none');
  if (message) setLoginMessage(message, 'error');
}
async function loadDashboard() {
  try {
    const result = await api('dashboard', { sessionToken: getToken() });
    if (!result.success) {
      if (result.code === 'SESSION_EXPIRED') { clearSession(); showLogin(result.message || 'Sesi berakhir. Silakan masuk kembali.'); return; }
      throw new Error(result.message || 'Dashboard tidak dapat dimuat.');
    }
    const d = result.data || {};
    $('statSiswa').textContent = Number(d.siswa || 0).toLocaleString('id-ID');
    $('statGuru').textContent = Number(d.guru || 0).toLocaleString('id-ID');
    $('statKelas').textContent = Number(d.kelas || 0).toLocaleString('id-ID');
    $('dashboardMessage').textContent = 'Data ringkasan berhasil dimuat dari Google Sheets Si MasDA.';
  } catch (err) {
    $('dashboardMessage').textContent = err.message || 'Gagal memuat dashboard.';
  }
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;
  const button = $('loginForm').querySelector('button[type="submit"]');
  button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa akun…';
  setLoginMessage('Menghubungkan ke Si MasDA…');
  try {
    const result = await api('login', { username, password });
    if (!result.success) { setLoginMessage(result.message || 'Username atau password salah.', 'error'); return; }
    saveSession(result);
    $('password').value = '';
    showApp(result);
  } catch (err) {
    setLoginMessage((err.message || 'Gagal login.') + ' Periksa deployment Apps Script dan variabel MASDA_GAS_URL di Vercel.', 'error');
  } finally {
    button.disabled = false; button.innerHTML = 'Masuk <i class="ti ti-arrow-right ms-1"></i>';
  }
});

$('logoutBtn').addEventListener('click', async () => {
  const token = getToken();
  const button = $('logoutBtn'); button.disabled = true;
  try { if (token) await api('logout', { sessionToken: token }); } catch (_) { /* sesi lokal tetap dibersihkan */ }
  clearSession(); button.disabled = false; showLogin('Anda telah keluar dari Si MasDA.');
});

document.querySelectorAll('#mainNav [data-view]').forEach(link => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const key = link.dataset.view;
    document.querySelectorAll('#mainNav .nav-link').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    if (key === 'dashboard') {
      $('view-dashboard').classList.remove('d-none'); $('view-placeholder').classList.add('d-none');
      $('pageTitle').textContent = 'Dashboard'; loadDashboard();
    } else {
      $('view-dashboard').classList.add('d-none'); $('view-placeholder').classList.remove('d-none');
      $('pageTitle').textContent = menuLabels[key] || 'Modul'; $('placeholderTitle').textContent = menuLabels[key] || 'Modul';
    }
    if (window.innerWidth < 992) $('sidebar').classList.remove('open');
  });
});
$('toggleSidebar').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('year').textContent = new Date().getFullYear();

(async function restoreSession() {
  const token = getToken();
  if (!token) return;
  try {
    const result = await api('session', { sessionToken: token });
    if (result.success) { saveSession(result); showApp(result); }
    else { clearSession(); showLogin('Sesi sudah berakhir. Silakan masuk kembali.'); }
  } catch (_) {
    // Jangan hapus token hanya karena jaringan sementara bermasalah.
    showLogin('Belum dapat memeriksa sesi. Periksa koneksi, lalu muat ulang halaman.');
  }
})();
