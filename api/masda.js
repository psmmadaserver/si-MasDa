export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Gunakan metode POST.' });
  }

  const gasUrl = process.env.MASDA_GAS_URL;
  if (!gasUrl || !/^https:\/\/script\.google\.com\/macros\/s\//.test(gasUrl)) {
    return res.status(500).json({ success: false, message: 'Konfigurasi backend belum lengkap. Atur MASDA_GAS_URL di Vercel.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const allowed = new Set(['login','session','logout','dashboard','masterData','masterGuruList','masterGuruSave','masterGuruDelete','masterKelasSave','masterKelasDelete','masterSiswaSave','masterSiswaDelete','masterJadwalSave','masterJadwalDelete','jurnalList','jurnalSave','jurnalDelete','honorList','honorMine','absensiStudents','absensiSave','absensiDaily','absensiMonthly','kesiswaanList','kesiswaanSave','sarprasList','sarprasSave','sarprasDelete','ppdbList','ppdbSave','ppdbDelete','profilGet','profilSave','strukturGet','strukturSave','websiteList','websiteSave','websiteDelete','penggunaList','penggunaSave','penggunaDelete','pengumumanList','pengumumanSave','pengumumanDelete']);
    if (!body || !allowed.has(String(body.action || ''))) {
      return res.status(400).json({ success: false, message: 'Aksi API tidak diizinkan.' });
    }

    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      console.error('Apps Script returned non-JSON response:', upstream.status, text.slice(0, 300));
      return res.status(502).json({ success: false, message: 'Respons Apps Script tidak valid. Pastikan versi deployment sudah diperbarui.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Si MasDA API proxy error:', err);
    return res.status(502).json({ success: false, message: 'Tidak dapat terhubung ke backend Apps Script.' });
  }
}
