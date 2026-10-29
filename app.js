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
    $('view-dashboard').classList.add('d-none');
    $('view-master').classList.add('d-none');
    $('view-placeholder').classList.add('d-none');
    $('pageTitle').textContent = menuLabels[key] || 'Modul';
    if (key === 'dashboard') {
      $('view-dashboard').classList.remove('d-none'); loadDashboard();
    } else if (key === 'master') {
      $('view-master').classList.remove('d-none'); loadGuru();
    } else {
      $('view-placeholder').classList.remove('d-none');
      $('placeholderTitle').textContent = menuLabels[key] || 'Modul';
    }
    if (window.innerWidth < 992) $('sidebar').classList.remove('open');
  });
});
$('toggleSidebar').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('year').textContent = new Date().getFullYear();


let guruCache = [];
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function setGuruMessage(message, isError = false) {
  const el = $('guruMessage'); if (el) { el.textContent = message || ''; el.className = 'small mt-2 ' + (isError ? 'text-danger' : 'text-secondary'); }
}
async function loadGuru() {
  const body = $('guruTableBody');
  body.innerHTML = '<tr><td colspan="9" class="text-secondary text-center py-4">Memuat data guru…</td></tr>';
  setGuruMessage('');
  try {
    const result = await api('masterGuruList', { sessionToken: getToken() });
    if (!result.success) {
      if (result.code === 'SESSION_EXPIRED') { clearSession(); showLogin(result.message || 'Sesi berakhir.'); return; }
      throw new Error(result.message || 'Data guru gagal dimuat.');
    }
    guruCache = Array.isArray(result.data) ? result.data : [];
    renderGuruTable();
    setGuruMessage('Berhasil memuat ' + guruCache.length.toLocaleString('id-ID') + ' data guru.');
  } catch (err) {
    body.innerHTML = '<tr><td colspan="9" class="text-danger text-center py-4">' + esc(err.message || 'Gagal memuat data.') + '</td></tr>';
    setGuruMessage(err.message || 'Gagal memuat data guru.', true);
  }
}
function renderGuruTable() {
  const q = String($('guruSearch').value || '').trim().toLowerCase();
  const rows = guruCache.filter(g => [g.nip,g.nama,g.mapel,g.username,g.jabatanNama].some(v => String(v || '').toLowerCase().includes(q)));
  $('guruTableBody').innerHTML = rows.length ? rows.map(g => `<tr>
    <td class="text-nowrap">${esc(g.nip)}</td><td>${esc(g.nama)}</td><td>${esc(g.mapel)}</td>
    <td class="text-nowrap">${Number(g.tarif||0).toLocaleString('id-ID')}</td>
    <td class="text-nowrap">${Number(g.transport||0).toLocaleString('id-ID')}</td>
    <td class="text-nowrap">${Number(g.tjJabatan||0).toLocaleString('id-ID')}</td>
    <td>${esc(g.username)}</td><td>${esc(g.jabatanNama||'Guru')}</td>
    <td class="text-nowrap"><button class="btn btn-outline-primary btn-sm" data-edit-guru="${esc(g.nip)}" title="Edit"><i class="ti ti-edit"></i></button>
    <button class="btn btn-outline-danger btn-sm ms-1" data-delete-guru="${esc(g.nip)}" title="Hapus"><i class="ti ti-trash"></i></button></td></tr>`).join('') :
    '<tr><td colspan="9" class="text-secondary text-center py-4">Tidak ada data yang cocok.</td></tr>';
  document.querySelectorAll('[data-edit-guru]').forEach(btn => btn.addEventListener('click', () => editGuru(btn.dataset.editGuru)));
  document.querySelectorAll('[data-delete-guru]').forEach(btn => btn.addEventListener('click', () => deleteGuru(btn.dataset.deleteGuru)));
}
function resetGuruForm() {
  $('guruForm').reset(); $('guruOldNip').value = ''; $('guruNip').readOnly = false;
  $('guruTarif').value = '0'; $('guruTransport').value = '0'; $('guruTjJabatan').value = '0'; $('guruJabatan').value = 'Guru';
  $('guruPassword').value = ''; $('guruFormTitle').textContent = 'Tambah Guru'; $('guruFormMessage').textContent = '';
}
function openGuruForm() { $('guruFormWrap').classList.remove('d-none'); $('guruFormWrap').scrollIntoView({behavior:'smooth',block:'start'}); }
function editGuru(nip) {
  const g = guruCache.find(x => String(x.nip) === String(nip)); if (!g) return;
  resetGuruForm(); $('guruFormTitle').textContent = 'Edit Data Guru';
  $('guruOldNip').value = g.nip; $('guruNip').value = g.nip; $('guruNip').readOnly = true;
  $('guruNama').value = g.nama || ''; $('guruMapel').value = g.mapel || '';
  $('guruTarif').value = g.tarif || 0; $('guruTransport').value = g.transport || 0;
  $('guruTjJabatan').value = g.tjJabatan || 0; $('guruJabatan').value = g.jabatanNama || 'Guru';
  $('guruUsername').value = g.username || ''; $('guruPassword').value = '';
  openGuruForm();
}
async function deleteGuru(nip) {
  const g = guruCache.find(x => String(x.nip) === String(nip));
  if (!g || !window.confirm('Hapus data guru ' + g.nama + ' (' + g.nip + ')? Data guru yang dihapus tidak dapat dipulihkan.')) return;
  try {
    const result = await api('masterGuruDelete', {sessionToken:getToken(), nip});
    if (!result.success) throw new Error(result.message || 'Data guru gagal dihapus.');
    setGuruMessage(result.message || 'Data guru berhasil dihapus.');
    await loadGuru();
  } catch(err) { setGuruMessage(err.message || 'Gagal menghapus data guru.', true); }
}
$('newGuruBtn').addEventListener('click', () => { resetGuruForm(); openGuruForm(); });
$('cancelGuruBtn').addEventListener('click', () => $('guruFormWrap').classList.add('d-none'));
$('refreshGuruBtn').addEventListener('click', loadGuru);
$('guruSearch').addEventListener('input', renderGuruTable);
$('guruForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = {
    nip: $('guruNip').value.trim(), oldNip: $('guruOldNip').value.trim(),
    nama: $('guruNama').value.trim(), mapel: $('guruMapel').value.trim(),
    tarif: Number($('guruTarif').value || 0), transport: Number($('guruTransport').value || 0),
    tjJabatan: Number($('guruTjJabatan').value || 0), jabatanNama: $('guruJabatan').value.trim() || 'Guru',
    username: $('guruUsername').value.trim(), password: $('guruPassword').value
  };
  if (!data.nip || !data.nama) { $('guruFormMessage').textContent = 'NIP dan Nama Guru wajib diisi.'; return; }
  const isNew = !data.oldNip;
  if (isNew && (!data.username || !data.password)) { $('guruFormMessage').textContent = 'Username dan password wajib diisi untuk akun guru baru.'; return; }
  const button = $('saveGuruBtn'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan…';
  $('guruFormMessage').textContent = '';
  try {
    const result = await api('masterGuruSave', {sessionToken:getToken(), data});
    if (!result.success) throw new Error(result.message || 'Data guru gagal disimpan.');
    $('guruFormMessage').textContent = result.message || 'Data guru berhasil disimpan.';
    $('guruFormMessage').className = 'small mt-3 text-success';
    await loadGuru(); resetGuruForm(); $('guruFormWrap').classList.add('d-none');
  } catch(err) {
    $('guruFormMessage').textContent = err.message || 'Gagal menyimpan data guru.';
    $('guruFormMessage').className = 'small mt-3 text-danger';
  } finally { button.disabled = false; button.innerHTML = '<i class="ti ti-device-floppy me-1"></i>Simpan Guru'; }
});

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
