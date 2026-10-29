# Si MasDA — Tabler + integrasi awal Apps Script

Paket ini mengaktifkan **login, pemulihan sesi saat refresh, logout, statistik dashboard, dan modul Master Guru** melalui backend Google Apps Script yang sudah ada. Modul Master Guru mendukung daftar, pencarian, tambah, edit, dan hapus untuk akun Administrator. Modul lain tetap berupa penanda dan belum terintegrasi.

## 1. Perbarui Google Apps Script
1. Buka project Apps Script yang saat ini melayani Si MasDA.
2. Buat salinan cadangan kode saat ini.
3. Ganti isi file `.gs` dengan isi `kode.gs` dari paket ini (kode lama dipertahankan dan API `doPost` ditambahkan di bagian akhir).
4. Simpan, lalu buka **Deploy > Manage deployments**.
5. Edit deployment Web app yang sudah ada, pilih **New version**, lalu deploy. Pertahankan URL deployment `/exec` yang sama.
6. Pastikan akses Web app sesuai kebutuhan aplikasi, biasanya **Execute as: Me** dan akses **Anyone** agar server Vercel dapat memanggilnya. Kebijakan domain/akun sekolah dapat memengaruhi pilihan ini.

## 2. Upload frontend ke GitHub
Upload semua isi folder paket ke root repository GitHub, termasuk folder `api/`. Jangan menghapus kode Apps Script asli dari project Apps Script.

## 3. Set environment variable di Vercel
Di **Project > Settings > Environment Variables**, tambahkan:
- Name: `MASDA_GAS_URL`
- Value: URL Web app Apps Script Si MasDA yang aktif, berakhiran `/exec`
- Environment: Production (dan Preview jika dipakai)

Simpan lalu lakukan **Redeploy**. URL backend hanya disimpan di konfigurasi server Vercel, bukan ditulis ke browser.

## 4. Tes
1. Buka domain Vercel.
2. Masuk dengan akun Si MasDA yang sudah terdaftar di sheet `Pengguna`.
3. Pastikan nama/role pengguna tampil dan angka Total Siswa, Total Guru, Total Kelas muncul.
4. Refresh halaman; sesi seharusnya dipulihkan selama token Script Cache belum kedaluwarsa (maksimal 6 jam sesuai kode asli).
5. Klik Keluar; pengguna harus kembali ke halaman login.

## Catatan penting
- Fungsi `doGet()` lama tidak diubah, sehingga antarmuka GAS lama tetap tersedia.
- API menerima aksi `login`, `session`, `logout`, `dashboard`, `masterGuruList`, `masterGuruSave`, dan `masterGuruDelete`; tidak ada pemanggilan fungsi backend arbitrer. Akses Master Guru dibatasi untuk Administrator dan respons daftar tidak mengirim password ke browser.
- Password tidak disimpan di `localStorage`; hanya token sesi dan informasi tampilan pengguna.
- Token sesi berada di `localStorage` sehingga bertahan saat refresh, tetapi berakhir mengikuti batas cache 6 jam pada backend.
- Pada tahap ini yang terintegrasi dari Data Master baru **Master Guru**. Master Kelas, Master Siswa, Jadwal Mapel, Jurnal, Honor, Absensi, Kesiswaan, Sarpras, PPDB, dan pengaturan belum dipindahkan ke API Tabler. Uji Master Guru dengan akun Administrator terlebih dahulu sebelum melanjutkan modul lain.
