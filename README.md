# Si MasDA — Frontend Tabler dengan API terpusat

Paket ini memperluas integrasi frontend Tabler ke backend Google Apps Script yang sudah digunakan Si MasDA. Backend tetap memakai Google Sheets yang sama dan `doGet()` lama dipertahankan.

## Modul yang tersedia di frontend
- Login, pemulihan sesi saat refresh, logout, dashboard.
- Data Master: Guru, Kelas, Siswa, Jadwal Mapel.
- Jurnal Guru: daftar, input, hapus; validasi jadwal dan pencegahan duplikasi tetap dijalankan fungsi backend lama.
- Honor Guru: rekap bulanan; akun Guru hanya meminta rekap miliknya.
- Absensi siswa: menampilkan dan menyimpan status harian untuk data absensi yang sudah dimuat.
- Kesiswaan/pelanggaran: daftar dan input catatan pelanggaran.
- Sarpras: daftar, tambah, hapus inventaris.
- PPDB: daftar, tambah, edit, hapus data pendaftar.
- Profil Sekolah, Struktur Organisasi, Pengguna/Hak Akses, Website Terkait, dan Pengumuman melalui sub-menu Profil & Pengaturan.

## Penting: file backend tidak ada di ZIP frontend ini
File `kode.gs` disediakan terpisah agar tidak ikut terunggah ke repository GitHub publik. Jangan menaruh kode Apps Script pada repository publik jika tidak diperlukan.

## Pemasangan satu kali untuk backend
1. Buat cadangan kode Apps Script aktif.
2. Unduh file `kode.gs` versi integrasi yang diberikan terpisah.
3. Pada project Apps Script Si MasDA yang sama, ganti isi file `.gs` dengan kode lengkap tersebut. `doGet()` dan fungsi lama dipertahankan; endpoint `doPost(e)` terpusat ditambahkan di bagian akhir.
4. Simpan, lalu **Deploy → Manage deployments → Edit Web app → New version → Deploy**. Pertahankan URL `/exec` yang sama.
5. Di Vercel, pastikan Environment Variable `MASDA_GAS_URL` berisi URL `/exec` aktif. Jangan menaruh URL tersebut di kode frontend.

## Pemasangan frontend
1. Ekstrak ZIP ini.
2. Unggah isi folder ini ke root repository GitHub. Pastikan folder `api/` ikut diunggah dan file `api/masda.js` ada di dalamnya.
3. Jangan unggah file backend `kode.gs` ke repository publik.
4. Commit perubahan. Vercel akan membuat deployment baru dari branch yang terhubung.

## Keamanan dan pengujian
- Endpoint menerima action yang diizinkan saja; tidak ada dispatch fungsi GAS arbitrer.
- Endpoint memeriksa token sesi dan hak akses menu sebelum menjalankan operasi.
- Fungsi mutasi penting dibatasi sesuai role/hak akses.
- Password tidak dikirimkan pada daftar pengguna di frontend; saat mengedit akun, masukkan password baru jika ingin menyimpannya.
- NIP/NISN tetap dikirim sebagai teks.
- Lakukan pengujian pada akun uji terlebih dahulu, terutama simpan/hapus. Jangan menguji hapus dengan data produksi yang belum dicadangkan.

## Batasan yang masih perlu diverifikasi/diintegrasikan terpisah
Paket ini menghubungkan modul utama yang ditampilkan di Tabler. Fitur legacy yang tidak tersedia sebagai menu pada frontend ini—seperti pemindaian QR/kamera, alur siswa mandiri, gateway WhatsApp dan QR gateway, kalender/hari efektif, pengaturan halaman awal publik, serta format lengkap ekspor PDF/cetak—belum dipindahkan menjadi antarmuka Tabler. Antarmuka/fitur tersebut tetap berada pada aplikasi GAS lama sampai dibuat dan diuji pada tahap berikutnya.

Kode telah diperiksa secara sintaks JavaScript dan HTML secara lokal. Pengujian live terhadap deployment dan Google Sheets Anda harus dilakukan setelah pemasangan; ZIP ini tidak dapat menjamin seluruh operasi live tanpa pengujian tersebut.
