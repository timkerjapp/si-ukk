// Implementasi lapisan data untuk MODE DEMO.
// Data contoh (3 provinsi) dimuat dari assets/demo/demo-data.json dan semua
// perubahan hanya disimpan di browser ini. Aturan validasinya sama dengan
// fungsi database di sql/01_skema.sql.

const STORE_KEY = 'siukk-demo-v1';
const REF_METODE = [
  { kode: 'LSP', nama: 'UKK bersama LSP', urutan: 1 },
  { kode: 'DUDI', nama: 'UKK bersama dunia kerja/asosiasi profesi', urutan: 2 },
  { kode: 'TANPA', nama: 'UKK tidak melibatkan instansi lain', urutan: 3 },
];
const REF_JENIS = [
  { kode: 'LSP-P1', nama: 'LSP-P1', metode_kode: 'LSP', urutan: 1 },
  { kode: 'LSP-P2', nama: 'LSP-P2', metode_kode: 'LSP', urutan: 2 },
  { kode: 'LSP-P3', nama: 'LSP-P3', metode_kode: 'LSP', urutan: 3 },
  { kode: 'INDUSTRI', nama: 'Dunia Kerja/Industri', metode_kode: 'DUDI', urutan: 4 },
  { kode: 'ASOSIASI', nama: 'Asosiasi Profesi', metode_kode: 'DUDI', urutan: 5 },
];
const DEMO_PASSWORD = 'demo';

let db;          // { sekolah: Map, kk: Map, isian: Map, riwayat: [], laporan: [], dinas, konsentrasi, seq }
let loading;

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      kk: [...db.kk.values()].filter(k => k.sumber === 'tambahan' || k.dikecualikan || k._ubah),
      isian: [...db.isian.values()], riwayat: db.riwayat, laporan: db.laporan, seq: db.seq,
    }));
  } catch { /* penyimpanan browser tidak tersedia: perubahan hanya bertahan selama halaman terbuka */ }
}

async function ready() {
  if (db) return db;
  if (!loading) loading = (async () => {
    const url = new URL('../demo/demo-data.json', import.meta.url);
    const base = await (await fetch(url)).json();
    db = {
      sekolah: new Map(base.sekolah.map(s => [s.npsn, s])),
      kk: new Map(base.kk.map(k => [k.id, k])),
      isian: new Map(base.isian.map(i => [i.kk_id, i])),
      riwayat: base.riwayat, laporan: [], dinas: base.dinas, konsentrasi: base.konsentrasi,
      seq: { kk: Math.max(...base.kk.map(k => k.id)) + 1, riwayat: base.riwayat.length + 1, laporan: 1 },
    };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { saved = null; }
    if (saved) {
      for (const k of saved.kk || []) db.kk.set(k.id, k);
      db.isian = new Map((saved.isian || []).map(i => [i.kk_id, i]));
      db.riwayat = saved.riwayat || []; db.laporan = saved.laporan || []; db.seq = saved.seq || db.seq;
    }
    return db;
  })();
  return loading;
}

const now = () => new Date().toISOString();
const clean = s => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t || null; };
const fail = m => { throw new Error(m); };
const delay = (v) => new Promise(r => setTimeout(() => r(v), 60));

function vkk(k) {
  const s = db.sekolah.get(k.npsn); const i = db.isian.get(k.id);
  const m = i && REF_METODE.find(x => x.kode === i.metode);
  const j = i && REF_JENIS.find(x => x.kode === i.jenis_mitra);
  return {
    kk_id: k.id, npsn: k.npsn, nama_sekolah: s.nama, status_sekolah: s.status, provinsi: s.provinsi,
    kab_kota: s.kab_kota, kecamatan: s.kecamatan, bidang: k.bidang, program: k.program,
    konsentrasi: k.konsentrasi, kurikulum: k.kurikulum, siswa_xii: k.siswa_xii, siswa_xiii: k.siswa_xiii,
    sumber: k.sumber, dikecualikan: k.dikecualikan,
    metode: i?.metode ?? null, metode_nama: m?.nama ?? null, jenis_mitra: i?.jenis_mitra ?? null,
    jenis_mitra_nama: j?.nama ?? null, nama_instansi: i?.nama_instansi ?? null, diubah_pada: i?.diubah_pada ?? null,
    terisi: !!i,
  };
}
function rekapSekolah(s) {
  const ks = [...db.kk.values()].filter(k => k.npsn === s.npsn);
  return rekapFrom(s, ks);
}
function rekapFrom(s, ks) {
  const aktif = ks.filter(k => !k.dikecualikan);
  const isi = aktif.map(k => db.isian.get(k.id)).filter(Boolean);
  const jml = aktif.length, ter = isi.length;
  const st = jml === 0 ? 'Tidak ada KK' : ter === 0 ? 'Belum mengisi' : ter < jml ? 'Sebagian' : 'Lengkap';
  const last = ks.map(k => db.isian.get(k.id)?.diubah_pada).filter(Boolean).sort().pop() || null;
  return { npsn: s.npsn, nama: s.nama, status: s.status, provinsi: s.provinsi, kab_kota: s.kab_kota,
    kecamatan: s.kecamatan, jml_kk: jml, kk_terisi: ter, status_pengisian: st, terakhir_diubah: last };
}
function allRekap() {
  const by = new Map();
  for (const k of db.kk.values()) { if (!by.has(k.npsn)) by.set(k.npsn, []); by.get(k.npsn).push(k); }
  return [...db.sekolah.values()].map(s => rekapFrom(s, by.get(s.npsn) || []));
}
function group(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    const g = m.get(key) || { jml_sekolah: 0, lengkap: 0, sebagian: 0, belum: 0, jml_kk: 0, kk_terisi: 0 };
    g.jml_sekolah++; g.jml_kk += r.jml_kk; g.kk_terisi += r.kk_terisi;
    if (r.status_pengisian === 'Lengkap') g.lengkap++;
    else if (r.status_pengisian === 'Sebagian') g.sebagian++;
    else if (r.status_pengisian === 'Belum mengisi') g.belum++;
    m.set(key, g);
  }
  return m;
}

export async function getRef() {
  await ready();
  return { metode: REF_METODE, jenis: REF_JENIS, konsentrasi: db.konsentrasi };
}
export async function getDinasList() { await ready(); return db.dinas; }
export async function getSekolah(npsn) {
  await ready(); const s = db.sekolah.get(String(npsn).trim());
  return delay(s ? rekapSekolah(s) : null);
}
export async function cariSekolah(q, provinsi) {
  await ready(); const s = String(q).trim().toLowerCase(); if (!s) return [];
  const hits = [...db.sekolah.values()].filter(x =>
    (!provinsi || x.provinsi === provinsi) && (/^\d+$/.test(s) ? x.npsn.startsWith(s) : x.nama.toLowerCase().includes(s)));
  return hits.slice(0, 25).map(rekapSekolah);
}
export async function getKkSekolah(npsn) {
  await ready();
  return delay([...db.kk.values()].filter(k => k.npsn === npsn).map(vkk)
    .sort((a, b) => (a.program || '').localeCompare(b.program || '') || a.konsentrasi.localeCompare(b.konsentrasi)));
}

function tulisIsian(kkId, m, j, n, aksi) {
  const lama = db.isian.get(kkId) || null;
  let baru = null;
  if (m == null) db.isian.delete(kkId);
  else { baru = { kk_id: kkId, metode: m, jenis_mitra: j, nama_instansi: n, diubah_pada: now() }; db.isian.set(kkId, baru); }
  db.riwayat.push({ id: db.seq.riwayat++, kk_id: kkId, aksi,
    metode_lama: lama?.metode ?? null, jenis_mitra_lama: lama?.jenis_mitra ?? null, nama_instansi_lama: lama?.nama_instansi ?? null,
    metode_baru: m, jenis_mitra_baru: j, nama_instansi_baru: n, waktu: now() });
  persist();
  return baru;
}

export async function simpanIsian(npsn, kkId, metode, jenis, nama) {
  await ready();
  const k = db.kk.get(kkId);
  if (!k || k.npsn !== npsn) fail('KK tidak ditemukan untuk sekolah ini');
  if (k.dikecualikan) fail('KK ini sedang dilaporkan tidak ada. Batalkan laporannya dulu untuk mengisi.');
  if (!REF_METODE.some(x => x.kode === metode)) fail('Metode UKK tidak dikenal');
  let j = clean(jenis), n = clean(nama);
  if (metode === 'TANPA') { j = null; n = null; }
  else {
    if (!REF_JENIS.some(x => x.kode === j && x.metode_kode === metode)) fail('Jenis mitra tidak sesuai dengan metode UKK yang dipilih');
    if (!n) fail('Nama instansi mitra wajib diisi');
    if (n.length > 200) fail('Nama instansi terlalu panjang (maksimal 200 karakter)');
  }
  const lama = db.isian.get(kkId);
  if (lama && lama.metode === metode && lama.jenis_mitra === j && lama.nama_instansi === n) return delay(lama);
  return delay(tulisIsian(kkId, metode, j, n, 'simpan'));
}

export async function getRiwayat(kkId) {
  await ready();
  return delay(db.riwayat.filter(r => r.kk_id === kkId).sort((a, b) => b.waktu.localeCompare(a.waktu) || b.id - a.id));
}

export async function pulihkan(npsn, riwayatId, versi = 'baru') {
  await ready();
  const r = db.riwayat.find(x => x.id === riwayatId);
  const k = r && db.kk.get(r.kk_id);
  if (!r || !k || k.npsn !== npsn) fail('Riwayat tidak ditemukan untuk sekolah ini');
  const v = versi === 'lama'
    ? [r.metode_lama, r.jenis_mitra_lama, r.nama_instansi_lama]
    : [r.metode_baru, r.jenis_mitra_baru, r.nama_instansi_baru];
  return delay(tulisIsian(r.kk_id, ...v, 'pulihkan'));
}

function laporanView(l) {
  const s = db.sekolah.get(l.npsn);
  return { ...l, nama_sekolah: s?.nama, provinsi: s?.provinsi, kab_kota: s?.kab_kota };
}
export async function lapor(npsn, d) {
  await ready();
  if (!db.sekolah.has(npsn)) fail('Sekolah tidak ditemukan');
  const ket = clean(d.keterangan);
  let lap;
  if (d.jenis === 'TIDAK_ADA') {
    const k = db.kk.get(d.kkId);
    if (!k || k.npsn !== npsn) fail('KK tidak ditemukan untuk sekolah ini');
    if (k.dikecualikan) fail('KK ini sudah dilaporkan');
    k.dikecualikan = true; k._ubah = true;
    lap = { jenis: 'TIDAK_ADA', kk_id: k.id, konsentrasi: k.konsentrasi };
  } else if (d.jenis === 'BELUM_TERCATAT') {
    const ref = db.konsentrasi.find(x => x.konsentrasi === d.konsentrasi);
    if (!ref) fail('Konsentrasi keahlian tidak ada di daftar');
    const xii = +d.siswaXii || 0, xiii = +d.siswaXiii || 0;
    if (xii < 0 || xiii < 0 || xii + xiii === 0) fail('Isi jumlah siswa kelas XII dan/atau XIII');
    let k = [...db.kk.values()].find(x => x.npsn === npsn && x.konsentrasi === ref.konsentrasi);
    if (k && !k.dikecualikan) fail('KK ini sudah tercatat di sekolah Anda');
    if (k) Object.assign(k, { dikecualikan: false, siswa_xii: xii, siswa_xiii: xiii, _ubah: true });
    else {
      k = { id: db.seq.kk++, npsn, bidang: ref.bidang, program: ref.program, konsentrasi: ref.konsentrasi,
        kurikulum: 'Merdeka', siswa_xii: xii, siswa_xiii: xiii, sumber: 'tambahan', dikecualikan: false };
      db.kk.set(k.id, k);
    }
    lap = { jenis: 'BELUM_TERCATAT', kk_id: k.id, konsentrasi: ref.konsentrasi };
  } else if (d.jenis === 'LAINNYA') {
    if (!ket) fail('Keterangan wajib diisi');
    const k = d.kkId ? db.kk.get(d.kkId) : null;
    lap = { jenis: 'LAINNYA', kk_id: k?.id ?? null, konsentrasi: k?.konsentrasi ?? null };
  } else fail('Jenis laporan tidak dikenal');
  const row = { id: db.seq.laporan++, npsn, ...lap, keterangan: ket, status: 'baru', catatan_direktorat: null,
    dibuat_pada: now(), diperbarui_pada: now() };
  db.laporan.push(row); persist();
  return delay(row);
}
function batalkanEfek(l) {
  const k = l.kk_id && db.kk.get(l.kk_id); if (!k) return;
  if (l.jenis === 'TIDAK_ADA') k.dikecualikan = false;
  else if (l.jenis === 'BELUM_TERCATAT' && k.sumber === 'tambahan') k.dikecualikan = true;
  k._ubah = true;
}
export async function batalkanLaporan(npsn, id) {
  await ready();
  const l = db.laporan.find(x => x.id === id && x.npsn === npsn);
  if (!l) fail('Laporan tidak ditemukan');
  if (l.status !== 'baru') fail('Laporan yang sudah diproses tidak bisa dibatalkan');
  batalkanEfek(l); l.status = 'dibatalkan'; l.diperbarui_pada = now(); persist();
  return delay(l);
}
export async function getLaporan({ provinsi, npsn } = {}) {
  await ready();
  return delay(db.laporan.map(laporanView)
    .filter(l => (!provinsi || l.provinsi === provinsi) && (!npsn || l.npsn === npsn))
    .sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada) || b.id - a.id));
}
export async function tindakLanjut(id, status, catatan) {
  await ready();
  if (!direktoratAktif()) fail('Hanya akun Direktorat');
  if (!['baru', 'ditindaklanjuti', 'ditolak'].includes(status)) fail('Status tidak dikenal');
  const l = db.laporan.find(x => x.id === id);
  if (!l) fail('Laporan tidak ditemukan');
  if (l.status === 'dibatalkan') fail('Laporan sudah dibatalkan sekolah');
  const k = l.kk_id && db.kk.get(l.kk_id);
  if (status === 'ditolak' && l.status !== 'ditolak') batalkanEfek(l);
  else if (status !== 'ditolak' && l.status === 'ditolak' && k) {
    k.dikecualikan = l.jenis === 'TIDAK_ADA'; k._ubah = true;
  }
  Object.assign(l, { status, catatan_direktorat: clean(catatan), diperbarui_pada: now() }); persist();
  return delay(l);
}

export async function getRekapProvinsi() {
  await ready();
  return delay([...group(allRekap(), r => r.provinsi)].map(([provinsi, g]) => ({ provinsi, ...g }))
    .sort((a, b) => a.provinsi.localeCompare(b.provinsi)));
}
export async function getRekapKabkota(provinsi) {
  await ready();
  return delay([...group(allRekap().filter(r => r.provinsi === provinsi), r => r.kab_kota)]
    .map(([kab_kota, g]) => ({ provinsi, kab_kota, ...g })).sort((a, b) => a.kab_kota.localeCompare(b.kab_kota)));
}
export async function getSekolahRekap(provinsi) {
  await ready(); return delay(allRekap().filter(r => r.provinsi === provinsi));
}
export async function getKkProvinsi(provinsi) {
  await ready(); return delay([...db.kk.values()].map(vkk).filter(r => r.provinsi === provinsi));
}
export async function getKkNasional() { await ready(); return delay([...db.kk.values()].map(vkk)); }

export async function getSebaranNasional() {
  await ready();
  const m = new Map();
  for (const r of [...db.kk.values()].map(vkk)) {
    const key = [r.provinsi, r.bidang, r.program, r.konsentrasi].join('|');
    const g = m.get(key) || { provinsi: r.provinsi, bidang: r.bidang, program: r.program, konsentrasi: r.konsentrasi,
      jml_kk: 0, lsp: 0, dudi: 0, tanpa: 0, belum: 0, lsp_p1: 0, lsp_p2: 0, lsp_p3: 0, industri: 0, asosiasi: 0 };
    if (!r.dikecualikan) {
      g.jml_kk++;
      if (r.metode === 'LSP') g.lsp++; else if (r.metode === 'DUDI') g.dudi++; else if (r.metode === 'TANPA') g.tanpa++; else g.belum++;
    }
    const jm = { 'LSP-P1': 'lsp_p1', 'LSP-P2': 'lsp_p2', 'LSP-P3': 'lsp_p3', INDUSTRI: 'industri', ASOSIASI: 'asosiasi' }[r.jenis_mitra];
    if (jm) g[jm]++;
    m.set(key, g);
  }
  return delay([...m.values()]);
}
export async function getMitraNasional(limit = 100) {
  await ready();
  const m = new Map();
  for (const r of [...db.kk.values()].map(vkk)) {
    if (!r.nama_instansi || r.dikecualikan) continue;
    const nama = r.nama_instansi.replace(/\s+/g, ' ').trim().toUpperCase();
    const key = r.jenis_mitra + '|' + nama;
    const g = m.get(key) || { jenis_mitra: r.jenis_mitra, jenis_mitra_nama: r.jenis_mitra_nama, nama_instansi: nama,
      jml_kk: 0, sekolah: new Set(), prov: new Set() };
    g.jml_kk++; g.sekolah.add(r.npsn); g.prov.add(r.provinsi); m.set(key, g);
  }
  return delay([...m.values()].map(g => ({ jenis_mitra: g.jenis_mitra, jenis_mitra_nama: g.jenis_mitra_nama,
    nama_instansi: g.nama_instansi, jml_kk: g.jml_kk, jml_sekolah: g.sekolah.size, jml_provinsi: g.prov.size }))
    .sort((a, b) => b.jml_kk - a.jml_kk).slice(0, limit));
}

function direktoratAktif() { try { return sessionStorage.getItem('siukk-demo-dir') === '1'; } catch { return demoDir; } }
let demoDir = false;
export async function loginDirektorat(email, password) {
  if (password !== DEMO_PASSWORD) fail('Email atau kata sandi salah (mode demo: kata sandi "demo")');
  demoDir = true; try { sessionStorage.setItem('siukk-demo-dir', '1'); } catch { /* abaikan */ }
  return true;
}
export async function logoutDirektorat() { demoDir = false; try { sessionStorage.removeItem('siukk-demo-dir'); } catch { /* abaikan */ } }
export async function isDirektorat() { return direktoratAktif(); }
