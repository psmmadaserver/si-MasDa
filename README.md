# Si MasDA — Pemulihan UI lengkap + bridge Vercel

Paket ini menggunakan `index.html` asli Si MasDA dari file sumber yang dikirimkan pengguna, sehingga halaman/komponen WhatsApp Gateway, Absensi QR, PPDB, laporan, pengaturan, dan menu asli tidak sengaja diganti dengan placeholder. `google.script.run` dijembatani ke `/api/masda`, lalu diteruskan ke Apps Script melalui `MASDA_GAS_URL`.

## Struktur
- `index.html`: HTML asli lengkap dengan shim `google.script.run`.
- `api/masda.js`: proxy Vercel ke Google Apps Script.
- `kode.gs`: salinan backend penuh dengan endpoint JSON RPC allowlist.
- `vercel.json`, `package.json`: konfigurasi deployment.

## Pemasangan dengan aman
1. Backup project Apps Script dan Google Sheets terlebih dahulu.
2. Review `kode.gs` ini terhadap kode produksi sebelum mengganti kode. Fungsi doGet lama tetap berada di file; doPost mendapat dukungan RPC allowlist.
3. Paste `kode.gs` ke project Apps Script yang sama, simpan, lalu Deploy > Manage deployments > Edit Web app > New version > Deploy. Pertahankan URL `/exec` yang digunakan Vercel.
4. Upload isi folder paket ke root repository GitHub. Pastikan `api/masda.js` berada di folder `api`. Jangan upload `kode.gs` ke repository publik; simpan hanya di Apps Script.
5. Pada Vercel, pastikan `MASDA_GAS_URL` berisi URL `/exec` deployment Apps Script. Redeploy frontend.
6. Uji login/logout, pemulihan sesi, semua modul, operasi tulis, QR kamera, dan WhatsApp gateway dengan data uji.

## Penting
- Paket ini memulihkan UI HTML asli, bukan mengubah semua komponen Bootstrap menjadi komponen Tabler murni. UI asli memiliki Bootstrap 5, Bootstrap Icons, chart, QR scanner, XLSX/PDF, dan Leaflet.
- Fungsi eksternal WhatsApp tetap membutuhkan token/provider valid yang diatur melalui aplikasi. QR scanner membutuhkan HTTPS dan izin kamera browser.
- Sintaks lokal tidak membuktikan integrasi produksi. Uji semua modul sebelum dipakai untuk data penting.
- Jangan memublikasikan `kode.gs`, token provider WhatsApp, atau kredensial.


## Perbaikan mobile v3
Versi ini menghapus `transform: translateZ(0)` / backface compositing pada `.content-section` dan menyederhanakan reset viewport saat berpindah menu. Di beberapa versi Android Chrome, layer compositing dapat menyebabkan area konten tampak kosong sampai layar disentuh atau digulir. Perubahan hanya pada `index.html`; backend `kode.gs` dan bridge API tidak diubah.
