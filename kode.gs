/*
 * MANAGEMENT MAS DARUL AMIN - BACKEND ENGINE (code.gs)
 * Mengelola Autentikasi RBAC, Dashboard, Profil & Peta Lokasi, Struktur Organisasi,
 * Data Master (Guru, Kelas, Siswa, Jadwal Mapel), Jurnal Guru GPS, Absensi, Kesiswaan, SarPras, & Honor.
 */

function doGet() {
  setupDatabase();
  ensureKolomTunjanganGuru_();
  ensureKolomGuruTambahan_();
  ensureKolomSiswa_();
  ensureAbsensiGerbangSheet_();
  ensureKalenderAkademikSheet_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Si MasDA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Helper: Standar Hak Akses Default Berdasarkan Role (RBAC)
// Pembaruan: Penambahan akses ke modul 'honor' (untuk Admin) dan 'website' (untuk Semua)
function getDefaultAksesByRole(role) {
  if (role === 'Administrator') {
    return 'dashboard,profil,struktur,master,hariEfektif,jurnal,honor,absensi,kesiswaan,sarpras,pengaturan,website,whatsapp,absensiQr,ppdb,pengumuman';
  } else if (role === 'Guru') {
    return 'dashboard,master,jurnal,honor,absensi,website';
  } else if (role === 'Siswa') {
    return 'dashboard,kesiswaan,website,absensiQr';
  }
  return 'dashboard,website';
}


// Hak akses per menu: "view" hanya melihat, "edit" boleh mengubah.
function getDefaultDetailAksesByRole_(role) {
  var menus = ['dashboard','profil','struktur','master','hariEfektif','jurnal','honor','absensi','kesiswaan','sarpras','pengaturan','website','whatsapp','absensiQr','ppdb','pengumuman'];
  var out = {};
  menus.forEach(function(k) { out[k] = 'off'; });
  if (role === 'Administrator') {
    menus.forEach(function(k) { out[k] = 'edit'; });
  } else if (role === 'Guru') {
    out.dashboard = 'view'; out.master = 'view'; out.jurnal = 'edit'; out.honor = 'view'; out.absensi = 'edit'; out.website = 'view';
  } else if (role === 'Siswa') {
    out.dashboard = 'view'; out.kesiswaan = 'view'; out.website = 'view'; out.absensiQr = 'edit';
  } else {
    out.dashboard = 'view'; out.website = 'view';
  }
  return out;
}

function ensureKolomDetailAkses_() {
  var sh = getSheetSafe('Pengguna');
  if (sh.getMaxColumns() < 7) sh.insertColumnsAfter(sh.getMaxColumns(), 7 - sh.getMaxColumns());
  if (!String(sh.getRange(1, 7).getDisplayValue()).trim()) sh.getRange(1, 7).setValue('AksesDetail');
}

function makeUsernameGuru_(nip, nama) {
  var base = String(nip || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) base = String(nama || 'guru').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12) || 'guru';
  var sh = getSheetSafe('Pengguna');
  var users = sh.getDataRange().getDisplayValues();
  var candidate = base, suffix = 1;
  while (users.slice(1).some(function(r) { return String(r[1]).trim().toLowerCase() === candidate.toLowerCase(); })) {
    candidate = base + suffix; suffix++;
  }
  return candidate;
}

function provisionAkunGuru_(guru) {
  ensureKolomDetailAkses_();
  var usersSh = getSheetSafe('Pengguna');
  var users = usersSh.getDataRange().getDisplayValues();
  // Bila akun guru untuk NIP/identitas yang sama sudah ada, jangan membuat duplikat.
  var existing = users.slice(1).some(function(r) {
    return String(r[3]).trim().toLowerCase() === 'guru' &&
      (String(r[4]).trim().toLowerCase() === String(guru.nama).trim().toLowerCase() ||
       String(r[1]).trim().toLowerCase() === String(guru.nip).trim().toLowerCase());
  });
  if (existing) return;
  var username = makeUsernameGuru_(guru.nip, guru.nama);
  var password = 'G' + Utilities.getUuid().replace(/-/g, '').substring(0, 9) + '!';
  var aksesDetail = guru.aksesDetail && typeof guru.aksesDetail === 'object' ? guru.aksesDetail : getDefaultDetailAksesByRole_('Guru');
  var akses = Object.keys(aksesDetail).filter(function(k) { return aksesDetail[k] !== 'off'; }).join(',');
  var id = 'GRU-' + String(guru.nip || new Date().getTime()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  usersSh.appendRow([id, username, password, 'Guru', guru.nama, akses, JSON.stringify(aksesDetail)]);
}

// Helper: Mengambil Sheet dengan Aman (Otomatis Setup jika Belum Ada)
function getSheetSafe(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(sheetName);
  }
  return sheet;
}

// Helper: Format Tanggal Hari Ini Sesuai Timezone Script
function getTodayDateString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Inisialisasi Database Google Sheets Otomatis
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheets = [
    { name: 'PPDB', headers: ['ID','No. Pendaftaran','Tanggal Pendaftaran','Jalur Pendaftaran','Nama Lengkap','Jenis Kelamin','NIK','NISN','Tempat Lahir','Tanggal Lahir','Agama','Asal Sekolah','Tahun Lulus','Pilihan Kelas/Jurusan','Alamat','Nama Ayah','Nama Ibu','Nama Wali','No. HP Orang Tua/Wali','Pekerjaan Orang Tua','Status','Catatan','Timestamp'] },
    { name: 'Pengguna', headers: ['ID', 'Username', 'Password', 'Role', 'Nama', 'Akses'] },
    { name: 'Profil', headers: ['Kunci', 'Nilai'] },
    { name: 'Struktur', headers: ['ID', 'Nama', 'Jabatan', 'AtasanID'] },
    { name: 'Guru', headers: ['NIP', 'Nama', 'Email', 'Mata Pelajaran'] },
    { name: 'Kelas', headers: ['ID Kelas', 'Nama Kelas', 'Wali Kelas'] },
    { name: 'Siswa', headers: ['NISN', 'Nama', 'Kelas', 'Jenis Kelamin'] },
    { name: 'Jadwal', headers: ['ID', 'Hari', 'Kelas', 'Jam', 'Mata Pelajaran', 'Guru'] },
    { name: 'Absensi', headers: ['Tanggal', 'Kelas', 'NISN', 'Nama', 'Jam1', 'Jam2', 'Jam3', 'Jam4'] },
    { name: 'Pelanggaran', headers: ['Tanggal', 'NISN', 'Nama', 'Pelanggaran', 'Poin'] },
    { name: 'Sarpras', headers: ['ID', 'Nama Barang', 'Kategori', 'Jumlah', 'Kondisi Baik', 'Rusak Ringan', 'Rusak Berat', 'Keterangan'] },
    { name: 'Jurnal', headers: ['ID', 'Tanggal', 'Guru', 'Mata Pelajaran', 'Kelas', 'Materi Pelajaran', 'Status Absen', 'Jarak GPS'] }
  ];

  sheets.forEach(function(s) {
    var sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.headers);

      if (s.name === 'Pengguna') {
        sheet.appendRow(['ADM01', 'admin', 'AdminMDA2026!', 'Administrator', 'Admin Utama', getDefaultAksesByRole('Administrator')]);
        sheet.appendRow(['GRU01', 'guru', 'GuruMDA2026!', 'Guru', 'Ustadz Ahmad, S.Pd', getDefaultAksesByRole('Guru')]);
        sheet.appendRow(['SSW01', 'siswa', 'SiswaMDA2026!', 'Siswa', 'Ahmad Fauzi', getDefaultAksesByRole('Siswa')]);
      } else if (s.name === 'Profil') {
        sheet.appendRow(['Nama Sekolah', 'MAS Darul Amin']);
        sheet.appendRow(['NISM', '131232010001']);
        sheet.appendRow(['NPSN', '69728192']);
        sheet.appendRow(['Kepala Sekolah', 'Akhmad Fauzi Nawardi, M.Pd.I']);
        sheet.appendRow(['Visi Misi', 'Visi: Terwujudnya generasi Islami, unggul, dan berprestasi.\nMisi: Menyelenggarakan pendidikan madrasah bermutu tinggi.']);
        sheet.appendRow(['Logo', '']);
        sheet.appendRow(['Latitude', '-6.200000']);
        sheet.appendRow(['Longitude', '106.816666']);
        sheet.appendRow(['Radius', '100']);
      } else if (s.name === 'Struktur') {
        sheet.appendRow(['1', 'Abd. Jalil', 'Komite', '']);
        sheet.appendRow(['2', 'Akhmad Fauzi Nawardi, M.Pd.I', 'Kepala Madrasah', '']);
        sheet.appendRow(['3', 'Agus Fandi, S.Pd.I', 'Waka Kurikulum', '2']);
        sheet.appendRow(['4', 'Uswatun Hasanah, S.Pd.', 'Waka Kesiswaan', '2']);
        sheet.appendRow(['5', 'Ismail Marsuki, S.Pd.I', 'Waka Humas', '2']);
        sheet.appendRow(['6', 'Istifarin Fajariyah, S.Pd.', 'Kepala Tata Usaha', '2']);
        sheet.appendRow(['7', 'Ali Rais Ibrahim, S.Kom', 'SIM', '6']);
      } else if (s.name === 'Kelas') {
        sheet.appendRow(['K10A', 'X-IPA', 'Ustadz Ahmad, S.Pd']);
        sheet.appendRow(['K11B', 'XI-IPS', 'Siti Rahma, S.Pd']);
      } else if (s.name === 'Siswa') {
        sheet.appendRow(['0056123401', 'Ahmad Fauzi', 'X-IPA', 'Laki-laki']);
        sheet.appendRow(['0056123402', 'Siti Aminah', 'X-IPA', 'Perempuan']);
        sheet.appendRow(['0056123403', 'Budi Santoso', 'XI-IPS', 'Laki-laki']);
      } else if (s.name === 'Guru') {
        // Pembaruan: Format Mapel bisa dipisah dengan Koma
        sheet.appendRow(['19850101', 'Ustadz Ahmad, S.Pd', 'ahmad@darulamin.sch.id', 'Fiqih, Sejarah Kebudayaan Islam']);
        sheet.appendRow(['19880202', 'Siti Rahma, S.Pd', 'rahma@darulamin.sch.id', 'Bahasa Arab']);
      } else if (s.name === 'Jadwal') {
        sheet.appendRow(['JDW01', 'Senin', 'X-IPA', 'Jam 1', 'Fiqih', 'Ustadz Ahmad, S.Pd']);
        sheet.appendRow(['JDW02', 'Senin', 'X-IPA', 'Jam 2', 'Bahasa Arab', 'Siti Rahma, S.Pd']);
      } else if (s.name === 'Sarpras') {
        sheet.appendRow(['BRG-01', 'Meja Kursi Belajar', 'Mebel', '120', '100', '15', '5', 'Butuh perbaikan kayu']);
        sheet.appendRow(['BRG-02', 'Proyektor LCD', 'Elektronik', '8', '6', '2', '0', '-']);
        sheet.appendRow(['BRG-03', 'Komputer Laboratorium', 'Elektronik', '30', '25', '3', '2', 'Update OS']);
      } else if (s.name === 'Jurnal') {
        sheet.appendRow(['JRN-001', getTodayDateString(), 'Ustadz Ahmad, S.Pd', 'Fiqih', 'X-IPA', 'Pembahasan Fiqih Thaharah dan Bersuci', 'Hadir (Dalam Radius)', '15 meter']);
      }
    } else if (s.name === 'Pengguna') {
      var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
      if (headers.indexOf('Akses') === -1) {
        sheet.getRange(1, 6).setValue('Akses');
      }
    }
  });
}

// Autentikasi Login dengan Dukungan RBAC

// Migrasi kolom Master Guru tanpa menghapus kolom/data lama.
function ensureKolomGuruTambahan_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru');
  if (!sh) return;
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0].map(function(x){return String(x||'').trim();});
  // Kolom lama (termasuk Email) tetap dipertahankan untuk kompatibilitas.
  ['Tarif/Jam','Foto','Jabatan'].forEach(function(h) {
    if (headers.indexOf(h) === -1) { sh.getRange(1, sh.getLastColumn()+1).setValue(h); headers.push(h); }
  });
  setKolomIdentitasSebagaiTeks_(sh, 1);
}

function guruHeaderMap_() {
  var sh = getSheetSafe('Guru'), headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0], map = {};
  headers.forEach(function(h,i){map[String(h||'').trim()] = i+1;});
  return map;
}

// Migrasi kolom tunjangan guru tanpa menghapus data lama.
function ensureKolomTunjanganGuru_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guru');
  if (!sh) return;
  if (sh.getMaxColumns() < 6) sh.insertColumnsAfter(sh.getMaxColumns(), 6 - sh.getMaxColumns());
  sh.getRange(1, 5).setValue('Tj Transpot');
  sh.getRange(1, 6).setValue('Tj Jabatan');
}

// Menambahkan kolom Jam pada Jurnal tanpa menghapus atau mengubah data lama.
function ensureKolomJamJurnal_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jurnal');
  if (!sh) return;
  if (sh.getMaxColumns() < 9) sh.insertColumnsAfter(sh.getMaxColumns(), 9 - sh.getMaxColumns());
  if (!String(sh.getRange(1, 9).getDisplayValue()).trim()) sh.getRange(1, 9).setValue('Jam');
}

function checkLogin(username, password) {
  var sheet = getSheetSafe('Pengguna');
  var data = sheet.getDataRange().getDisplayValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(username).trim() && String(data[i][2]).trim() === String(password).trim()) {
      var role = data[i][3];
      var nama = data[i][4];
      var akses = data[i][5] ? String(data[i][5]).trim() : getDefaultAksesByRole(role);
      var aksesDetail = {};
      try { aksesDetail = data[i][6] ? JSON.parse(data[i][6]) : getDefaultDetailAksesByRole_(role); } catch (e) { aksesDetail = getDefaultDetailAksesByRole_(role); }

      // Kompatibilitas akun lama: tambahkan modul baru tanpa meminta admin membuat ulang akun.
      // Administrator selalu mendapat akses penuh, termasuk WhatsApp Gateway dan Absensi QR.
      if (String(role).trim().toLowerCase() === 'administrator') {
        aksesDetail = getDefaultDetailAksesByRole_('Administrator');
        akses = Object.keys(aksesDetail).join(',');
      } else {
        if (!aksesDetail || typeof aksesDetail !== 'object') aksesDetail = getDefaultDetailAksesByRole_(role);
        if (String(role).trim().toLowerCase() === 'guru' && aksesDetail.whatsapp === undefined) aksesDetail.whatsapp = 'off';
        if (String(role).trim().toLowerCase() === 'siswa' && aksesDetail.absensiQr === undefined) aksesDetail.absensiQr = 'edit';
        // Akses legacy tetap dipertahankan; menu baru tidak otomatis diberikan ke non-admin.
      }

      var sessionToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      CacheService.getScriptCache().put('MASDA_SESSION_' + sessionToken, JSON.stringify({
        role: role,
        nama: nama,
        username: data[i][1],
        akses: akses,
        aksesDetail: aksesDetail
      }), 21600); // Maksimal 6 jam; token tidak menyimpan password.
      return {
        success: true,
        role: role,
        nama: nama,
        username: data[i][1],
        akses: akses,
        aksesDetail: aksesDetail,
        sessionToken: sessionToken
      };
    }
  }
  return { success: false, message: 'Username atau Password salah!' };
}

// Mengambil kembali sesi setelah refresh tanpa menyimpan username/password di browser.
function getSessionUser(token) {
  token = String(token || '').trim();
  if (!token || !/^[a-f0-9]{40,80}$/i.test(token)) return { success: false };
  var cache = CacheService.getScriptCache();
  var key = 'MASDA_SESSION_' + token;
  var raw = cache.get(key);
  if (!raw) return { success: false };
  try {
    var user = JSON.parse(raw);
    user.success = true;
    user.sessionToken = token;
    return user;
  } catch (e) {
    cache.remove(key);
    return { success: false };
  }
}

// Mengakhiri sesi pada saat pengguna menekan Keluar.
function logoutSession(token) {
  token = String(token || '').trim();
  if (token && /^[a-f0-9]{40,80}$/i.test(token)) {
    CacheService.getScriptCache().remove('MASDA_SESSION_' + token);
  }
  return { success: true };
}

// Ringkasan Statistik Dashboard
function getDashboardSummary() {
  var totalSiswa = Math.max(0, getSheetSafe('Siswa').getLastRow() - 1);
  var totalGuru = Math.max(0, getSheetSafe('Guru').getLastRow() - 1);
  var totalKelas = Math.max(0, getSheetSafe('Kelas').getLastRow() - 1);

  // Statistik Sarpras
  var sarprasData = getSheetSafe('Sarpras').getDataRange().getDisplayValues();
  var baik = 0, rRingan = 0, rBerat = 0, totalUnitSarpras = 0;
  var kategoriMap = {};
  var hasKategoriCol = sarprasData.length > 0 && sarprasData[0].length >= 7;

  for (var i = 1; i < sarprasData.length; i++) {
    var kat = hasKategoriCol ? (String(sarprasData[i][2]).trim() || 'Umum') : 'Umum';
    var totalBarang = hasKategoriCol ? (Number(sarprasData[i][3]) || 0) : (Number(sarprasData[i][2]) || 0);
    var bk = hasKategoriCol ? (Number(sarprasData[i][4]) || 0) : (Number(sarprasData[i][3]) || 0);
    var rr = hasKategoriCol ? (Number(sarprasData[i][5]) || 0) : (Number(sarprasData[i][4]) || 0);
    var rb = hasKategoriCol ? (Number(sarprasData[i][6]) || 0) : (Number(sarprasData[i][5]) || 0);

    baik += bk;
    rRingan += rr;
    rBerat += rb;
    totalUnitSarpras += totalBarang;

    if (!kategoriMap[kat]) {
      kategoriMap[kat] = { totalUnit: 0, baik: 0, ringan: 0, berat: 0, totalJenis: 0 };
    }
    kategoriMap[kat].totalUnit += totalBarang;
    kategoriMap[kat].baik += bk;
    kategoriMap[kat].ringan += rr;
    kategoriMap[kat].berat += rb;
    kategoriMap[kat].totalJenis += 1;
  }

  var listKategoriSummary = [];
  for (var kName in kategoriMap) {
    listKategoriSummary.push({
      kategori: kName,
      totalUnit: kategoriMap[kName].totalUnit,
      baik: kategoriMap[kName].baik,
      ringan: kategoriMap[kName].ringan,
      berat: kategoriMap[kName].berat,
      totalJenis: kategoriMap[kName].totalJenis
    });
  }

  // Statistik Absensi Siswa Hari Ini
  var absensiSheet = getSheetSafe('Absensi');
  var absensiData = absensiSheet.getDataRange().getDisplayValues();
  var todayStr = getTodayDateString();
  // Pastikan semua siswa memiliki empat status awal hari ini agar Alpha ikut terhitung pada dashboard.
  var siswaDashboard = getSheetSafe('Siswa').getDataRange().getDisplayValues();
  var gerbangDashboard = getSheetSafe('Absensi Gerbang').getDataRange().getDisplayValues();
  var gateStatusDashboard = {}, absensiKeysDashboard = {};
  for (var gd=1;gd<gerbangDashboard.length;gd++) {
    if(String(gerbangDashboard[gd][0]).trim()===todayStr && String(gerbangDashboard[gd][1]||'').trim()) {
      var gateNisn=String(gerbangDashboard[gd][3]||'').trim();
      var gateStatus=String(gerbangDashboard[gd][6]||'Hadir').trim()||'Hadir';
      gateStatusDashboard[gateNisn]=(['Izin','Sakit'].indexOf(gateStatus)>=0)?gateStatus:'Hadir';
    }
  }
  for (var ad=1;ad<absensiData.length;ad++) {
    if(String(absensiData[ad][0]).trim()===todayStr) absensiKeysDashboard[String(absensiData[ad][1]).trim()+'*'+String(absensiData[ad][2]).trim()] = ad+1;
  }
  for (var sd=1;sd<siswaDashboard.length;sd++) {
    var nisnDashboard=String(siswaDashboard[sd][0]||'').trim(), kelasDashboard=String(siswaDashboard[sd][2]||'').trim();
    if(!nisnDashboard || !kelasDashboard) continue;
    var absKeyDashboard=kelasDashboard+'*'+nisnDashboard;
    var defaultStatus=gateStatusDashboard[nisnDashboard]||'Alpha';
    var existingAbsRow=absensiKeysDashboard[absKeyDashboard];
    if(!existingAbsRow) {
      absensiSheet.appendRow([todayStr,kelasDashboard,nisnDashboard,siswaDashboard[sd][1]||'',defaultStatus,defaultStatus,defaultStatus,defaultStatus]);
      absensiKeysDashboard[absKeyDashboard]=absensiSheet.getLastRow();
    } else {
      // Lengkapi sel kosong agar semua siswa terhitung pada statistik hari ini, tanpa menimpa status yang sudah dicatat guru.
      var existingVals=absensiSheet.getRange(existingAbsRow,5,1,4).getDisplayValues()[0], changed=false;
      for(var ac=0;ac<4;ac++) {
        if(!String(existingVals[ac]||'').trim()) { existingVals[ac]=defaultStatus; changed=true; }
      }
      if(changed) absensiSheet.getRange(existingAbsRow,5,1,4).setValues([existingVals]);
    }
  }
  SpreadsheetApp.flush();
  absensiData = absensiSheet.getDataRange().getDisplayValues();
  // Statistik dihitung per siswa (satu siswa hanya masuk satu kategori), bukan per jam pelajaran.
  var totalSiswaHariIni=0,totalHadirHariIni=0,totalBolosHariIni=0,totalIzinHariIni=0,totalSakitHariIni=0,totalAlphaHariIni=0;
  var siswaHariIniTercatat={};
  for (var j=1;j<absensiData.length;j++) {
    if (String(absensiData[j][0]).trim()!==todayStr) continue;
    var kelasRow=String(absensiData[j][1]||'').trim();
    var nisnRow=String(absensiData[j][2]||'').trim();
    var studentKey=(kelasRow+'*'+nisnRow).trim();
    if(!nisnRow || siswaHariIniTercatat[studentKey]) continue;
    siswaHariIniTercatat[studentKey]=true;
    totalSiswaHariIni++;
    var statusCounts={hadir:0,bolos:0,izin:0,sakit:0,alpha:0};
    var statusOrder=[];
    [absensiData[j][4],absensiData[j][5],absensiData[j][6],absensiData[j][7]].forEach(function(val){
      var st=String(val||'').trim().toLowerCase();
      if(!st) return;
      if(st==='hadir') st='hadir';
      else if(st==='izin') st='izin';
      else if(st==='sakit') st='sakit';
      else if(st==='alpha'||st==='alfa') st='alpha';
      else st='bolos';
      if(statusCounts[st]===0 && statusOrder.indexOf(st)<0) statusOrder.push(st);
      statusCounts[st]++;
    });
    // Pilih status terbanyak dari empat jam pelajaran. Jika seri, gunakan status pertama yang tercatat.
    var dailyStatus='alpha', maxStatusCount=-1;
    statusOrder.forEach(function(st){
      if(statusCounts[st]>maxStatusCount){dailyStatus=st;maxStatusCount=statusCounts[st];}
    });
    if(dailyStatus==='hadir') totalHadirHariIni++;
    else if(dailyStatus==='izin') totalIzinHariIni++;
    else if(dailyStatus==='sakit') totalSakitHariIni++;
    else if(dailyStatus==='alpha') totalAlphaHariIni++;
    else totalBolosHariIni++;
  }
  var pctHadirHariIni=totalSiswaHariIni?Math.round(totalHadirHariIni/totalSiswaHariIni*100):0;
  var pctBolosHariIni=totalSiswaHariIni?Math.round(totalBolosHariIni/totalSiswaHariIni*100):0;
  var pctIzinHariIni=totalSiswaHariIni?Math.round(totalIzinHariIni/totalSiswaHariIni*100):0;
  var pctSakitHariIni=totalSiswaHariIni?Math.round(totalSakitHariIni/totalSiswaHariIni*100):0;
  var pctAlphaHariIni=totalSiswaHariIni?Math.round(totalAlphaHariIni/totalSiswaHariIni*100):0;

  // Statistik Absensi Guru (Jurnal) Hari Ini
  var jurnalData = getSheetSafe('Jurnal').getDataRange().getDisplayValues();
  var totalJurnalGuruHariIni = 0, totalHadirGuruHariIni = 0, totalTidakHadirGuruHariIni = 0;

  for (var k = 1; k < jurnalData.length; k++) {
    var jgDate = String(jurnalData[k][1]).trim();
    var statusAbsen = String(jurnalData[k][6] || '').trim();

    if ((jurnalData[k][0] || jgDate) && jgDate === todayStr) {
      totalJurnalGuruHariIni++;
      if (statusAbsen.indexOf('Hadir') > -1) totalHadirGuruHariIni++;
      else totalTidakHadirGuruHariIni++;
    }
  }

  var pctHadirGuruHariIni = totalJurnalGuruHariIni > 0 ? Math.round((totalHadirGuruHariIni / totalJurnalGuruHariIni) * 100) : 0;
  var pctTidakHadirGuruHariIni = totalJurnalGuruHariIni > 0 ? Math.round((totalTidakHadirGuruHariIni / totalJurnalGuruHariIni) * 100) : 0;

  return {
    siswa: totalSiswa,
    guru: totalGuru,
    kelas: totalKelas,
    sarpras: {
      baik: baik,
      ringan: rRingan,
      berat: rBerat,
      totalUnit: totalUnitSarpras,
      byKategori: listKategoriSummary
    },
    absensiHariIni: {
      pctHadir: pctHadirHariIni,
      pctBolos: pctBolosHariIni,
      totalSiswa:totalSiswaHariIni,totalHadir:totalHadirHariIni,totalBolos:totalBolosHariIni,
      totalIzin:totalIzinHariIni,totalSakit:totalSakitHariIni,totalAlpha:totalAlphaHariIni,pctIzin:pctIzinHariIni,pctSakit:pctSakitHariIni,pctAlpha:pctAlphaHariIni
    },
    absensiGuruHariIni: {
      pctHadir: pctHadirGuruHariIni,
      pctTidakHadir: pctTidakHadirGuruHariIni,
      totalJurnal: totalJurnalGuruHariIni,
      totalHadir: totalHadirGuruHariIni,
      totalTidakHadir: totalTidakHadirGuruHariIni
    }
  };
}

// ==========================================
// PROFIL SEKOLAH
// ==========================================
function getProfil() {
  var data = getSheetSafe('Profil').getDataRange().getDisplayValues();
  var result = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) result[data[i][0]] = data[i][1];
  }
  return result;
}

function simpanProfil(profilData) {
  var sheet = getSheetSafe('Profil');
  sheet.clearContents();
  sheet.appendRow(['Kunci', 'Nilai']);
  for (var key in profilData) {
    sheet.appendRow([key, profilData[key]]);
  }
  return 'Identitas, Logo, & Pin Lokasi Sekolah berhasil diperbarui!';
}

// ==========================================
// STRUKTUR ORGANISASI
// ==========================================
function getStruktur() {
  var data = getSheetSafe('Struktur').getDataRange().getDisplayValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1]) {
      list.push({
        id: String(data[i][0] || i),
        nama: String(data[i][1]),
        jabatan: String(data[i][2]),
        parentId: data[i][3] ? String(data[i][3]) : ''
      });
    }
  }
  return list;
}

function simpanStruktur(list) {
  var sheet = getSheetSafe('Struktur');
  sheet.clearContents();
  sheet.appendRow(['ID', 'Nama', 'Jabatan', 'AtasanID']);
  list.forEach(function(item, idx) {
    var itemId = item.id || String(idx + 1);
    sheet.appendRow([itemId, item.nama, item.jabatan, item.parentId || '']);
  });
  return 'Struktur Organisasi berhasil disimpan!';
}


// Migrasi kolom Master Siswa secara aman: kolom lama dipertahankan, kolom baru ditambahkan.
function ensureKolomSiswa_() {
  var sh = getSheetSafe('Siswa');
  var headers = sh.getRange(1, 1, 1, Math.max(4, sh.getLastColumn())).getDisplayValues()[0];
  ['NISN','Nama','Kelas','Jenis Kelamin','No HP Wali','ID Card','Akses Menu','Akses Detail','Foto'].forEach(function(h) {
    if (headers.indexOf(h) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(h); headers.push(h); }
  });
  setKolomIdentitasSebagaiTeks_(sh, headers.indexOf('NISN') + 1);
  setKolomIdentitasSebagaiTeks_(sh, headers.indexOf('ID Card') + 1);
}
function ensureAbsensiGerbangSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Absensi Gerbang');
  if (!sh) { sh = ss.insertSheet('Absensi Gerbang'); sh.appendRow(['Tanggal','Waktu Masuk','Waktu Pulang','NISN','Nama','Kelas','Status']); }
}
function getSiswaHeaderMap_() {
  var sh = getSheetSafe('Siswa'), headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0], map = {};
  headers.forEach(function(h,i){ map[String(h).trim()] = i; }); return map;
}

// ==========================================
// DATA MASTER (GURU, KELAS, SISWA, JADWAL)
// ==========================================
function getMasterData() {
  ensureKolomSiswa_();
  ensureKolomGuruTambahan_();
  var guru = getSheetSafe('Guru').getDataRange().getDisplayValues();
  var kelas = getSheetSafe('Kelas').getDataRange().getDisplayValues();
  var siswaSheet = getSheetSafe('Siswa');
  var siswa = siswaSheet.getDataRange().getDisplayValues();
  var siswaHm = getSiswaHeaderMap_();
  var siswaRows = siswa.length > 1 ? siswa.slice(1).map(function(r) {
    return [r[siswaHm['NISN']] || '', r[siswaHm['Nama']] || '', r[siswaHm['Kelas']] || '', r[siswaHm['Jenis Kelamin']] || '', r[siswaHm['No HP Wali']] || '', r[siswaHm['ID Card']] || '', r[siswaHm['Akses Menu']] || '', r[siswaHm['Akses Detail']] || '', r[siswaHm['Foto']] || ''];
  }) : [];
  var jadwal = getSheetSafe('Jadwal').getDataRange().getDisplayValues();

  var users = getSheetSafe('Pengguna').getDataRange().getDisplayValues();
  var guruRows = guru.length > 1 ? guru.slice(1) : [];
  guruRows = guruRows.map(function(g) {
    var account = users.slice(1).find(function(u) {
      return String(u[3]).trim().toLowerCase() === 'guru' && String(u[4]).trim().toLowerCase() === String(g[1]).trim().toLowerCase();
    });
    // Pertahankan indeks akun [6..9] yang dipakai UI lama; data baru berada setelahnya.
    return g.slice(0,6).concat(account ? [account[1] || '', account[2] || '', account[0] || '', account[6] || ''] : ['', '', '', ''], [g[6] || '', g[7] || '', g[8] || '']);
  });
  return {
    guru: guruRows,
    kelas: kelas.length > 1 ? kelas.slice(1) : [],
    siswa: siswaRows,
    jadwal: jadwal.length > 1 ? jadwal.slice(1) : []
  };
}

// Pastikan kolom identitas diperlakukan sebagai TEKS agar nol di depan tidak hilang.
// Format ini berlaku untuk data baru dan pembaruan berikutnya.
function setKolomIdentitasSebagaiTeks_(sheet, columnNumber) {
  if (sheet && sheet.getMaxRows() > 0) {
    sheet.getRange(1, columnNumber, sheet.getMaxRows(), 1).setNumberFormat('@');
  }
}

function normalisasiIdentitas_(value) {
  // Jangan gunakan Number/parseInt untuk NIP/NISN karena identitas bukan angka hitung.
  return value === null || value === undefined ? '' : String(value).trim();
}

// --- MASTER GURU ---
function simpanGuru(data) {
  ensureKolomGuruTambahan_();
  var sheet = getSheetSafe('Guru'), hm = guruHeaderMap_();
  setKolomIdentitasSebagaiTeks_(sheet, hm['NIP'] || 1);
  data = data || {};
  data.nip = normalisasiIdentitas_(data.nip);
  data.oldNip = normalisasiIdentitas_(data.oldNip);
  if (!data.nip || !String(data.nama || '').trim()) throw new Error('NIP dan Nama Guru wajib diisi.');
  var rows = sheet.getDataRange().getDisplayValues(), targetNip = data.oldNip || data.nip;
  var foundIndex = -1, oldNama = '';
  for (var i=1;i<rows.length;i++) if (String(rows[i][(hm['NIP']||1)-1]) === String(targetNip)) {foundIndex=i+1;oldNama=rows[i][(hm['Nama']||2)-1];break;}
  var aksesDetail = data.aksesDetail && typeof data.aksesDetail === 'object' ? data.aksesDetail : getDefaultDetailAksesByRole_('Guru');
  var akses = Object.keys(aksesDetail).filter(function(k){return aksesDetail[k] !== 'off';}).join(',');
  var akunSheet=getSheetSafe('Pengguna'); ensureKolomDetailAkses_();
  var akunRows=akunSheet.getDataRange().getDisplayValues(), akunIndex=-1;
  for(var ai=1;ai<akunRows.length;ai++){
    if(String(akunRows[ai][3]).trim().toLowerCase()==='guru' &&
      (String(akunRows[ai][4]).trim().toLowerCase()===String(oldNama||data.nama).trim().toLowerCase() ||
       String(akunRows[ai][1]).trim().toLowerCase()===String(data.nip).trim().toLowerCase())){akunIndex=ai+1;break;}
  }
  var desiredUsername=String(data.username||'').trim(), desiredPassword=String(data.password||'').trim();
  if(desiredUsername && akunRows.some(function(r,idx){return idx>0 && idx+1!==akunIndex && String(r[1]||'').trim().toLowerCase()===desiredUsername.toLowerCase();}))
    throw new Error('Username "'+desiredUsername+'" sudah digunakan akun lain. Silakan pilih username berbeda.');
  var oldPhoto = '';
  if (foundIndex > -1 && hm['Foto']) oldPhoto = String(sheet.getRange(foundIndex,hm['Foto']).getDisplayValue()||'');
  var photo = String(data.foto || '').trim() || oldPhoto;
  if (photo.length > 45000) throw new Error('Data foto terlalu besar setelah kompresi. Silakan pilih foto yang lebih sederhana.');
  var values = {};
  values['NIP']=data.nip; values['Nama']=String(data.nama).trim();
  if(hm['Email']) values['Email']=String(data.email||'').trim(); // kolom lama tetap kompatibel, tidak ditampilkan pada form.
  values['Mata Pelajaran']=String(data.mapel||'').trim();
  values['Tj Transpot']=Number(data.transport)||0; values['Tj Jabatan']=Number(data.tjJabatan !== undefined ? data.tjJabatan : data.jabatan)||0;
  values['Tarif/Jam']=Number(data.tarif)||0; values['Foto']=photo; values['Jabatan']=String(data.jabatanNama||'Guru').trim();
  function writeGuruRow(row) {
    Object.keys(values).forEach(function(h){ if(hm[h]) sheet.getRange(row,hm[h]).setValue(values[h]); });
  }
  if(foundIndex>-1){writeGuruRow(foundIndex);if(oldNama && oldNama!==data.nama) updateNamaGuruDiJadwalDanKelas(oldNama,data.nama);}
  else {sheet.appendRow(new Array(sheet.getLastColumn()).fill(''));writeGuruRow(sheet.getLastRow());foundIndex=sheet.getLastRow();}
  if(akunIndex>-1){
    akunSheet.getRange(akunIndex,5).setValue(data.nama);
    akunSheet.getRange(akunIndex,6,1,2).setValues([[akses,JSON.stringify(aksesDetail)]]);
  } else {
    provisionAkunGuru_({nip:data.nip,nama:data.nama,aksesDetail:aksesDetail});
  }
  var fresh=akunSheet.getDataRange().getDisplayValues();
  for(var u=1;u<fresh.length;u++){
    if(String(fresh[u][3]).trim().toLowerCase()==='guru' &&
      (String(fresh[u][4]).trim().toLowerCase()===String(data.nama).trim().toLowerCase() ||
       String(fresh[u][1]).trim().toLowerCase()===String(data.nip).trim().toLowerCase() ||
       (akunIndex>-1 && u+1===akunIndex))){
      if(desiredUsername) akunSheet.getRange(u+1,2).setValue(desiredUsername);
      if(desiredPassword) akunSheet.getRange(u+1,3).setValue(desiredPassword);
      break;
    }
  }
  return foundIndex ? (data.oldNip ? 'Data Guru berhasil diperbarui beserta foto, tarif/jam, jabatan, akun dan hak akses.' : 'Data Guru berhasil disimpan beserta foto, tarif/jam, jabatan, akun dan hak akses.') : 'Data Guru berhasil disimpan.';
}
function hapusGuru(nip) {
  var sheet = getSheetSafe('Guru');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nip)) {
      var namaGuru = data[i][1];
      sheet.deleteRow(i + 1);
      updateNamaGuruDiJadwalDanKelas(namaGuru, '-');
      return 'Guru berhasil dihapus!';
    }
  }
  return 'Data guru tidak ditemukan!';
}

function simpanBatchGuru(guruList) {
  var sheet = getSheetSafe('Guru');
  setKolomIdentitasSebagaiTeks_(sheet, 1);
  guruList.forEach(function(item) {
    if (item.nip && item.nama) {
      sheet.appendRow([normalisasiIdentitas_(item.nip), item.nama, item.email || '', item.mapel || '']);
    }
  });
  return guruList.length + ' Data Guru berhasil di-upload dari Excel!';
}

function updateNamaGuruDiJadwalDanKelas(oldNama, newNama) {
  var jadwalSheet = getSheetSafe('Jadwal');
  var jData = jadwalSheet.getDataRange().getDisplayValues();
  for (var j = 1; j < jData.length; j++) {
    if (String(jData[j][5]).trim() === String(oldNama).trim()) {
      jadwalSheet.getRange(j + 1, 6).setValue(newNama);
    }
  }

  var kelasSheet = getSheetSafe('Kelas');
  var kData = kelasSheet.getDataRange().getDisplayValues();
  for (var k = 1; k < kData.length; k++) {
    if (String(kData[k][2]).trim() === String(oldNama).trim()) {
      kelasSheet.getRange(k + 1, 3).setValue(newNama);
    }
  }
}

// --- MASTER KELAS ---
function simpanKelas(data) {
  var sheet = getSheetSafe('Kelas');
  var rows = sheet.getDataRange().getDisplayValues();
  var foundIndex = -1;

  if (data.id) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        foundIndex = i + 1;
        break;
      }
    }
  }

  if (foundIndex > -1) {
    sheet.getRange(foundIndex, 1, 1, 3).setValues([[data.id, data.namaKelas, data.waliKelas]]);
    return 'Data Kelas berhasil diperbarui!';
  } else {
    var newId = 'K' + new Date().getTime().toString().substr(-4);
    sheet.appendRow([newId, data.namaKelas, data.waliKelas]);
    return 'Data Kelas baru berhasil ditambahkan!';
  }
}

function hapusKelas(id) {
  var sheet = getSheetSafe('Kelas');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return 'Kelas berhasil dihapus!';
    }
  }
  return 'Data kelas tidak ditemukan!';
}

function simpanBatchKelas(kelasList) {
  var sheet = getSheetSafe('Kelas');
  kelasList.forEach(function(item) {
    if (item.namaKelas) {
      var classId = item.id || ('K' + Math.floor(100 + Math.random() * 900));
      sheet.appendRow([classId, item.namaKelas, item.waliKelas || '']);
    }
  });
  return kelasList.length + ' Data Kelas berhasil di-upload dari Excel!';
}

// --- MASTER SISWA ---
function simpanSiswa(data) {
  ensureKolomSiswa_();
  var sheet = getSheetSafe('Siswa'), hm = getSiswaHeaderMap_();
  setKolomIdentitasSebagaiTeks_(sheet, hm['NISN'] + 1);
  setKolomIdentitasSebagaiTeks_(sheet, hm['ID Card'] + 1);
  data.nisn = normalisasiIdentitas_(data.nisn); data.oldNisn = normalisasiIdentitas_(data.oldNisn);
  var rows = sheet.getDataRange().getDisplayValues(), foundIndex = -1;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][hm['NISN']] || '') === String(data.oldNisn || data.nisn)) { foundIndex = i + 1; break; }
  var row = foundIndex > -1 ? sheet.getRange(foundIndex,1,1,sheet.getLastColumn()).getDisplayValues()[0] : new Array(sheet.getLastColumn()).fill('');
  row[hm['NISN']] = data.nisn; row[hm['Nama']] = String(data.nama || '').trim(); row[hm['Kelas']] = String(data.kelas || '').trim();
  row[hm['Jenis Kelamin']] = String(data.jk || 'Laki-laki'); row[hm['No HP Wali']] = normalisasiNomorHpWali_(data.noHpWali || '');
  row[hm['ID Card']] = data.idCard ? String(data.idCard).trim() : ('MASDA-' + data.nisn);
  // Hak akses siswa dapat diatur admin per siswa; bila belum pernah diatur, gunakan akses siswa standar.
  var aksesDefault = getDefaultAksesByRole('Siswa');
  var detailDefault = JSON.stringify(getDefaultDetailAksesByRole_('Siswa'));
  row[hm['Akses Menu']] = data.akses !== undefined ? String(data.akses || '') : String(row[hm['Akses Menu']] || aksesDefault);
  row[hm['Akses Detail']] = data.aksesDetail !== undefined ? (typeof data.aksesDetail === 'string' ? data.aksesDetail : JSON.stringify(data.aksesDetail || {})) : String(row[hm['Akses Detail']] || detailDefault);
  var oldPhoto = foundIndex > -1 && hm['Foto'] !== undefined ? String(row[hm['Foto']] || '') : '';
  var photo = String(data.foto || '').trim() || oldPhoto;
  if (photo.length > 45000) throw new Error('Foto siswa terlalu besar. Silakan pilih foto lain.');
  if (hm['Foto'] !== undefined) row[hm['Foto']] = photo;
  if (!row[hm['Akses Menu']]) row[hm['Akses Menu']] = aksesDefault;
  if (!row[hm['Akses Detail']]) row[hm['Akses Detail']] = detailDefault;
  if (foundIndex > -1) sheet.getRange(foundIndex,1,1,row.length).setNumberFormat('@').setValues([row]); else sheet.appendRow(row);
  return foundIndex > -1 ? 'Data Siswa berhasil diperbarui!' : 'Data Siswa baru berhasil ditambahkan!';
}
function normalisasiNomorHpWali_(nomor) { return String(nomor || '').trim().replace(/[\s().-]/g,'').replace(/^0/,'62').replace(/^\+/,''); }

function hapusSiswa(nisn) {
  var sheet = getSheetSafe('Siswa');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nisn)) {
      sheet.deleteRow(i + 1);
      return 'Siswa berhasil dihapus!';
    }
  }
  return 'Data siswa tidak ditemukan!';
}

function simpanBatchSiswa(siswaList) {
  ensureKolomSiswa_();
  var sheet = getSheetSafe('Siswa'); setKolomIdentitasSebagaiTeks_(sheet, 1);
  var hm = getSiswaHeaderMap_();
  siswaList.forEach(function(item) {
    if (item.nisn && item.nama) {
      var row = new Array(sheet.getLastColumn()).fill('');
      row[hm['NISN']] = normalisasiIdentitas_(item.nisn); row[hm['Nama']] = item.nama; row[hm['Kelas']] = item.kelas || '';
      row[hm['Jenis Kelamin']] = item.jk || 'Laki-laki'; row[hm['No HP Wali']] = normalisasiNomorHpWali_(item.noHpWali || '');
      row[hm['ID Card']] = 'MASDA-' + normalisasiIdentitas_(item.nisn); sheet.appendRow(row);
    }
  });
  return siswaList.length + ' Data Siswa berhasil di-upload dari Excel!';
}

// --- MASTER JADWAL MAPEL ---
function simpanJadwal(data) {
  var sheet = getSheetSafe('Jadwal');
  var rows = sheet.getDataRange().getDisplayValues();
  var targetId = data.oldId || data.id;
  var foundIndex = -1;

  if (targetId) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(targetId)) {
        foundIndex = i + 1;
        break;
      }
    }
  }

  if (foundIndex > -1) {
    sheet.getRange(foundIndex, 1, 1, 6).setValues([[data.id || targetId, data.hari, data.kelas, data.jam, data.mapel, data.guru]]);
    return 'Data Jadwal Pelajaran berhasil diperbarui!';
  } else {
    var newId = data.id || ('JDW' + new Date().getTime().toString().substr(-4));
    sheet.appendRow([newId, data.hari, data.kelas, data.jam, data.mapel, data.guru]);
    return 'Data Jadwal Pelajaran baru berhasil ditambahkan!';
  }
}

function hapusJadwal(id) {
  var sheet = getSheetSafe('Jadwal');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return 'Jadwal berhasil dihapus!';
    }
  }
  return 'Data jadwal tidak ditemukan!';
}

function simpanBatchJadwal(jadwalList) {
  var sheet = getSheetSafe('Jadwal');
  jadwalList.forEach(function(item) {
    if (item.hari && item.kelas && item.mapel) {
      var jdwId = item.id || ('JDW' + Math.floor(100 + Math.random() * 900));
      sheet.appendRow([jdwId, item.hari, item.kelas, item.jam || 'Jam 1', item.mapel, item.guru || '-']);
    }
  });
  return jadwalList.length + ' Data Jadwal Pelajaran berhasil di-upload dari Excel!';
}

// ==========================================
// JURNAL GURU & VALIDASI GPS / JADWAL
// ==========================================
function getJurnalData() {
  var sheet = getSheetSafe('Jurnal');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var numCols = Math.max(8, sheet.getLastColumn());
  return sheet.getRange(2, 1, lastRow - 1, numCols).getDisplayValues();
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function simpanJurnal(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureKolomJamJurnal_();
    var hariTarget = String(data.hari || '').trim();
    if (!hariTarget && data.tanggal) {
      var dateParts = String(data.tanggal).split('-');
      if (dateParts.length === 3) {
        var dateObj = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        hariTarget = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];
      }
    }
    var jamTarget = String(data.jam || '').trim();
    if (!jamTarget) return 'Gagal Simpan: pilih jam pelajaran terlebih dahulu.';
    var jadwalData = getSheetSafe('Jadwal').getDataRange().getDisplayValues(), hasSchedule = false;
    for (var j = 1; j < jadwalData.length; j++) {
      if (String(jadwalData[j][1] || '').trim().toLowerCase() === hariTarget.toLowerCase() &&
          String(jadwalData[j][5] || '').trim().toLowerCase() === String(data.guru).trim().toLowerCase() &&
          String(jadwalData[j][2] || '').trim().toLowerCase() === String(data.kelas).trim().toLowerCase() &&
          String(jadwalData[j][3] || '').trim().toLowerCase() === jamTarget.toLowerCase() &&
          String(jadwalData[j][4] || '').trim().toLowerCase() === String(data.mapel).trim().toLowerCase()) { hasSchedule = true; break; }
    }
    if (!hasSchedule) return 'Gagal Simpan: jadwal ' + hariTarget + ', ' + jamTarget + ', kelas ' + data.kelas + ' untuk guru ' + data.guru + ' tidak ditemukan. Periksa kembali pilihan jurnal.';
    var sheet = getSheetSafe('Jurnal'), existing = sheet.getDataRange().getDisplayValues();
    var normalize = function(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); };
    for (var r = 1; r < existing.length; r++) {
      var row = existing[r];
      var sameHour = normalize(row[8]) === normalize(jamTarget);
      // Untuk jurnal lama yang belum menyimpan kolom Jam, cocokkan kembali melalui jadwal.
      if (!String(row[8] || '').trim()) {
        sameHour = jadwalData.slice(1).some(function(j) {
          return normalize(j[1]) === normalize(hariTarget) && normalize(j[5]) === normalize(row[2]) &&
            normalize(j[2]) === normalize(row[4]) && normalize(j[4]) === normalize(row[3]) && normalize(j[3]) === normalize(jamTarget);
        });
      }
      if (String(row[1] || '').trim() === String(data.tanggal || '').trim() && normalize(row[2]) === normalize(data.guru) &&
          normalize(row[4]) === normalize(data.kelas) && sameHour) {
        return 'Jurnal sudah pernah diisi: Anda sudah mengisi jurnal untuk tanggal ' + data.tanggal + ', hari ' + hariTarget + ', kelas ' + data.kelas + ', ' + jamTarget + '. Data tidak disimpan agar tidak terjadi duplikasi.';
      }
    }
    var profData = getSheetSafe('Profil').getDataRange().getDisplayValues();
    var schoolLat = -6.200000, schoolLng = 106.816666, schoolRadius = 100;
    for (var i = 1; i < profData.length; i++) {
      if (profData[i][0] === 'Latitude') schoolLat = parseFloat(profData[i][1]) || schoolLat;
      if (profData[i][0] === 'Longitude') schoolLng = parseFloat(profData[i][1]) || schoolLng;
      if (profData[i][0] === 'Radius') schoolRadius = parseFloat(profData[i][1]) || schoolRadius;
    }
    var statusAbsen = 'Tidak Masuk (GPS Mati)', distStr = '-', responseMsg = '';
    if (data.lat !== undefined && data.lat !== '' && data.lng !== undefined && data.lng !== '') {
      var distance = calculateDistanceMeters(parseFloat(data.lat), parseFloat(data.lng), schoolLat, schoolLng);
      distStr = distance + ' meter';
      if (distance <= schoolRadius) { statusAbsen = 'Hadir (Dalam Radius)'; responseMsg = 'Jurnal berhasil disimpan & Anda DITERIMA ABSEN MASUK (Jarak dari sekolah: ' + distance + 'm).'; }
      else { statusAbsen = 'Tidak Masuk (Luar Radius)'; responseMsg = 'Jurnal disimpan, NAMUN Anda berada di luar radius sekolah (' + distance + 'm > ' + schoolRadius + 'm). Status Absen: TIDAK MASUK!'; }
    } else responseMsg = 'Jurnal disimpan, TETAPI lokasi GPS tidak terdeteksi. Status Absen: TIDAK MASUK!';
    var newId = 'JRN-' + new Date().getTime().toString().substr(-5);
    sheet.appendRow([newId, data.tanggal, data.guru, data.mapel, data.kelas, data.materi, statusAbsen, distStr, jamTarget]);
    return responseMsg;
  } finally { lock.releaseLock(); }
}

function hapusJurnal(id) {
  var sheet = getSheetSafe('Jurnal');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return 'Catatan jurnal berhasil dihapus!';
    }
  }
  return 'Data jurnal tidak ditemukan!';
}

// ==========================================
// HONOR GURU (FITUR 3)
// ==========================================
function getRekapHonorGuru(bulanTahun) {
  ensureKolomTunjanganGuru_();
  var guruData = getSheetSafe('Guru').getDataRange().getDisplayValues().slice(1);
  var jurnalData = getSheetSafe('Jurnal').getDataRange().getDisplayValues().slice(1);
  var honorMap = {};

  guruData.forEach(function(g) {
    var nama = String(g[1] || '').trim();
    if (!nama) return;
    honorMap[nama.toLowerCase()] = {
      nip: String(g[0] || '-').trim(), nama: nama, kehadiran: 0,
      hariTransport: 0, transport: Number(String(g[4] || '0').replace(/[^0-9.-]/g, '')) || 0,
      jabatan: Number(String(g[5] || '0').replace(/[^0-9.-]/g, '')) || 0,
      _hariTransportTerhitung: {}
    };
  });

  jurnalData.forEach(function(j) {
    var date = normalizeTanggalHonor_(j[1]);
    var status = String(j[6] || '').trim().toLowerCase();
    // Honor per jurnal/jam hanya dihitung jika status hadir dan GPS berada dalam radius.
    if (date.substring(0, 7) !== String(bulanTahun) ||
        status.indexOf('hadir') === -1 || status.indexOf('tidak') !== -1 ||
        status.indexOf('radius') === -1) return;

    var namaGuru = String(j[2] || '').trim();
    if (!namaGuru) return;
    var key = namaGuru.toLowerCase();
    if (!honorMap[key]) {
      honorMap[key] = { nip: '-', nama: namaGuru, kehadiran: 0, hariTransport: 0,
        transport: 0, jabatan: 0, _hariTransportTerhitung: {} };
    }

    var item = honorMap[key];
    // Setiap baris jurnal valid dihitung sebagai satu jam/pertemuan honor.
    item.kehadiran++;
    // Transport hanya satu kali per guru per tanggal, meskipun jurnal beberapa jam.
    if (!item._hariTransportTerhitung[date]) {
      item._hariTransportTerhitung[date] = true;
      item.hariTransport++;
    }
  });

  return Object.keys(honorMap).map(function(k) {
    var item = honorMap[k];
    delete item._hariTransportTerhitung;
    return item;
  }).filter(function(x) { return x.kehadiran > 0; })
    .sort(function(a, b) { return a.nama.localeCompare(b.nama); });
}

function normalizeTanggalHonor_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}

function getHonorGuruSaya(bulanTahun, username) {
  // Pencocokan dibuat toleran terhadap spasi, kapitalisasi, dan format akun lama.
  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
  var users = getSheetSafe('Pengguna').getDataRange().getDisplayValues();
  var loginKey = norm(username), user = null;
  for (var i = 1; i < users.length; i++) {
    if (norm(users[i][1]) === loginKey) { user = users[i]; break; }
  }
  // Fallback kompatibilitas bila username yang dikirim berupa nama akun lama.
  if (!user) {
    for (var j = 1; j < users.length; j++) {
      if (norm(users[j][4]) === loginKey && norm(users[j][3]).indexOf('guru') !== -1) { user = users[j]; break; }
    }
  }
  var guruRows = getSheetSafe('Guru').getDataRange().getDisplayValues().slice(1);
  // Jika akun lama tidak ditemukan persis di Pengguna, cocokkan username langsung
  // dengan identitas Master Guru; jangan menampilkan data guru lain sebagai fallback.
  if (!user) {
    var byLogin = guruRows.filter(function(g) { return norm(g[0]) === loginKey || norm(g[1]) === loginKey || norm(g[2]) === loginKey; });
    var rekapFallback = getRekapHonorGuru(bulanTahun);
    if (byLogin.length) {
      var targetNip = norm(byLogin[0][0]), targetNama = norm(byLogin[0][1]);
      return rekapFallback.filter(function(item) { return norm(item.nama) === targetNama || (targetNip && norm(item.nip) === targetNip); });
    }
    return [];
  }
  if (norm(user[3]).indexOf('guru') === -1) {
    throw new Error('Akun ini tidak memiliki role Guru. Periksa kolom Role pada sheet Pengguna.');
  }
  var namaAkun = norm(user[4]);
  var userLogin = norm(user[1]);
  var kandidat = guruRows.filter(function(g) {
    var nip = norm(g[0]), nama = norm(g[1]), email = norm(g[2]);
    return (namaAkun && (nama === namaAkun || nip === namaAkun || email === namaAkun)) ||
           (userLogin && (nip === userLogin || nama === userLogin || email === userLogin));
  });
  if (!kandidat.length && namaAkun) {
    kandidat = guruRows.filter(function(g) {
      var nama = norm(g[1]);
      return nama && (nama.indexOf(namaAkun) !== -1 || namaAkun.indexOf(nama) !== -1);
    });
  }
  var rekap = getRekapHonorGuru(bulanTahun);
  if (kandidat.length) {
    var nipTarget = norm(kandidat[0][0]), namaTarget = norm(kandidat[0][1]);
    return rekap.filter(function(item) { return norm(item.nama) === namaTarget || (nipTarget && norm(item.nip) === nipTarget); });
  }
  // Jika guru belum punya kecocokan pada master, gunakan nama akun yang persis.
  var exact = rekap.filter(function(item) { return norm(item.nama) === namaAkun || norm(item.nama) === userLogin; });
  if (exact.length) return exact;
  // Akun valid tetapi belum memiliki jurnal valid pada bulan yang dipilih bukan error akun.
  return [];
}

// ==========================================
// WEBSITE TERKAIT - ADMIN CRUD
// Sheet WebsiteTerkait: ID, Nama, URL, Deskripsi, Ikon, Warna, Urutan, Aktif
// ==========================================
function ensureSheetWebsiteTerkait_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('WebsiteTerkait');
  var headers = ['ID','Nama','URL','Deskripsi','Ikon','Warna','Urutan','Aktif','Logo URL'];
  if (!sh) { sh = ss.insertSheet('WebsiteTerkait'); sh.appendRow(headers); }
  else if (sh.getLastRow() === 0) sh.appendRow(headers);
  else {
    var current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getDisplayValues()[0];
    headers.forEach(function(h, i) { if (!String(current[i] || '').trim()) sh.getRange(1,i+1).setValue(h); });
  }
  if (sh.getLastRow() === 1) {
    sh.appendRow(['WEB-01','Kemenag RI','https://kemenag.go.id','Portal Resmi Kementerian Agama','bi bi-globe2','#2563eb',1,'Ya','']);
    sh.appendRow(['WEB-02','EMIS Kemenag','https://emis.kemenag.go.id','Education Management Information','bi bi-database-check','#16a34a',2,'Ya','']);
    sh.appendRow(['WEB-03','Simpatika','https://simpatika.kemenag.go.id','Sistem Informasi Pendidik','bi bi-people-fill','#d97706',3,'Ya','']);
    sh.appendRow(['WEB-04','Rapor Digital Madrasah','https://pdum.kemenag.go.id','Aplikasi RDM Resmi','bi bi-journal-check','#dc2626',4,'Ya','']);
  }
  return sh;
}
function getWebsiteTerkait(isAdmin) {
  var sh = ensureSheetWebsiteTerkait_(), data = sh.getDataRange().getDisplayValues();
  return data.slice(1).filter(function(r) { return String(r[1] || '').trim() && (String(r[7] || 'Ya').toLowerCase() !== 'tidak' || isAdmin); })
    .map(function(r) { return {id:r[0], nama:r[1], url:r[2], deskripsi:r[3], ikon:r[4] || 'bi bi-globe2', warna:r[5] || '#2563eb', urutan:Number(r[6]) || 999, aktif:String(r[7] || 'Ya').toLowerCase() !== 'tidak', logo:String(r[8] || '')}; })
    .sort(function(a,b) { return a.urutan-b.urutan || a.nama.localeCompare(b.nama); });
}
function simpanWebsiteTerkait(data) {
  var sh = ensureSheetWebsiteTerkait_();
  var url = String(data.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('URL harus diawali http:// atau https://');
  var nama = String(data.nama || '').trim(); if (!nama) throw new Error('Nama website wajib diisi.');
  var rows = sh.getDataRange().getDisplayValues(), id = String(data.id || '').trim(), rowNum = -1;
  for (var i=1;i<rows.length;i++) if (id && String(rows[i][0]) === id) { rowNum=i+1; break; }
  if (!id) id = 'WEB-' + new Date().getTime();
  var logo = String(data.logo || '').trim();
  if (logo && !/^https?:\/\//i.test(logo)) throw new Error('URL logo harus diawali http:// atau https://');
  var row = [id,nama,url,String(data.deskripsi || '').trim(),String(data.ikon || 'bi bi-globe2').trim(),String(data.warna || '#2563eb').trim(),Number(data.urutan)||((sh.getLastRow())),data.aktif === false ? 'Tidak' : 'Ya',logo];
  if (rowNum > 0) sh.getRange(rowNum,1,1,9).setValues([row]); else sh.appendRow(row);
  return 'Website terkait berhasil disimpan.';
}
function hapusWebsiteTerkait(id) {
  var sh = ensureSheetWebsiteTerkait_(), data = sh.getDataRange().getDisplayValues();
  for (var i=1;i<data.length;i++) if (String(data[i][0]) === String(id)) { sh.deleteRow(i+1); return 'Website terkait berhasil dihapus.'; }
  return 'Data website tidak ditemukan.';
}

function getSiswaByKelas(namaKelas, tanggalParam) {
  ensureKolomSiswa_(); ensureAbsensiGerbangSheet_();
  var siswaData=getSheetSafe('Siswa').getDataRange().getDisplayValues();
  var absensiData=getSheetSafe('Absensi').getDataRange().getDisplayValues();
  var gerbangData=getSheetSafe('Absensi Gerbang').getDataRange().getDisplayValues();
  var targetDate=String(tanggalParam||getTodayDateString()).trim(),gateMap={},absensiMap={};
  for(var g=1;g<gerbangData.length;g++) if(String(gerbangData[g][0]).trim()===targetDate&&String(gerbangData[g][1]||'').trim()&&String(gerbangData[g][3]||'').trim()) gateMap[String(gerbangData[g][3]).trim()]=String(gerbangData[g][6]||'Hadir').trim()||'Hadir';
  for(var j=1;j<absensiData.length;j++) if(String(absensiData[j][0]).trim()===targetDate&&String(absensiData[j][1])===String(namaKelas)) absensiMap[String(absensiData[j][2]).trim()]={jam1:String(absensiData[j][4]||'').trim(),jam2:String(absensiData[j][5]||'').trim(),jam3:String(absensiData[j][6]||'').trim(),jam4:String(absensiData[j][7]||'').trim()};
  var result=[],toSave=[];
  for(var i=1;i<siswaData.length;i++) if(String(siswaData[i][2])===String(namaKelas)) {
    var nisn=String(siswaData[i][0]).trim(),gateStatus=gateMap[nisn]||'Alpha',att=absensiMap[nisn]||{};
    // Status per jam yang sudah tersimpan (khususnya Bolos) selalu menang. Kolom kosong mengikuti gateway/Alpha.
    ['jam1','jam2','jam3','jam4'].forEach(function(k){if(!att[k])att[k]=gateStatus;});
    var item={nisn:nisn,nama:siswaData[i][1],jam1:att.jam1,jam2:att.jam2,jam3:att.jam3,jam4:att.jam4};
    result.push(item); toSave.push({tanggal:targetDate,kelas:namaKelas,nisn:nisn,nama:item.nama,jam1:item.jam1,jam2:item.jam2,jam3:item.jam3,jam4:item.jam4});
  }
  // Simpan default Alpha dan hasil sinkronisasi agar rekap/dashboard selalu sesuai data terbaru.
  if(toSave.length) simpanAbsensi(toSave,targetDate);
  return result;
}
function simpanAbsensi(absensiList, tanggalParam) {
  var sheet = getSheetSafe('Absensi');
  var data = sheet.getDataRange().getDisplayValues();
  var defaultDate = tanggalParam || getTodayDateString();

  var existingRowIndexMap = {};
  for (var i = 1; i < data.length; i++) {
    var rowDate = String(data[i][0]).trim();
    var key = rowDate + '*' + String(data[i][1]) + '*' + String(data[i][2]);
    existingRowIndexMap[key] = i + 1;
  }

  absensiList.forEach(function(item) {
    var itemDate = item.tanggal || defaultDate;
    var key = String(itemDate) + '*' + String(item.kelas) + '*' + String(item.nisn);
    if (existingRowIndexMap[key]) {
      var rowIndex = existingRowIndexMap[key];
      sheet.getRange(rowIndex, 1, 1, 8).setValues([[
        itemDate, item.kelas, item.nisn, item.nama, item.jam1, item.jam2, item.jam3, item.jam4
      ]]);
    } else {
      sheet.appendRow([itemDate, item.kelas, item.nisn, item.nama, item.jam1, item.jam2, item.jam3, item.jam4]);
      existingRowIndexMap[key] = sheet.getLastRow();
    }
  });
  return 'Data Absensi berhasil diperbarui & disimpan!';
}

function getRekapAbsensiHarian(tanggalParam, kelasParam) {
  var data = getSheetSafe('Absensi').getDataRange().getDisplayValues();
  var filterDate = tanggalParam || getTodayDateString();

  var result = [];
  var totalJam = 0, totalHadir = 0, totalBolos = 0;

  for (var i = 1; i < data.length; i++) {
    var rowDate = String(data[i][0]).trim();
    if (rowDate === filterDate && (!kelasParam || String(data[i][1]) === String(kelasParam))) {
      var j1 = data[i][4], j2 = data[i][5], j3 = data[i][6], j4 = data[i][7];
      [j1, j2, j3, j4].forEach(function(val) {
        if (val) {
          totalJam++;
          if (String(val) === 'Hadir') totalHadir++;
          else totalBolos++;
        }
      });

      result.push({
        tanggal: rowDate,
        kelas: data[i][1],
        nisn: data[i][2],
        nama: data[i][3],
        jam1: j1,
        jam2: j2,
        jam3: j3,
        jam4: j4
      });
    }
  }

  var pctHadir = totalJam > 0 ? Math.round((totalHadir / totalJam) * 100) : 0;
  var pctBolos = totalJam > 0 ? Math.round((totalBolos / totalJam) * 100) : 0;

  return {
    detail: result,
    totalJam: totalJam,
    totalHadir: totalHadir,
    totalBolos: totalBolos,
    pctHadir: pctHadir,
    pctBolos: pctBolos
  };
}

function getRekapAbsensiBulanan(bulanTahun, kelasParam) {
  var data = getSheetSafe('Absensi').getDataRange().getDisplayValues();

  var totalJamKeseluruhan = 0;
  var totalHadirKeseluruhan = 0;
  var totalBolosKeseluruhan = 0;
  var summarySiswaMap = {};

  for (var i = 1; i < data.length; i++) {
    var rowDate = String(data[i][0]).trim();
    if (rowDate.substring(0, 7) === bulanTahun) {
      var rowKelas = String(data[i][1]);
      if (!kelasParam || rowKelas === String(kelasParam)) {
        var nisn = String(data[i][2]);
        var nama = String(data[i][3]);

        if (!summarySiswaMap[nisn]) {
          summarySiswaMap[nisn] = { nisn: nisn, nama: nama, kelas: rowKelas, hadir: 0, bolos: 0, totalJam: 0 };
        }

        [data[i][4], data[i][5], data[i][6], data[i][7]].forEach(function(status) {
          if (status) {
            totalJamKeseluruhan++;
            summarySiswaMap[nisn].totalJam++;
            if (String(status) === 'Hadir') {
              totalHadirKeseluruhan++;
              summarySiswaMap[nisn].hadir++;
            } else {
              totalBolosKeseluruhan++;
              summarySiswaMap[nisn].bolos++;
            }
          }
        });
      }
    }
  }

  var pctHadir = totalJamKeseluruhan > 0 ? Math.round((totalHadirKeseluruhan / totalJamKeseluruhan) * 100) : 0;
  var pctBolos = totalJamKeseluruhan > 0 ? Math.round((totalBolos / totalJamKeseluruhan) * 100) : 0;

  var siswaBolosSummary = [];
  for (var key in summarySiswaMap) {
    if (summarySiswaMap[key].bolos > 0) {
      siswaBolosSummary.push(summarySiswaMap[key]);
    }
  }

  return {
    totalJam: totalJamKeseluruhan,
    totalHadir: totalHadirKeseluruhan,
    totalBolos: totalBolosKeseluruhan,
    pctHadir: pctHadir,
    pctBolos: pctBolos,
    siswaBolosSummary: siswaBolosSummary
  };
}

// ==========================================
// KESISWAAN & PELANGGARAN
// ==========================================
function getKesiswaanData() {
  var pelanggaran = getSheetSafe('Pelanggaran').getDataRange().getDisplayValues().slice(1);
  return { pelanggaran: pelanggaran };
}

function simpanPelanggaran(data) {
  var sheet = getSheetSafe('Pelanggaran');
  sheet.appendRow([getTodayDateString(), data.nisn, data.nama, data.pelanggaran, data.poin]);
  return 'Poin pelanggaran berhasil dicatat!';
}

// ==========================================
// INVENTARIS SARPRAS
// ==========================================
function getSarprasData() {
  return getSheetSafe('Sarpras').getDataRange().getDisplayValues().slice(1);
}

function simpanSarpras(data) {
  var sheet = getSheetSafe('Sarpras');
  var id = 'BRG-' + Math.floor(1000 + Math.random() * 9000);
  var kategori = data.kategori || 'Umum';
  sheet.appendRow([id, data.nama, kategori, data.jumlah, data.baik, data.rusakRingan, data.rusakBerat, data.keterangan || '-']);
  return 'Fasilitas SarPras berhasil ditambahkan!';
}

function hapusSarpras(id) {
  var sheet = getSheetSafe('Sarpras');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return 'Barang Sarpras berhasil dihapus!';
    }
  }
  return 'Data Sarpras tidak ditemukan!';
}

// ==========================================
// PENGATURAN PENGGUNA & RBAC
// ==========================================
function getPenggunaData() {
  ensureKolomDetailAkses_();
  var data = getSheetSafe('Pengguna').getDataRange().getDisplayValues();
  if (data.length <= 1) return [];

  var result = [];
  for (var i = 1; i < data.length; i++) {
    var role = data[i][3];
    var akses = data[i][5] ? String(data[i][5]).trim() : getDefaultAksesByRole(role);
    var detail = {};
    try { detail = data[i][6] ? JSON.parse(data[i][6]) : getDefaultDetailAksesByRole_(role); } catch (e) { detail = getDefaultDetailAksesByRole_(role); }
    result.push([data[i][0], data[i][1], data[i][2], role, data[i][4], akses, JSON.stringify(detail)]);
  }
  return result;
}

function simpanPengguna(data) {
  ensureKolomDetailAkses_();
  var sheet = getSheetSafe('Pengguna');
  var rows = sheet.getDataRange().getDisplayValues();
  var targetId = data.oldId || data.id;
  var foundIndex = -1;

  var userAkses = data.akses ? String(data.akses).trim() : getDefaultAksesByRole(data.role);
  var detailObj = data.aksesDetail && typeof data.aksesDetail === 'object' ? data.aksesDetail : getDefaultDetailAksesByRole_(data.role);
  var detailJson = JSON.stringify(detailObj);

  if (targetId) {
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(targetId)) {
        foundIndex = i + 1;
        break;
      }
    }
  }

  if (foundIndex > -1) {
    sheet.getRange(foundIndex, 1, 1, 7).setValues([[data.id || targetId, data.username, data.password, data.role, data.nama, userAkses, detailJson]]);
    return 'Data Pengguna & Hak Akses berhasil diperbarui!';
  } else {
    var newId = data.id || ('USR-' + new Date().getTime().toString().substr(-5));
    sheet.appendRow([newId, data.username, data.password, data.role, data.nama, userAkses, detailJson]);
    return 'Pengguna baru berhasil ditambahkan!';
  }
}

function hapusPengguna(id) {
  var sheet = getSheetSafe('Pengguna');
  var data = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return 'Pengguna berhasil dihapus!';
    }
  }
  return 'Data pengguna tidak ditemukan!';
}


// ==========================================
// HARI EFEKTIF / KALENDER AKADEMIK
// Jadwal dan hari libur dapat dikelola admin melalui menu Hari Efektif.
function ensureKalenderAkademikSheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName('Kalender Akademik');
  if(!sh) { sh=ss.insertSheet('Kalender Akademik'); sh.appendRow(['Tanggal','Jenis','Keterangan']); }
  if(sh.getLastRow()===0) sh.appendRow(['Tanggal','Jenis','Keterangan']);
  // Format kolom tanggal hanya pada baris yang digunakan; jangan memproses seluruh 1 juta baris.
  sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).setNumberFormat('@');
  return sh;
}
function assertAdminHariEfektif_(token) {
  var user=getSessionUser(token);
  if(!user || !user.success || String(user.role||'').toLowerCase()!=='administrator') {
    throw new Error('Menu Hari Efektif hanya dapat dikelola oleh Administrator. Silakan masuk kembali sebagai admin.');
  }
}
function getHariEfektifConfigData_(tahun) {
  var p=PropertiesService.getScriptProperties(), sh=ensureKalenderAkademikSheet_();
  var y=parseInt(tahun,10)||parseInt(Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy'),10);
  var raw=sh.getDataRange().getDisplayValues(), events=[];
  for(var i=1;i<raw.length;i++) {
    var date=String(raw[i][0]||'').trim();
    if(date && date.substring(0,4)===String(y)) events.push({tanggal:date,jenis:String(raw[i][1]||'Libur Madrasah'),keterangan:String(raw[i][2]||''),row:i+1});
  }
  events.sort(function(a,b){return a.tanggal.localeCompare(b.tanggal);});
  var days;
  try { days=JSON.parse(p.getProperty('MASDA_HARI_EFEKTIF_HARI')||'[1,2,3,4,5,6]'); } catch(e) { days=[1,2,3,4,5,6]; }
  return {tahun:y,jamMasuk:p.getProperty('MASDA_JAM_MASUK')||'07:00',jamPulang:p.getProperty('MASDA_JAM_PULANG')||'13:00',hariEfektif:days,events:events};
}
function getHariEfektifConfig(tahun, token) {
  assertAdminHariEfektif_(token);
  return getHariEfektifConfigData_(tahun);
}

function saveHariEfektifSettings(cfg, token) {
  assertAdminHariEfektif_(token); cfg=cfg||{}; var p=PropertiesService.getScriptProperties();
  var masuk=String(cfg.jamMasuk||'07:00'), pulang=String(cfg.jamPulang||'13:00');
  if(!/^\d{2}:\d{2}$/.test(masuk)||!/^\d{2}:\d{2}$/.test(pulang)) throw new Error('Format jam harus HH:MM.');
  if(masuk>=pulang) throw new Error('Jam masuk harus lebih awal daripada jam pulang.');
  var days=(cfg.hariEfektif||[]).map(Number).filter(function(n){return n>=1&&n<=7;});
  if(!days.length) throw new Error('Pilih minimal satu hari efektif sekolah.');
  p.setProperty('MASDA_JAM_MASUK',masuk); p.setProperty('MASDA_JAM_PULANG',pulang);
  p.setProperty('MASDA_HARI_EFEKTIF_HARI',JSON.stringify(days));
  return {success:true,message:'Pengaturan hari dan jam sekolah berhasil disimpan.'};
}
function saveKalenderAkademikEvent(event, token) {
  assertAdminHariEfektif_(token); event=event||{}; var date=String(event.tanggal||'').trim(), type=String(event.jenis||'').trim(), desc=String(event.keterangan||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal kalender tidak valid.');
  if(['Hari Efektif','Libur Nasional','Cuti Bersama','Libur Madrasah','Kegiatan Khusus'].indexOf(type)<0) throw new Error('Jenis kalender tidak valid.');
  if(!desc) throw new Error('Keterangan/tanggal merah harus diisi.');
  var sh=ensureKalenderAkademikSheet_(), d=sh.getDataRange().getDisplayValues(), row=0;
  for(var i=1;i<d.length;i++) if(String(d[i][0]).trim()===date){row=i+1;break;}
  if(row) sh.getRange(row,1,1,3).setValues([[date,type,desc]]);
  else sh.appendRow([date,type,desc]);
  return {success:true,message:'Tanggal kalender berhasil disimpan.'};
}
function deleteKalenderAkademikEvent(date, token) {
  assertAdminHariEfektif_(token); date=String(date||'').trim(); var sh=ensureKalenderAkademikSheet_(), d=sh.getDataRange().getDisplayValues();
  for(var i=1;i<d.length;i++) if(String(d[i][0]).trim()===date){sh.deleteRow(i+1);return {success:true,message:'Tanggal kalender berhasil dihapus.'};}
  return {success:false,message:'Tanggal kalender tidak ditemukan.'};
}
function getHariEfektifForDate_(dateStr) {
  var cfg=getHariEfektifConfigData_(String(dateStr).substring(0,4)), explicit=null;
  cfg.events.forEach(function(e){if(e.tanggal===dateStr) explicit=e;});
  if(explicit) return {effective:['Hari Efektif','Kegiatan Khusus'].indexOf(explicit.jenis)>=0, event:explicit, config:cfg};
  var dt=new Date(dateStr+'T12:00:00'), day=dt.getDay(), dayNum=day===0?7:day;
  return {effective:cfg.hariEfektif.indexOf(dayNum)>=0,event:null,config:cfg};
}
function isAfterSchoolTime_(timeStr, configuredTime) { return String(timeStr).substring(0,5)>String(configuredTime||'07:00'); }
function isBeforeSchoolTime_(timeStr, configuredTime) { return String(timeStr).substring(0,5)<String(configuredTime||'13:00'); }

// ==========================================
// WHATSAPP GATEWAY & ABSENSI GERBANG SISWA
// Integrasi WhatsApp menggunakan API provider resmi/terdaftar (contoh Fonnte).
// Token disimpan di Script Properties, bukan di HTML atau Google Sheet.
function getWhatsAppGatewayConfig() {
  var p = PropertiesService.getScriptProperties();
  return { provider: p.getProperty('MASDA_WA_PROVIDER') || 'Fonnte', deviceLabel: p.getProperty('MASDA_WA_DEVICE_LABEL') || '',
    configured: !!p.getProperty('MASDA_WA_TOKEN'), tokenMasked: p.getProperty('MASDA_WA_TOKEN') ? '••••••••' + p.getProperty('MASDA_WA_TOKEN').slice(-4) : '',
    sendMasuk: p.getProperty('MASDA_WA_MASUK') !== 'false', sendPulang: p.getProperty('MASDA_WA_PULANG') !== 'false' };
}
function saveWhatsAppGatewayConfig(cfg) {
  var p = PropertiesService.getScriptProperties();
  if (cfg.provider) p.setProperty('MASDA_WA_PROVIDER', String(cfg.provider));
  if (cfg.deviceLabel !== undefined) p.setProperty('MASDA_WA_DEVICE_LABEL', String(cfg.deviceLabel).trim());
  if (cfg.token && String(cfg.token).trim()) p.setProperty('MASDA_WA_TOKEN', String(cfg.token).trim());
  p.setProperty('MASDA_WA_MASUK', cfg.sendMasuk === false ? 'false' : 'true');
  p.setProperty('MASDA_WA_PULANG', cfg.sendPulang === false ? 'false' : 'true');
  return { success:true, message:'Pengaturan WhatsApp Gateway tersimpan.', config:getWhatsAppGatewayConfig() };
}
// Meminta QR penautan perangkat melalui API resmi provider Fonnte.
// Token harus berupa token perangkat Fonnte yang sudah dibuat dari dashboard.
function getWhatsAppGatewayQr() {
  var token = PropertiesService.getScriptProperties().getProperty('MASDA_WA_TOKEN');
  if (!token) return {success:false, message:'Token API Fonnte belum tersimpan. Buka dashboard Fonnte, buat perangkat, lalu simpan token pada tab Template Pesan & Uji Coba.'};
  try {
    var response = UrlFetchApp.fetch('https://api.fonnte.com/qr', {
      method:'post', headers:{Authorization:token}, payload:{type:'qr'}, muteHttpExceptions:true
    });
    var httpCode = response.getResponseCode(), body = response.getContentText(), data = {};
    try { data = JSON.parse(body); } catch (e) { return {success:false, message:'Respons API Fonnte tidak dapat dibaca (HTTP '+httpCode+').'}; }
    if (httpCode >= 200 && httpCode < 300 && data.status === true && data.url) {
      var qrValue = String(data.url || '').trim();
      // API Fonnte mengembalikan base64 mentah; beberapa respons dapat sudah berisi data URI.
      if (/^data:image\//i.test(qrValue)) return {success:true, qr:qrValue, qrIsDataUri:true, message:'QR berhasil dibuat.'};
      if (/^https?:\/\//i.test(qrValue)) return {success:true, qr:qrValue, qrIsUrl:true, message:'QR berhasil dibuat.'};
      return {success:true, qr:qrValue.replace(/\s/g,''), message:'QR berhasil dibuat.'};
    }
    var reason = data.reason || data.message || 'API Fonnte tidak memberikan QR.';
    if (String(reason).toLowerCase().indexOf('already connect') >= 0 || String(reason).toLowerCase().indexOf('already connected') >= 0) {
      return {success:false, connected:true, message:'Perangkat WhatsApp sudah terhubung. QR tidak diperlukan; coba uji pengiriman pada tab Template Pesan & Uji Coba.'};
    }
    if (String(reason).toLowerCase().indexOf('token invalid') >= 0) reason = 'Token API tidak valid. Periksa dan simpan kembali token perangkat Fonnte.';
    return {success:false, message:'Fonnte: '+reason+' (HTTP '+httpCode+').'};
  } catch (err) { return {success:false, message:'Gagal menghubungi API Fonnte: '+String(err)}; }
}

function sendWhatsAppGateway_(phone, message) {
  var token = PropertiesService.getScriptProperties().getProperty('MASDA_WA_TOKEN');
  if (!token) return { success:false, skipped:true, message:'Token WhatsApp Gateway belum dikonfigurasi.' };
  if (!phone) return { success:false, skipped:true, message:'Nomor HP wali siswa belum diisi.' };
  var provider = PropertiesService.getScriptProperties().getProperty('MASDA_WA_PROVIDER') || 'Fonnte';
  if (provider !== 'Fonnte') return { success:false, message:'Provider belum didukung oleh konektor ini.' };
  try {
    var response = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method:'post', headers:{Authorization:token}, payload:{target:phone, message:message}, muteHttpExceptions:true
    });
    var code = response.getResponseCode(), body = response.getContentText(), parsed = null;
    try { parsed = JSON.parse(body); } catch (parseErr) {}
    var httpOk = code >= 200 && code < 300;
    var apiOk = parsed && parsed.status !== undefined ? parsed.status === true : httpOk;
    return {success:httpOk && apiOk, httpCode:code, message:body};
  } catch(err) { return {success:false, message:String(err)}; }
}
function getWhatsAppTemplates() {
  var p=PropertiesService.getScriptProperties();
  return {masuk:p.getProperty('MASDA_WA_TEMPLATE_MASUK')||'',pulang:p.getProperty('MASDA_WA_TEMPLATE_PULANG')||''};
}
function saveWhatsAppTemplates(templates) {
  var p=PropertiesService.getScriptProperties(); templates=templates||{};
  if (templates.masuk !== undefined) p.setProperty('MASDA_WA_TEMPLATE_MASUK',String(templates.masuk));
  if (templates.pulang !== undefined) p.setProperty('MASDA_WA_TEMPLATE_PULANG',String(templates.pulang));
  return {success:true,message:'Template WhatsApp berhasil disimpan.'};
}
function ensureWhatsAppHistorySheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), sh=ss.getSheetByName('Log WhatsApp');
  if(!sh){sh=ss.insertSheet('Log WhatsApp');sh.appendRow(['Waktu','Nama Siswa','Jenis','Nomor Tujuan','Status Pengiriman','Pesan']);}
  return sh;
}
function logWhatsAppDelivery_(nama,jenis,phone,result,message) {
  try { var sh=ensureWhatsAppHistorySheet_(); sh.appendRow([Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm:ss'),nama||'',String(jenis||'').toUpperCase(),phone||'',result&&result.success?'Berhasil':'Gagal',String(message||((result&&result.message)||'')).substring(0,500)]); } catch(e) { console.error(e); }
}
function getWhatsAppDeliveryHistory() {
  var sh=ensureWhatsAppHistorySheet_(), d=sh.getDataRange().getDisplayValues();
  return d.length>1?d.slice(1).reverse().slice(0,500):[];
}
function renderWhatsAppTemplate_(template,siswa,jenis,waktu,statusOverride) {
  var date=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'dd/MM/yyyy');
  var time=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'HH:mm:ss');
  var defaults=getWhatsAppTemplates();
  if(!template) template=(jenis==='masuk'?defaults.masuk:defaults.pulang);
  if(!template) template=jenis==='masuk'
    ? 'Assalamu’alaikum Wr. Wb.\nYth. Bapak/Ibu Wali dari *{nama}* (NISN: {nisn} / Kelas: {kelas}).\n\nPutra/putri Bapak/Ibu telah melakukan *ABSEN MASUK* di *{sekolah}* pada {tanggal} pukul {jam} WIB.\nStatus: {status}\n— Si MasDA'
    : 'Assalamu’alaikum Wr. Wb.\nYth. Bapak/Ibu Wali dari *{nama}* (NISN: {nisn} / Kelas: {kelas}).\n\nPutra/putri Bapak/Ibu telah melakukan *ABSEN PULANG* dari *{sekolah}* pada {tanggal} pukul {jam} WIB.\nStatus: {status}\n— Si MasDA';
  var statusMasuk = String(siswa.status || '').trim();
  var statusPesan = statusOverride ? String(statusOverride) : (jenis === 'masuk' ? ((statusMasuk === 'Izin' || statusMasuk === 'Sakit') ? statusMasuk : 'Hadir - Masuk') : 'Hadir - Pulang');
  var values={nama:siswa.nama||'',nisn:siswa.nisn||'',kelas:siswa.kelas||'',tanggal:date,jam:waktu||time,status:statusPesan,sekolah:'MAS Darul Amin'};
  return String(template).replace(/\{(nama|nisn|kelas|tanggal|jam|status|sekolah)\}/g,function(_,key){return values[key]||'';});
}
function testWhatsAppTemplate(nisn,phone,jenis) {
  var siswa=getSiswaCardData(nisn); if(!siswa) return {success:false,message:'Siswa tidak ditemukan.'};
  phone=normalisasiNomorHpWali_(phone||siswa.noHpWali);
  var message=renderWhatsAppTemplate_('',siswa,jenis==='pulang'?'pulang':'masuk');
  var result=sendWhatsAppGateway_(phone,message);
  logWhatsAppDelivery_(siswa.nama,'Uji '+(jenis==='pulang'?'Pulang':'Masuk'),phone,result,message);
  return {success:result.success,message:result.success?'Pesan uji berhasil dikirim.':(result.message||'Pengiriman gagal. Periksa token dan perangkat provider.')};
}
function testWhatsAppGateway(phone) {
  var result = sendWhatsAppGateway_(normalisasiNomorHpWali_(phone), 'Tes WhatsApp Si MasDA. Koneksi notifikasi wali siswa sedang diuji.');
  return result;
}
function loginSiswaDenganNisn(nisn) {
  ensureKolomSiswa_();
  nisn = normalisasiIdentitas_(nisn);
  var sh = getSheetSafe('Siswa'), data = sh.getDataRange().getDisplayValues(), hm = getSiswaHeaderMap_();
  for (var i=1;i<data.length;i++) {
    if (String(data[i][hm['NISN']] || '') === nisn) {
      var akses = String(data[i][hm['Akses Menu']] || getDefaultAksesByRole('Siswa'));
      var aksesDetail = {};
      try { aksesDetail = JSON.parse(String(data[i][hm['Akses Detail']] || '{}')); } catch(e) {}
      if (!aksesDetail || typeof aksesDetail !== 'object') aksesDetail = getDefaultDetailAksesByRole_('Siswa');
      // Kompatibilitas data lama: pastikan menu dasar absensi tetap tersedia jika belum dikonfigurasi.
      if (!String(data[i][hm['Akses Menu']] || '').trim()) akses = getDefaultAksesByRole('Siswa');
      var user = {success:true, role:'Siswa', nama:data[i][hm['Nama']], username:nisn, akses:akses,
        aksesDetail:aksesDetail, studentNisn:nisn};
      var token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
      CacheService.getScriptCache().put('MASDA_SESSION_'+token, JSON.stringify(user), 21600);
      user.sessionToken = token; return user;
    }
  }
  return {success:false, message:'NISN tidak ditemukan di Master Siswa.'};
}

// Siswa yang login dengan NISN dapat mengajukan Izin/Sakit untuk hari ini.
// Token sesi diverifikasi agar permintaan tidak dapat dibuat hanya dengan menebak NISN.
function ajukanIzinSakitSiswa(sessionToken, status, alasan) {
  status = String(status || '').trim(); alasan = String(alasan || '').trim();
  if (['Izin','Sakit'].indexOf(status) < 0) return {success:false,message:'Status harus Izin atau Sakit.'};
  var token = String(sessionToken || '').trim();
  var cached = token ? CacheService.getScriptCache().get('MASDA_SESSION_'+token) : null;
  if (!cached) return {success:false,message:'Sesi siswa berakhir. Silakan login kembali menggunakan NISN.'};
  var user; try { user = JSON.parse(cached); } catch(e) { return {success:false,message:'Sesi siswa tidak valid.'}; }
  if (String(user.role).toLowerCase() !== 'siswa' || !user.studentNisn) return {success:false,message:'Fitur ini hanya untuk akun siswa.'};
  var siswa = getSiswaCardData(user.studentNisn);
  if (!siswa) return {success:false,message:'Data siswa tidak ditemukan.'};
  ensureAbsensiGerbangSheet_();
  var today = getTodayDateString(), sh = getSheetSafe('Absensi Gerbang'), rows = sh.getDataRange().getDisplayValues(), idx=-1;
  for (var i=1;i<rows.length;i++) if (String(rows[i][0])===today && String(rows[i][3])===String(siswa.nisn)) { idx=i+1; break; }
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
  if (idx > -1) {
    sh.getRange(idx,7).setValue(status);
    if (!String(rows[idx-1][1] || '').trim()) sh.getRange(idx,2).setValue(now);
  } else {
    sh.appendRow([today,now,'',siswa.nisn,siswa.nama,siswa.kelas,status]);
  }
  // Simpan status Izin/Sakit ke semua jam, agar status siswa dan dashboard analytics konsisten.
  sinkronkanStatusAbsensiDariGerbang_(today, siswa, status, true);
  var note = alasan ? ' Alasan: '+alasan : '';
  return {success:true,message:'Pengajuan '+status+' berhasil disimpan untuk hari ini.'+note,status:status,siswa:siswa,tanggal:today};
}

function getSiswaCardData(nisn) {
  ensureKolomSiswa_(); var sh=getSheetSafe('Siswa'), d=sh.getDataRange().getDisplayValues(), hm=getSiswaHeaderMap_();
  for(var i=1;i<d.length;i++) if(String(d[i][hm['NISN']])===String(nisn)) return {nisn:d[i][hm['NISN']],nama:d[i][hm['Nama']],kelas:d[i][hm['Kelas']],jk:d[i][hm['Jenis Kelamin']],noHpWali:d[i][hm['No HP Wali']]||'',idCard:d[i][hm['ID Card']]||('MASDA-'+d[i][hm['NISN']])};
  return null;
}
function assertAdminAbsensiGerbang_(token) {
  var user=getSessionUser(String(token||''));
  if(!user || !user.success || String(user.role||'').toLowerCase()!=='administrator') {
    throw new Error('Pencatatan Izin/Sakit manual hanya dapat dilakukan oleh Administrator. Silakan masuk kembali sebagai admin.');
  }
  return user;
}
function getSiswaBelumAbsenGerbang(kelasParam, token) {
  assertAdminAbsensiGerbang_(token); ensureKolomSiswa_(); ensureAbsensiGerbangSheet_();
  var sh=getSheetSafe('Siswa'), data=sh.getDataRange().getDisplayValues(), hm=getSiswaHeaderMap_();
  var gate=getSheetSafe('Absensi Gerbang').getDataRange().getDisplayValues(), today=getTodayDateString(), map={}, classes={};
  for(var i=1;i<gate.length;i++) if(String(gate[i][0])===today) map[String(gate[i][3]).trim()]={masuk:String(gate[i][1]||'').trim(),status:String(gate[i][6]||'').trim()};
  var selectedClass=String(kelasParam||'').trim(), students=[];
  for(var j=1;j<data.length;j++){
    var nisn=String(data[j][hm['NISN']]||'').trim(), nama=String(data[j][hm['Nama']]||'').trim(), kelas=String(data[j][hm['Kelas']]||'').trim();
    if(!nisn||!nama||!kelas)continue; classes[kelas]=true;
    if(selectedClass && kelas!==selectedClass)continue;
    var rec=map[nisn];
    if(rec && (rec.masuk || ['Izin','Sakit'].indexOf(rec.status)>=0))continue;
    students.push({nisn:nisn,nama:nama,kelas:kelas});
  }
  students.sort(function(a,b){return a.nama.localeCompare(b.nama,'id');});
  return {kelasList:Object.keys(classes).sort(function(a,b){return a.localeCompare(b,'id');}),siswa:students};
}
function catatIzinSakitGerbang(nisn, status, token) {
  assertAdminAbsensiGerbang_(token); ensureKolomSiswa_(); ensureAbsensiGerbangSheet_(); ensureKalenderAkademikSheet_();
  nisn=normalisasiIdentitas_(nisn); status=String(status||'').trim();
  if(['Izin','Sakit'].indexOf(status)<0)throw new Error('Status harus Izin atau Sakit.');
  var siswa=getSiswaCardData(nisn); if(!siswa)throw new Error('Data siswa tidak ditemukan.');
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var today=getTodayDateString(), hari=getHariEfektifForDate_(today);
    if(!hari.effective)throw new Error('Hari ini bukan hari efektif sekolah. Status Izin/Sakit tidak dicatat.');
    var sh=getSheetSafe('Absensi Gerbang'), rows=sh.getDataRange().getDisplayValues(), idx=-1;
    for(var i=1;i<rows.length;i++)if(String(rows[i][0])===today&&String(rows[i][3]).trim()===nisn){idx=i+1;break;}
    if(idx>-1 && String(rows[idx-1][1]||'').trim())throw new Error('Siswa sudah melakukan absen masuk pukul '+rows[idx-1][1]+'. Status Izin/Sakit tidak dapat menggantikan absensi masuk.');
    if(idx>-1 && ['Izin','Sakit'].indexOf(String(rows[idx-1][6]||'').trim())>=0)throw new Error('Status siswa hari ini sudah tercatat sebagai '+rows[idx-1][6]+'.');
    if(idx>-1)sh.getRange(idx,7).setValue(status);
    else {sh.appendRow([today,'','',nisn,siswa.nama,siswa.kelas,status]);idx=sh.getLastRow();}
    sinkronkanStatusAbsensiDariGerbang_(today,siswa,status,true);
    var p=PropertiesService.getScriptProperties(), enabled=p.getProperty('MASDA_WA_MASUK')!=='false';
    var wa={success:false,skipped:true,message:'Notifikasi tidak dikirim: pengiriman masuk dinonaktifkan atau nomor wali belum tersedia.'};
    if(enabled && siswa.noHpWali){
      var msg=renderWhatsAppTemplate_('',siswa,'masuk',Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'HH:mm:ss'),status);
      wa=sendWhatsAppGateway_(siswa.noHpWali,msg); logWhatsAppDelivery_(siswa.nama,'masuk - '+status,siswa.noHpWali,wa,msg);
    }
    return {success:true,message:'Status '+status+' berhasil dicatat untuk '+siswa.nama+'.',siswa:siswa,status:status,whatsapp:wa};
  } finally {lock.releaseLock();}
}

function catatAbsensiGerbang(nisn, jenis, statusMasuk) {
  ensureKolomSiswa_(); ensureAbsensiGerbangSheet_(); ensureKalenderAkademikSheet_();
  nisn=normalisasiIdentitas_(nisn); jenis=String(jenis||'masuk').toLowerCase(); statusMasuk=String(statusMasuk||'Hadir').trim();
  if(['Hadir','Izin','Sakit'].indexOf(statusMasuk)<0) statusMasuk='Hadir';
  if(['masuk','pulang'].indexOf(jenis)<0) throw new Error('Jenis absensi tidak valid.');
  var siswa=getSiswaCardData(nisn); if(!siswa) throw new Error('QR/NISN tidak terdaftar.');
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh=getSheetSafe('Absensi Gerbang'), rows=sh.getDataRange().getDisplayValues(), today=getTodayDateString();
    var hari=getHariEfektifForDate_(today);
    if(!hari.effective) throw new Error('Hari ini bukan hari efektif sekolah'+(hari.event?' ('+hari.event.keterangan+')':'')+'. Absensi gerbang tidak dicatat.');
    var idx=-1;
    for(var i=1;i<rows.length;i++) if(String(rows[i][0])===today && String(rows[i][3])===nisn){idx=i+1;break;}
    var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'HH:mm:ss'), status='', statusPesan='', statusSinkron='Hadir';
    if(jenis==='masuk') {
      if(idx>-1 && rows[idx-1][1]) {
        var prevStatus=String(rows[idx-1][6]||'Hadir');
        sinkronkanStatusAbsensiDariGerbang_(today,siswa,prevStatus==='Izin'||prevStatus==='Sakit'?prevStatus:'Hadir',false);
        return {success:false,message:'Absensi masuk hari ini sudah tercatat pukul '+rows[idx-1][1]+'. Data absensi pelajaran juga telah diperiksa.',siswa:siswa,alreadyRecorded:true};
      }
      if(statusMasuk==='Izin'||statusMasuk==='Sakit') {
        statusPesan=statusMasuk; statusSinkron=statusMasuk;
      } else if(isAfterSchoolTime_(now,hari.config.jamMasuk)) {
        statusPesan='Terlambat'; statusMasuk='Terlambat'; statusSinkron='Hadir';
      } else {statusPesan='Masuk tepat waktu'; statusMasuk='Hadir'; statusSinkron='Hadir';}
      if(idx>-1) { sh.getRange(idx,2).setValue(now); sh.getRange(idx,7).setValue(statusMasuk); }
      else {sh.appendRow([today,now,'',nisn,siswa.nama,siswa.kelas,statusMasuk]);idx=sh.getLastRow();}
      sinkronkanStatusAbsensiDariGerbang_(today,siswa,statusSinkron,true);
      status='masuk';
    } else {
      if(idx<0 || !rows[idx-1][1]) throw new Error('Absensi masuk belum tercatat hari ini.');
      if(rows[idx-1][2]) return {success:false,message:'Absensi pulang hari ini sudah tercatat pukul '+rows[idx-1][2]+'.',siswa:siswa};
      var early=isBeforeSchoolTime_(now,hari.config.jamPulang);
      statusPesan=early?'Bolos':'Pulang tepat waktu';
      sh.getRange(idx,3).setValue(now);
      if(early) sh.getRange(idx,7).setValue('Bolos - Pulang Awal');
      status=early?'pulang lebih awal':'pulang';
    }
    var p=PropertiesService.getScriptProperties(), enabled=p.getProperty(jenis==='masuk'?'MASDA_WA_MASUK':'MASDA_WA_PULANG')!=='false';
    var wa={success:false,skipped:true};
    if(enabled && siswa.noHpWali) {
      var msg=renderWhatsAppTemplate_('',siswa,jenis,now,statusPesan);
      wa=sendWhatsAppGateway_(siswa.noHpWali,msg);
      logWhatsAppDelivery_(siswa.nama,jenis,siswa.noHpWali,wa,msg);
    }
    return {success:true,message:'Absensi '+status+' berhasil dicatat pukul '+now+'. Status: '+statusPesan+'.',siswa:siswa,waktu:now,status:statusPesan,whatsapp:wa};
  } finally { lock.releaseLock(); }
}
function sinkronkanStatusAbsensiDariGerbang_(tanggal, siswa, status, paksaSemuaJam) {
  // Check-in pertama menetapkan keempat jam sesuai status gerbang. Setelahnya,
  // pemulihan sinkronisasi hanya mengisi nilai kosong/Alpha agar status Bolos per jam tidak tertimpa.
  var statusValid = ['Hadir','Izin','Sakit'].indexOf(String(status)) >= 0 ? String(status) : 'Hadir';
  var sh=getSheetSafe('Absensi'), data=sh.getDataRange().getDisplayValues(), row=-1;
  for(var i=1;i<data.length;i++) if(String(data[i][0]).trim()===String(tanggal).trim() && String(data[i][1]).trim()===String(siswa.kelas).trim() && String(data[i][2]).trim()===String(siswa.nisn).trim()){row=i+1;break;}
  var vals=[tanggal,siswa.kelas,siswa.nisn,siswa.nama,statusValid,statusValid,statusValid,statusValid];
  if(row<0) {
    sh.appendRow(vals);
    return;
  }
  var current=sh.getRange(row,1,1,8).getDisplayValues()[0];
  current[0]=tanggal; current[1]=siswa.kelas; current[2]=siswa.nisn; current[3]=siswa.nama;
  for(var c=4;c<8;c++) {
    if(paksaSemuaJam === true || !String(current[c] || '').trim() || ['Alpha','Alfa'].indexOf(String(current[c]).trim()) >= 0) current[c]=statusValid;
  }
  sh.getRange(row,1,1,8).setValues([[current[0],current[1],current[2],current[3],current[4],current[5],current[6],current[7]]]);
}

function getAbsensiGerbangHariIni() {
  ensureAbsensiGerbangSheet_(); var d=getSheetSafe('Absensi Gerbang').getDataRange().getDisplayValues(), today=getTodayDateString(), out=[];
  for(var i=1;i<d.length;i++) if(String(d[i][0])===today) out.push(d[i]);
  return out;
}


// ==========================================
// PPDB - CRUD dan penyimpanan Google Sheets
// ==========================================
function ensurePPDBSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers = ['ID','No. Pendaftaran','Tanggal Pendaftaran','Jalur Pendaftaran','Nama Lengkap','Jenis Kelamin','NIK','NISN','Tempat Lahir','Tanggal Lahir','Agama','Asal Sekolah','Tahun Lulus','Pilihan Kelas/Jurusan','Alamat','Nama Ayah','Nama Ibu','Nama Wali','No. HP Orang Tua/Wali','Pekerjaan Orang Tua','Status','Catatan','Timestamp'];
  var sh = ss.getSheetByName('PPDB');
  if (!sh) sh = ss.insertSheet('PPDB');
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else {
    var existing = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0];
    headers.forEach(function(h){ if(existing.indexOf(h)===-1){sh.getRange(1,sh.getLastColumn()+1).setValue(h);existing.push(h);} });
  }
  [7,8,19].forEach(function(c){sh.getRange(2,c,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@');});
  return sh;
}
function getDataPPDB() {
  var sh=ensurePPDBSheet_(), vals=sh.getDataRange().getDisplayValues();
  if(vals.length<2)return [];
  var headers=vals[0];
  return vals.slice(1).filter(function(r){return r[0];}).map(function(r){
    var o={}; headers.forEach(function(h,i){o[h]=r[i]||'';}); return o;
  });
}
function simpanPPDB(data) {
  if(!data || !String(data.nama||'').trim()) throw new Error('Nama lengkap wajib diisi.');
  var sh=ensurePPDBSheet_(), vals=sh.getDataRange().getDisplayValues(), headers=vals[0];
  var id=String(data.id||'').trim(), row=-1;
  if(id) for(var i=1;i<vals.length;i++) if(String(vals[i][0])===id){row=i+1;break;}
  var no=String(data.noDaftar||'').trim();
  if(!no) no='PPDB-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy')+'-'+Utilities.formatString('%04d',Math.max(1,sh.getLastRow()));
  var obj={
    'ID':id||Utilities.getUuid(),'No. Pendaftaran':no,'Tanggal Pendaftaran':data.tanggal||'',
    'Jalur Pendaftaran':data.jalur||'Reguler','Nama Lengkap':String(data.nama||'').trim(),
    'Jenis Kelamin':data.gender||'','NIK':String(data.nik||''),'NISN':String(data.nisn||''),
    'Tempat Lahir':data.tempatLahir||'','Tanggal Lahir':data.tglLahir||'','Agama':data.agama||'Islam',
    'Asal Sekolah':data.asalSekolah||'','Tahun Lulus':data.tahunLulus||'','Pilihan Kelas/Jurusan':data.pilihan||'',
    'Alamat':data.alamat||'','Nama Ayah':data.ayah||'','Nama Ibu':data.ibu||'','Nama Wali':data.wali||'',
    'No. HP Orang Tua/Wali':String(data.hp||''),'Pekerjaan Orang Tua':data.pekerjaan||'',
    'Status':data.status||'Menunggu Verifikasi','Catatan':data.catatan||'','Timestamp':new Date()
  };
  var rowValues=headers.map(function(h){return obj[h]!==undefined?obj[h]:'';});
  if(row>0) sh.getRange(row,1,1,headers.length).setValues([rowValues]);
  else sh.appendRow(rowValues);
  return {success:true,message:'Data PPDB berhasil disimpan.',data:obj};
}
function hapusPPDB(id) {
  var sh=ensurePPDBSheet_(), vals=sh.getDataRange().getDisplayValues();
  for(var i=1;i<vals.length;i++) if(String(vals[i][0])===String(id)){sh.deleteRow(i+1);return {success:true,message:'Data PPDB berhasil dihapus.'};}
  return {success:false,message:'Data PPDB tidak ditemukan.'};
}

// Pendaftaran publik: siswa/calon siswa hanya dapat MENAMBAH data, tidak mengedit/menghapus.
function kirimPPDBPublik(data) {
  if (!data) throw new Error('Data pendaftaran tidak ditemukan.');
  data.id = '';
  data.status = 'Menunggu Verifikasi';
  if (!String(data.nama || '').trim()) throw new Error('Nama lengkap wajib diisi.');
  if (!String(data.tanggal || '').trim()) data.tanggal = getTodayDateString();
  return simpanPPDB(data);
}

// Pengumuman publik
function ensurePengumumanSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers = ['ID','Judul','Isi Pengumuman','URL Gambar','Status','Dibuat','Diperbarui'];
  var sh = ss.getSheetByName('Pengumuman');
  if (!sh) { sh = ss.insertSheet('Pengumuman'); sh.appendRow(headers); }
  else {
    var existing = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0];
    headers.forEach(function(h){if(existing.indexOf(h)===-1){sh.getRange(1,sh.getLastColumn()+1).setValue(h);existing.push(h);}});
  }
  return sh;
}
function getPengumuman(publik) {
  var sh=ensurePengumumanSheet_(), values=sh.getDataRange().getDisplayValues();
  if(values.length<2)return [];
  var headers=values[0];
  return values.slice(1).filter(function(r){return r[0] && (!publik || r[headers.indexOf('Status')]==='Publik');}).map(function(r){
    var o={}; headers.forEach(function(h,i){o[h]=r[i]||'';}); return o;
  }).reverse();
}
function simpanPengumuman(data) {
  if(!data || !String(data.judul||'').trim() || !String(data.isi||'').trim()) throw new Error('Judul dan isi pengumuman wajib diisi.');
  var sh=ensurePengumumanSheet_(), values=sh.getDataRange().getDisplayValues(), headers=values[0];
  var id=String(data.id||'').trim(), row=-1;
  for(var i=1;i<values.length;i++) if(String(values[i][0])===id && id){row=i+1;break;}
  var imageUrl=String(data.imageUrl||'');
  if(data.imageBase64) {
    var match=String(data.imageBase64).match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/i);
    if(!match) throw new Error('Format gambar tidak valid.');
    if(match[2].length > 5*1024*1024) throw new Error('Ukuran gambar terlalu besar (maksimal sekitar 3,5 MB).');
    var bytes=Utilities.base64Decode(match[2]);
    var blob=Utilities.newBlob(bytes,match[1],'pengumuman-'+Date.now()+'.'+(match[1].split('/')[1]||'png'));
    var file=DriveApp.createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    imageUrl='https://drive.google.com/uc?export=view&id='+file.getId();
  }
  var now=new Date(), obj={'ID':id||Utilities.getUuid(),'Judul':String(data.judul).trim(),'Isi Pengumuman':String(data.isi).trim(),'URL Gambar':imageUrl,'Status':data.status==='Draft'?'Draft':'Publik','Dibuat':now,'Diperbarui':now};
  if(row>0){obj.Dibuat=values[row-1][headers.indexOf('Dibuat')]||now;sh.getRange(row,1,1,headers.length).setValues([headers.map(function(h){return obj[h]!==undefined?obj[h]:'';})]);}
  else sh.appendRow(headers.map(function(h){return obj[h]!==undefined?obj[h]:'';}));
  return {success:true,message:'Pengumuman berhasil disimpan.'};
}
function hapusPengumuman(id) {
  var sh=ensurePengumumanSheet_(),v=sh.getDataRange().getDisplayValues();
  for(var i=1;i<v.length;i++)if(String(v[i][0])===String(id)){sh.deleteRow(i+1);return {success:true,message:'Pengumuman dihapus.'};}
  return {success:false,message:'Pengumuman tidak ditemukan.'};
}



// ==========================================
// KONFIGURASI MENU HALAMAN AWAL PUBLIK
// ==========================================
function getPublicHomeMenuConfig() {
  var raw = PropertiesService.getScriptProperties().getProperty('MASDA_PUBLIC_HOME_MENUS');
  var menus = [];
  if (raw) {
    try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) menus = parsed; } catch (e) {}
  }
  return {menus: menus};
}

function savePublicHomeMenuConfig(menus, sessionToken) {
  // Hanya pengguna dengan sesi Administrator yang boleh mengubah menu halaman awal.
  var user = null;
  try { if (typeof getSessionUser === 'function') user = getSessionUser(sessionToken); } catch (e) {}
  if (!user) {
    // Kompatibilitas dengan nama helper sesi pada versi aplikasi yang berbeda.
    try { if (typeof validateSession_ === 'function') user = validateSession_(sessionToken); } catch (e) {}
  }
  var role = user && (user.role || user.Role || user['Role'] || user.jabatan);
  if (String(role || '').toLowerCase() !== 'administrator') {
    throw new Error('Hanya Administrator yang dapat mengubah tampilan halaman awal. Silakan login sebagai Administrator.');
  }
  var allowed = ['ppdb','pengumuman','absensiQr','profil','struktur','dashboard','master','hariEfektif','jurnal','honor','absensi','kesiswaan','sarpras','website','whatsapp','pengaturan'];
  var clean = Array.isArray(menus) ? menus.map(String).filter(function(k, i, a){return allowed.indexOf(k)>=0 && a.indexOf(k)===i;}) : [];
  PropertiesService.getScriptProperties().setProperty('MASDA_PUBLIC_HOME_MENUS', JSON.stringify(clean));
  return {success:true, message:'Tampilan halaman awal berhasil disimpan.', menus:clean};
}


// =============================================================
// API JSON UNTUK FRONTEND TABLER DI VERCEL (ADITIF; doGet LAMA TETAP)
// Endpoint yang didukung pada tahap integrasi pertama: login, session,
// logout, dashboard. Jangan menambahkan dispatch nama fungsi secara bebas.
// =============================================================
function doPost(e) {
  var output;
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var action = String(req.action || '').trim();
    var result;

    if (action === 'login') {
      result = checkLogin(String(req.username || ''), String(req.password || ''));
    } else if (action === 'session') {
      result = getSessionUser(String(req.sessionToken || ''));
    } else if (action === 'logout') {
      result = logoutSession(String(req.sessionToken || ''));
    } else if (action === 'dashboard') {
      var user = getSessionUser(String(req.sessionToken || ''));
      if (!user || !user.success) {
        result = { success: false, code: 'SESSION_EXPIRED', message: 'Sesi berakhir. Silakan masuk kembali.' };
      } else if (!masdaCanAccess_(user, 'dashboard')) {
        result = { success: false, code: 'FORBIDDEN', message: 'Akun ini tidak memiliki akses ke Dashboard.' };
      } else {
        result = { success: true, data: getDashboardSummary() };
      }
    } else {
      result = { success: false, code: 'UNKNOWN_ACTION', message: 'Aksi API tidak dikenal.' };
    }
  } catch (err) {
    result = { success: false, code: 'SERVER_ERROR', message: 'Terjadi kesalahan pada backend Si MasDA.' };
    console.error(err && err.stack ? err.stack : err);
  }
  output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function masdaCanAccess_(user, menuKey) {
  if (!user || !user.success) return false;
  if (String(user.role || '').trim().toLowerCase() === 'administrator') return true;
  var detail = user.aksesDetail && typeof user.aksesDetail === 'object' ? user.aksesDetail : {};
  if (Object.prototype.hasOwnProperty.call(detail, menuKey)) return detail[menuKey] !== 'off';
  var list = String(user.akses || '').split(',').map(function(x){ return x.trim(); });
  return list.indexOf(menuKey) >= 0;
}
