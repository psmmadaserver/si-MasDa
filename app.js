const $ = (s) => document.querySelector(s);
$('#year').textContent = new Date().getFullYear();

// Adapter sengaja tidak melakukan panggilan backend pada kerangka pratinjau.
// Implementasi API harus ditambahkan setelah endpoint Apps Script diberi dispatcher
// yang tervalidasi, allowlist operasi, dan pemeriksaan sesi/RBAC di sisi server.
const MasdaApi = Object.freeze({
  configured: false,
  async call(_operation, _payload = {}) {
    throw new Error('API Si MasDA belum dikonfigurasi. Kerangka ini hanya pratinjau UI.');
  }
});
window.MasdaApi = MasdaApi;

$('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  $('#loginMessage').textContent = 'Login belum diaktifkan: adapter API dan validasi sesi server perlu diselesaikan terlebih dahulu.';
  $('#loginMessage').className = 'small mt-3 text-danger';
});
$('#logoutBtn').addEventListener('click', () => {
  $('#loginMessage').textContent = 'Logout hanya dapat diaktifkan setelah integrasi autentikasi tersedia.';
  $('#loginMessage').className = 'small mt-3 text-secondary';
  $('#appScreen').classList.add('d-none');
  $('#loginScreen').classList.remove('d-none');
});
$('#mainNav').addEventListener('click', (event) => {
  const link = event.target.closest('[data-view]');
  if (!link) return;
  event.preventDefault();
  $('#mainNav').querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item === link));
  const key = link.dataset.view;
  const labels = {dashboard:'Dashboard',master:'Data Master',jurnal:'Jurnal Guru',honor:'Honor Guru',absensi:'Absensi',kesiswaan:'Kesiswaan',sarpras:'Sarana & Prasarana',ppdb:'PPDB',profil:'Profil & Pengaturan'};
  $('#pageTitle').textContent = labels[key] || key;
  $('#view-dashboard').classList.toggle('d-none', key !== 'dashboard');
  $('#view-placeholder').classList.toggle('d-none', key === 'dashboard');
  $('#placeholderTitle').textContent = labels[key] || key;
  $('#sidebar').classList.remove('is-open');
});
$('#toggleSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
