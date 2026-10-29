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
function canEditMenu(user,key){if(!user)return false;if(String(user.role||'').toLowerCase()==='administrator')return true;const detail=user.aksesDetail||{};if(Object.prototype.hasOwnProperty.call(detail,key))return detail[key]==='edit';return canAccess(user,key);}
function showApp(user) {
  $('loginScreen').classList.add('d-none'); $('appScreen').classList.remove('d-none');
  $('userName').textContent=user.nama||user.username||'Pengguna'; $('userRole').textContent=(user.role||'Pengguna')+' · '+(user.username||'');
  document.querySelectorAll('#mainNav [data-view]').forEach(link=>link.classList.toggle('d-none',!canAccess(user,link.dataset.view)));
  loadDashboard();
}
function showLogin(message='') { $('appScreen').classList.add('d-none');$('loginScreen').classList.remove('d-none');if(message)setLoginMessage(message,'error'); }
async function loadDashboard(){
  try{const result=await api('dashboard',{sessionToken:getToken()});if(!result.success){if(result.code==='SESSION_EXPIRED'){clearSession();showLogin(result.message||'Sesi berakhir. Silakan masuk kembali.');return;}throw new Error(result.message||'Dashboard tidak dapat dimuat.');}
    const d=result.data||{};$('statSiswa').textContent=Number(d.siswa||0).toLocaleString('id-ID');$('statGuru').textContent=Number(d.guru||0).toLocaleString('id-ID');$('statKelas').textContent=Number(d.kelas||0).toLocaleString('id-ID');$('dashboardMessage').textContent='Data ringkasan berhasil dimuat dari Google Sheets Si MasDA.';
  }catch(err){$('dashboardMessage').textContent=err.message||'Gagal memuat dashboard.';}
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const username=$('username').value.trim(),password=$('password').value;const button=$('loginForm').querySelector('button[type="submit"]');button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa akun…';setLoginMessage('Menghubungkan ke Si MasDA…');
  try{const result=await api('login',{username,password});if(!result.success){setLoginMessage(result.message||'Username atau password salah.','error');return;}saveSession(result);$('password').value='';showApp(result);}
  catch(err){setLoginMessage((err.message||'Gagal login.')+' Periksa deployment Apps Script dan variabel MASDA_GAS_URL di Vercel.','error');}
  finally{button.disabled=false;button.innerHTML='Masuk <i class="ti ti-arrow-right ms-1"></i>';}
});
$('logoutBtn').addEventListener('click',async()=>{const token=getToken(),button=$('logoutBtn');button.disabled=true;try{if(token)await api('logout',{sessionToken:token});}catch(_){}clearSession();button.disabled=false;showLogin('Anda telah keluar dari Si MasDA.');});
document.querySelectorAll('#mainNav [data-view]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();const key=link.dataset.view;document.querySelectorAll('#mainNav .nav-link').forEach(a=>a.classList.remove('active'));link.classList.add('active');
  $('view-dashboard').classList.add('d-none');$('view-master').classList.add('d-none');$('view-generic').classList.add('d-none');$('pageTitle').textContent=menuLabels[key]||'Modul';
  if(key==='dashboard'){$('view-dashboard').classList.remove('d-none');loadDashboard();}
  else if(key==='master'){$('view-master').classList.remove('d-none');$('guruModule').classList.remove('d-none');document.querySelectorAll('[data-master-sub]').forEach(b=>{b.classList.toggle('btn-primary',b.dataset.masterSub==='guru');b.classList.toggle('btn-outline-primary',b.dataset.masterSub!=='guru');});loadGuru();}
  else renderModule(key);if(window.innerWidth<992)$('sidebar').classList.remove('open');
}));
$('toggleSidebar').addEventListener('click',()=>$('sidebar').classList.toggle('open'));$('year').textContent=new Date().getFullYear();

let guruCache = [];
const localDate = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const localMonth = () => localDate().slice(0,7);
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
  const adminUser=String((readUser()||{}).role||'').toLowerCase()==='administrator';
  $('newGuruBtn').classList.toggle('d-none',!adminUser);
  const actionHeader=document.querySelector('#view-master thead th:last-child');if(actionHeader)actionHeader.classList.toggle('d-none',!adminUser);
  const q = String($('guruSearch').value || '').trim().toLowerCase();
  const rows = guruCache.filter(g => [g.nip,g.nama,g.mapel,g.username,g.jabatanNama].some(v => String(v || '').toLowerCase().includes(q)));
  $('guruTableBody').innerHTML = rows.length ? rows.map(g => `<tr>
    <td class="text-nowrap">${esc(g.nip)}</td><td>${esc(g.nama)}</td><td>${esc(g.mapel)}</td>
    <td class="text-nowrap">${Number(g.tarif||0).toLocaleString('id-ID')}</td>
    <td class="text-nowrap">${Number(g.transport||0).toLocaleString('id-ID')}</td>
    <td class="text-nowrap">${Number(g.tjJabatan||0).toLocaleString('id-ID')}</td>
    <td>${esc(g.username)}</td><td>${esc(g.jabatanNama||'Guru')}</td>
    <td class="text-nowrap ${adminUser?'':'d-none'}"><button class="btn btn-outline-primary btn-sm" data-edit-guru="${esc(g.nip)}" title="Edit"><i class="ti ti-edit"></i></button>
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

// Modul lanjutan: seluruh aksi menggunakan allowlist endpoint di Vercel dan router doPost Apps Script.
const MODULES = {
  kelas:{title:'Master Kelas',menu:'master',load:'masterData',path:d=>(d.kelas||[]).map(r=>({id:r[0],namaKelas:r[1],waliKelas:r[2]})),cols:[['id','ID'],['namaKelas','Nama Kelas'],['waliKelas','Wali Kelas']],fields:[['namaKelas','Nama Kelas','text',true],['waliKelas','Wali Kelas','text',false]],save:'masterKelasSave',del:'masterKelasDelete',key:'id'},
  siswa:{title:'Master Siswa',menu:'master',load:'masterData',path:d=>(d.siswa||[]).map(r=>({nisn:r[0],nama:r[1],kelas:r[2],jk:r[3],noHpWali:r[4],idCard:r[5]})),cols:[['nisn','NISN'],['nama','Nama Siswa'],['kelas','Kelas'],['jk','Jenis Kelamin'],['noHpWali','HP Wali']],fields:[['nisn','NISN (boleh diawali 0)','text',true],['nama','Nama Siswa','text',true],['kelas','Kelas','text',true],['jk','Jenis Kelamin','select',true,['Laki-laki','Perempuan']],['noHpWali','No. HP Wali','text',false]],save:'masterSiswaSave',del:'masterSiswaDelete',key:'nisn'},
  jadwal:{title:'Jadwal Mapel',menu:'master',load:'masterData',path:d=>(d.jadwal||[]).map(r=>({id:r[0],hari:r[1],kelas:r[2],jam:r[3],mapel:r[4],guru:r[5]})),cols:[['id','ID'],['hari','Hari'],['kelas','Kelas'],['jam','Jam'],['mapel','Mata Pelajaran'],['guru','Guru']],fields:[['hari','Hari','select',true,['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']],['kelas','Kelas','text',true],['jam','Jam','select',true,['Jam 1','Jam 2','Jam 3','Jam 4','Semua Jam']],['mapel','Mata Pelajaran','text',true],['guru','Nama Guru','text',true]],save:'masterJadwalSave',del:'masterJadwalDelete',key:'id'},
  jurnal:{title:'Jurnal Guru',menu:'jurnal',load:'jurnalList',path:d=>(d||[]).map(r=>({id:r[0],tanggal:r[1],guru:r[2],mapel:r[3],kelas:r[4],materi:r[5],status:r[6],jarak:r[7],jam:r[8]})),cols:[['tanggal','Tanggal'],['guru','Guru'],['mapel','Mapel'],['kelas','Kelas'],['materi','Materi'],['jam','Jam'],['status','Status Kehadiran']],fields:[['tanggal','Tanggal','date',true],['mapel','Mata Pelajaran','text',true],['kelas','Kelas','text',true],['jam','Jam Pelajaran','select',true,['Jam 1','Jam 2','Jam 3','Jam 4','Semua Jam']],['materi','Materi','textarea',true]],save:'jurnalSave',del:'jurnalDelete',key:'id',update:false},
  absensi:{title:'Absensi Siswa',menu:'absensi',load:'absensiDaily',path:d=>d||[],cols:[['tanggal','Tanggal'],['kelas','Kelas'],['nisn','NISN'],['nama','Nama Siswa'],['jam1','Jam 1'],['jam2','Jam 2'],['jam3','Jam 3'],['jam4','Jam 4']],fields:[]},
  honor:{title:'Rekap Honor Guru',menu:'honor',load:'honorList',path:d=>d||[],cols:[['nip','NIP'],['nama','Nama Guru'],['kehadiran','Jurnal Valid'],['tarif','Tarif/Jam'],['hariTransport','Hari Transport'],['transport','Tj. Transport/Hari'],['jabatan','Tj. Jabatan'],['totalHonor','Total Honor']],fields:[],readonly:true,month:true},
  kesiswaan:{title:'Kesiswaan & Pelanggaran',menu:'kesiswaan',load:'kesiswaanList',path:d=>(d.pelanggaran||[]).map(r=>({tanggal:r[0],nisn:r[1],nama:r[2],pelanggaran:r[3],poin:r[4]})),cols:[['tanggal','Tanggal'],['nisn','NISN'],['nama','Nama Siswa'],['pelanggaran','Pelanggaran'],['poin','Poin']],fields:[['nisn','NISN','text',true],['nama','Nama Siswa','text',true],['pelanggaran','Keterangan Pelanggaran','text',true],['poin','Poin','number',true]],save:'kesiswaanSave',update:false},
  sarpras:{title:'Inventaris Sarpras',menu:'sarpras',load:'sarprasList',path:d=>(d||[]).map(r=>({id:r[0],nama:r[1],kategori:r[2],jumlah:r[3],baik:r[4],rusakRingan:r[5],rusakBerat:r[6],keterangan:r[7]})),cols:[['id','ID'],['nama','Nama Barang'],['kategori','Kategori'],['jumlah','Jumlah'],['baik','Baik'],['rusakRingan','Rusak Ringan'],['rusakBerat','Rusak Berat'],['keterangan','Keterangan']],fields:[['nama','Nama Barang','text',true],['kategori','Kategori','text',true],['jumlah','Jumlah','number',true],['baik','Kondisi Baik','number',true],['rusakRingan','Rusak Ringan','number',true],['rusakBerat','Rusak Berat','number',true],['keterangan','Keterangan','text',false]],save:'sarprasSave',del:'sarprasDelete',key:'id',update:false},
  ppdb:{title:'PPDB',menu:'ppdb',load:'ppdbList',path:d=>(d||[]).map(r=>({id:r.ID,noDaftar:r['No. Pendaftaran'],tanggal:r['Tanggal Pendaftaran'],nama:r['Nama Lengkap'],gender:r['Jenis Kelamin'],nisn:r.NISN,asalSekolah:r['Asal Sekolah'],pilihan:r['Pilihan Kelas/Jurusan'],status:r.Status,catatan:r.Catatan})),cols:[['noDaftar','No. Daftar'],['tanggal','Tanggal'],['nama','Nama Calon Siswa'],['gender','Jenis Kelamin'],['nisn','NISN'],['asalSekolah','Asal Sekolah'],['pilihan','Pilihan'],['status','Status']],fields:[['tanggal','Tanggal Daftar','date',false],['nama','Nama Lengkap','text',true],['gender','Jenis Kelamin','select',true,['Laki-laki','Perempuan']],['nisn','NISN','text',false],['asalSekolah','Asal Sekolah','text',false],['pilihan','Pilihan Kelas/Jurusan','text',false],['status','Status','select',true,['Menunggu Verifikasi','Diterima','Cadangan','Ditolak']],['catatan','Catatan','textarea',false]],save:'ppdbSave',del:'ppdbDelete',key:'id'},
  profil:{title:'Profil Sekolah',menu:'profil',load:'profilGet',path:d=>[d||{}],cols:[['Nama Madrasah','Nama Madrasah'],['Alamat','Alamat'],['Telepon','Telepon'],['Email','Email'],['Kepala Madrasah','Kepala Madrasah']],fields:[['Nama Madrasah','Nama Madrasah','text',false],['Alamat','Alamat Sekolah','textarea',false],['Telepon','Telepon','text',false],['Email','Email','email',false],['Kepala Madrasah','Nama Kepala Madrasah','text',false]],save:'profilSave',single:true},
  struktur:{title:'Struktur Organisasi',menu:'struktur',load:'strukturGet',path:d=>d||[],cols:[['nama','Nama'],['jabatan','Jabatan'],['parentId','Atasan ID']],fields:[['dataJson','Daftar struktur dalam format JSON','textarea',true]],save:'strukturSave',singleJson:true},
  website:{title:'Website Terkait',menu:'website',load:'websiteList',path:d=>(d||[]).map(r=>({...r,aktif:r.aktif?'Ya':'Tidak'})),cols:[['nama','Nama Website'],['url','URL'],['deskripsi','Deskripsi'],['aktif','Aktif']],fields:[['nama','Nama Website','text',true],['url','URL','url',true],['deskripsi','Deskripsi','text',false],['ikon','Ikon','text',false],['warna','Warna','text',false],['urutan','Urutan','number',false],['logo','URL Logo','url',false],['aktif','Aktif','select',true,['Ya','Tidak']]],save:'websiteSave',del:'websiteDelete',key:'id'},
  pengguna:{title:'Pengguna & Hak Akses',menu:'pengaturan',load:'penggunaList',path:d=>d||[],cols:[['id','ID'],['username','Username'],['nama','Nama'],['role','Role'],['akses','Akses Menu']],fields:[['username','Username','text',true],['password','Password baru (wajib diisi)','password',true],['role','Role','select',true,['Administrator','Guru','Siswa']],['nama','Nama','text',true],['akses','Daftar Akses Menu','text',false],['aksesDetail','Hak Akses Detail (JSON)','textarea',false]],save:'penggunaSave',del:'penggunaDelete',key:'id'},
  pengumuman:{title:'Pengumuman',menu:'pengumuman',load:'pengumumanList',path:d=>(d||[]).map(r=>({id:r.ID,judul:r.Judul,isi:r['Isi Pengumuman'],status:r.Status})),cols:[['id','ID'],['judul','Judul'],['isi','Isi'],['status','Status']],fields:[['judul','Judul','text',true],['isi','Isi Pengumuman','textarea',true],['status','Status','select',true,['Publik','Draft']]],save:'pengumumanSave',del:'pengumumanDelete',key:'id',update:true}
};
let activeView = 'dashboard', activeModule = '', genericRows = [], genericConfig = null, genericEditId = null, masterDataCache = null;
function showGenericSubnav(view) {
  const el=$('genericSubnav'); if(!el)return;
  const settings = ['profil','struktur','pengguna','website','pengumuman'].includes(view) ? [['profil','Profil Sekolah'],['struktur','Struktur Organisasi'],['pengguna','Pengguna & Hak Akses'],['website','Website Terkait'],['pengumuman','Pengumuman']] : [];
  el.innerHTML=settings.map(([k,t])=>`<button class="btn btn-sm ${activeModule===k?'btn-primary':'btn-outline-primary'}" data-generic-sub="${k}">${t}</button>`).join('');
  el.querySelectorAll('[data-generic-sub]').forEach(b=>b.addEventListener('click',()=>renderModule(b.dataset.genericSub)));
}
function setGenericMessage(msg,error=false){$('genericMessage').textContent=msg||'';$('genericMessage').className='small mt-2 '+(error?'text-danger':'text-secondary');}
function renderModule(view) {
  activeView=view; activeModule=view; genericConfig=MODULES[view];
  if(!genericConfig){$('view-generic').classList.remove('d-none');$('genericTitle').textContent='Modul';setGenericMessage('Konfigurasi modul belum tersedia.',true);return;}
  $('view-dashboard').classList.add('d-none');$('view-master').classList.add('d-none');$('view-generic').classList.remove('d-none');$('pageTitle').textContent=genericConfig.title;$('genericTitle').textContent=genericConfig.title;
  $('genericAdd').classList.toggle('d-none',!!genericConfig.readonly || view==='absensi' || !canEditMenu(readUser(),genericConfig.menu));$('genericMonth').style.display=genericConfig.month?'':'none';$('genericMonth').value=localMonth();
  showGenericSubnav(view); $('genericFormWrap').classList.add('d-none'); $('genericSearch').value=''; loadGeneric();
}
async function loadGeneric(){
  if(!genericConfig)return; setGenericMessage('Memuat data…'); $('genericBody').innerHTML='<tr><td class="text-secondary text-center py-4">Memuat data…</td></tr>';
  try{
    let res;
    if(activeModule==='honor') res=await api(String((readUser()||{}).role||'').toLowerCase()==='administrator'?'honorList':'honorMine',{sessionToken:getToken(),bulanTahun:$('genericMonth').value});
    else if(activeModule==='absensi') res=await api('absensiDaily',{sessionToken:getToken(),tanggal:localDate()});
    else res=await api(genericConfig.load,{sessionToken:getToken()});
    if(!res.success)throw new Error(res.message||'Gagal memuat data.');
    let raw=res.data;
    if(activeModule==='absensi') raw=(raw.detail||[]).map(x=>({...x}));
    genericRows=genericConfig.path(raw);
    renderGenericTable();setGenericMessage('Berhasil memuat '+genericRows.length.toLocaleString('id-ID')+' data.');
  }catch(e){$('genericBody').innerHTML=`<tr><td class="text-danger text-center py-4">${esc(e.message)}</td></tr>`;setGenericMessage(e.message,true);}
}
function renderGenericTable(){
  if(activeModule==='absensi'){
    $('genericHead').innerHTML='<tr><th>NISN</th><th>Nama</th><th>Kelas</th><th>Jam 1</th><th>Jam 2</th><th>Jam 3</th><th>Jam 4</th></tr>';
    $('genericAdd').classList.toggle('d-none',!canEditMenu(readUser(),genericConfig.menu));$('genericAdd').innerHTML='<i class="ti ti-device-floppy me-1"></i>Simpan Absensi';
    $('genericBody').innerHTML=genericRows.map((r,i)=>`<tr><td>${esc(r.nisn)}</td><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td>${['jam1','jam2','jam3','jam4'].map(k=>`<td><select class="form-select form-select-sm" data-att-index="${i}" data-att-key="${k}">${['Hadir','Bolos','Izin','Sakit','Alpha'].map(v=>`<option ${r[k]===v?'selected':''}>${v}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')||'<tr><td colspan="7" class="text-center text-secondary py-4">Tidak ada data absensi untuk hari ini.</td></tr>';return;
  }
  $('genericAdd').classList.toggle('d-none',!!genericConfig.readonly || !canEditMenu(readUser(),genericConfig.menu));
  $('genericAdd').innerHTML='<i class="ti ti-plus me-1"></i>Tambah Data';
  $('genericHead').innerHTML='<tr>'+genericConfig.cols.map(c=>`<th>${esc(c[1])}</th>`).join('')+(!genericConfig.readonly && canEditMenu(readUser(),genericConfig.menu)?'<th class="w-1">Aksi</th>':'')+'</tr>';
  const q=$('genericSearch').value.toLowerCase().trim(); const rows=genericRows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  $('genericBody').innerHTML=rows.length?rows.map(r=>`<tr>${genericConfig.cols.map(c=>`<td>${esc(r[c[0]]??'')}</td>`).join('')}${!genericConfig.readonly && canEditMenu(readUser(),genericConfig.menu)?`<td class="text-nowrap">${genericConfig.update!==false?`<button class="btn btn-outline-primary btn-sm" data-generic-edit="${esc(r[genericConfig.key]||r.id||r.nisn||r.ID||'')}"><i class="ti ti-edit"></i></button>`:''}${genericConfig.del?` <button class="btn btn-outline-danger btn-sm" data-generic-delete="${esc(r[genericConfig.key]||r.id||r.nisn||r.ID||'')}"><i class="ti ti-trash"></i></button>`:''}</td>`:''}</tr>`).join(''):'<tr><td colspan="12" class="text-center text-secondary py-4">Tidak ada data.</td></tr>';
  document.querySelectorAll('[data-generic-edit]').forEach(b=>b.addEventListener('click',()=>openGenericForm(b.dataset.genericEdit)));
  document.querySelectorAll('[data-generic-delete]').forEach(b=>b.addEventListener('click',()=>deleteGeneric(b.dataset.genericDelete)));
}
function openGenericForm(id){
  genericEditId=id||null; const row=(activeModule==='profil'?genericRows[0]:genericRows.find(r=>String(r[genericConfig.key||'id']||r.id||r.nisn||r.ID||'')===String(id)))||{};
  $('genericFormTitle').textContent=id?'Edit '+genericConfig.title:'Tambah '+genericConfig.title;
  if(activeModule==='profil'){
    $('genericFields').innerHTML=Object.entries(row).map(([key,value])=>`<div class="col-md-6"><label class="form-label">${esc(key)}</label><input class="form-control" name="${esc(key)}" value="${esc(value)}"></div>`).join('');
  } else if(genericConfig.singleJson){
    $('genericFields').innerHTML=`<div class="col-12"><label class="form-label">Daftar Struktur (JSON)</label><textarea class="form-control font-monospace" name="dataJson" rows="12" required>${esc(JSON.stringify(genericRows,null,2))}</textarea><div class="form-hint">Edit seluruh daftar struktur dalam format JSON. Simpan salinan sebelum mengganti daftar.</div></div>`;
  } else {
    $('genericFields').innerHTML=(genericConfig.fields||[]).map(([key,label,type,required,options])=>{
      let value=row[key]??''; if(key==='tanggal'&&!value)value=localDate(); if(key==='aksesDetail' && typeof value==='string'){try{value=JSON.stringify(JSON.parse(value),null,2);}catch(_){}}
      if(type==='select')return `<div class="col-md-6"><label class="form-label">${esc(label)}</label><select class="form-select" name="${esc(key)}" ${required?'required':''}>${(options||[]).map(o=>`<option ${String(value)===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
      if(type==='textarea')return `<div class="col-12"><label class="form-label">${esc(label)}</label><textarea class="form-control" name="${esc(key)}" rows="3" ${required?'required':''}>${esc(value)}</textarea></div>`;
      return `<div class="col-md-6"><label class="form-label">${esc(label)}</label><input class="form-control" name="${esc(key)}" type="${type==='number'?'number':type==='date'?'date':type==='email'?'email':type==='url'?'url':type==='password'?'password':'text'}" value="${type==='password'?'':esc(value)}" ${required?'required':''} ${['nisn','nip'].includes(key)?'inputmode="text"':''}></div>`;
    }).join('');
  }
  $('genericFormMessage').textContent='';$('genericFormWrap').classList.remove('d-none');$('genericFormWrap').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteGeneric(id){
  if(!genericConfig.del)return;const row=genericRows.find(r=>String(r[genericConfig.key||'id']||r.id||r.nisn||r.ID||'')===String(id));
  if(!confirm('Hapus data ini? Tindakan ini tidak dapat dibatalkan.'))return;
  try{const extra={sessionToken:getToken()};extra[genericConfig.key||'id']=id;const r=await api(genericConfig.del,extra);if(!r.success)throw new Error(r.message||'Gagal menghapus.');setGenericMessage(r.message||'Data berhasil dihapus.');await loadGeneric();}catch(e){setGenericMessage(e.message,true);}
}
$('genericRefresh').addEventListener('click',loadGeneric);$('genericSearch').addEventListener('input',renderGenericTable);$('genericMonth').addEventListener('change',loadGeneric);
$('genericCancel').addEventListener('click',()=>$('genericFormWrap').classList.add('d-none'));
$('genericAdd').addEventListener('click',async()=>{
 if(activeModule==='absensi'){
   const data=genericRows.map((r,i)=>{const o={...r};['jam1','jam2','jam3','jam4'].forEach(k=>{const el=document.querySelector(`[data-att-index="${i}"][data-att-key="${k}"]`);if(el)o[k]=el.value;});return o;});
   try{const res=await api('absensiSave',{sessionToken:getToken(),tanggal:localDate(),data});if(!res.success)throw new Error(res.message||'Gagal menyimpan absensi.');setGenericMessage(res.message||'Absensi berhasil disimpan.');await loadGeneric();}catch(e){setGenericMessage(e.message,true);}return;
 }
 openGenericForm(null);
});
$('genericForm').addEventListener('submit',async e=>{
 e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget).entries());
 if(activeModule==='struktur'){try{const dataParsed=JSON.parse(data.dataJson||'[]');if(!Array.isArray(dataParsed))throw new Error('JSON harus berupa array.');const r=await api('strukturSave',{sessionToken:getToken(),data:dataParsed});if(!r.success)throw new Error(r.message||'Gagal menyimpan struktur.');$('genericFormWrap').classList.add('d-none');setGenericMessage(r.message||'Struktur disimpan.');await loadGeneric();}catch(err){$('genericFormMessage').textContent=err.message;$('genericFormMessage').className='text-danger small';}return;}
 if(genericEditId){if(genericConfig.key)data[genericConfig.key]=genericEditId;if(activeModule==='kelas')data.id=genericEditId;if(activeModule==='siswa')data.oldNisn=genericEditId;if(activeModule==='jadwal')data.oldId=genericEditId;if(activeModule==='ppdb')data.id=genericEditId;if(activeModule==='pengguna')data.oldId=genericEditId;}
 if(activeModule==='jurnal'){
   data.lat='';data.lng='';
   if(navigator.geolocation){try{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));data.lat=String(pos.coords.latitude);data.lng=String(pos.coords.longitude);}catch(_){$('genericFormMessage').textContent='Lokasi GPS tidak terdeteksi. Jurnal mungkin tersimpan, tetapi kehadiran dan honor tidak akan dianggap valid di dalam radius sekolah.';$('genericFormMessage').className='text-warning small';}}
   else {$('genericFormMessage').textContent='Browser tidak mendukung GPS. Jurnal mungkin tersimpan tanpa validasi lokasi.';$('genericFormMessage').className='text-warning small';}
 }
 if(activeModule==='pengguna' && data.aksesDetail){try{data.aksesDetail=JSON.parse(data.aksesDetail);}catch(_){$('genericFormMessage').textContent='Hak Akses Detail harus berupa JSON yang valid.';$('genericFormMessage').className='text-danger small';return;}}
 if(activeModule==='profil'){
   const old=(await api('profilGet',{sessionToken:getToken()})).data||{};const merged={...old,...data};
   try{const r=await api('profilSave',{sessionToken:getToken(),data:merged});if(!r.success)throw new Error(r.message||'Gagal menyimpan.');setGenericMessage(r.message);$('genericFormWrap').classList.add('d-none');await loadGeneric();}catch(err){$('genericFormMessage').textContent=err.message;$('genericFormMessage').className='text-danger small';}return;
 }
 try{const r=await api(genericConfig.save,{sessionToken:getToken(),data});if(!r.success)throw new Error(r.message||'Gagal menyimpan data.');$('genericFormWrap').classList.add('d-none');setGenericMessage(r.message||'Data berhasil disimpan.');await loadGeneric();}catch(err){$('genericFormMessage').textContent=err.message;$('genericFormMessage').className='text-danger small';}
});
document.querySelectorAll('[data-master-sub]').forEach(b=>b.addEventListener('click',()=>{
 const sub=b.dataset.masterSub;document.querySelectorAll('[data-master-sub]').forEach(x=>{x.classList.toggle('btn-primary',x===b);x.classList.toggle('btn-outline-primary',x!==b);});
 $('guruModule').classList.toggle('d-none',sub!=='guru');if(sub!=='guru')renderModule(sub);else{$('view-generic').classList.add('d-none');$('view-master').classList.remove('d-none');loadGuru();}
}));

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
