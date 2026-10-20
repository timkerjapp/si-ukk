// Implementasi lapisan data untuk Supabase
import { CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'siukk-auth' },
});

function chk({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server');
  return data;
}

// Ambil semua baris (PostgREST membatasi 1.000 baris per permintaan)
async function all(make, onProgress) {
  const size = 1000; let out = [];
  for (let from = 0; ; from += size) {
    const rows = chk(await make().range(from, from + size - 1));
    out = out.concat(rows);
    onProgress && onProgress(out.length);
    if (rows.length < size) break;
  }
  return out;
}

let refCache;
export async function getRef() {
  if (!refCache) {
    const [metode, jenis, konsentrasi] = await Promise.all([
      sb.from('ref_metode').select('*').order('urutan').then(chk),
      sb.from('ref_jenis_mitra').select('*').order('urutan').then(chk),
      all(() => sb.from('ref_konsentrasi').select('bidang,program,konsentrasi').order('bidang').order('program').order('konsentrasi')),
    ]);
    refCache = { metode, jenis, konsentrasi };
  }
  return refCache;
}

export async function getDinasList() {
  return chk(await sb.from('dinas').select('nama_dinas,provinsi').order('provinsi'));
}

export async function getSekolah(npsn) {
  const rows = chk(await sb.from('v_sekolah_rekap').select('*').eq('npsn', String(npsn).trim()).limit(1));
  return rows[0] || null;
}

export async function cariSekolah(q, provinsi) {
  const s = String(q).replace(/[,()*%]/g, ' ').trim();
  if (!s) return [];
  let b = sb.from('v_sekolah_rekap').select('*').limit(25).order('nama');
  b = /^\d+$/.test(s) ? b.like('npsn', s + '%') : b.ilike('nama', `%${s}%`);
  if (provinsi) b = b.eq('provinsi', provinsi);
  return chk(await b);
}

export async function getKkSekolah(npsn) {
  return chk(await sb.from('v_kk').select('*').eq('npsn', npsn).order('program').order('konsentrasi'));
}

export async function simpanIsian(npsn, kkId, metode, jenis, nama) {
  return chk(await sb.rpc('simpan_isian', {
    p_npsn: npsn, p_kk_id: kkId, p_metode: metode, p_jenis_mitra: jenis || null, p_nama_instansi: nama || null,
  }));
}

export async function getRiwayat(kkId) {
  return chk(await sb.from('riwayat_isian').select('*').eq('kk_id', kkId).order('waktu', { ascending: false }).order('id', { ascending: false }));
}

export async function pulihkan(npsn, riwayatId, versi = 'baru') {
  return chk(await sb.rpc('pulihkan_isian', { p_npsn: npsn, p_riwayat_id: riwayatId, p_versi: versi }));
}

export async function lapor(npsn, d) {
  return chk(await sb.rpc('lapor_kk', {
    p_npsn: npsn, p_jenis: d.jenis, p_kk_id: d.kkId || null, p_konsentrasi: d.konsentrasi || null,
    p_siswa_xii: d.siswaXii || 0, p_siswa_xiii: d.siswaXiii || 0, p_keterangan: d.keterangan || null,
  }));
}

export async function batalkanLaporan(npsn, id) {
  return chk(await sb.rpc('batalkan_laporan', { p_npsn: npsn, p_laporan_id: id }));
}

export async function getLaporan({ provinsi, npsn } = {}) {
  return all(() => {
    let b = sb.from('v_laporan').select('*').order('dibuat_pada', { ascending: false }).order('id', { ascending: false });
    if (provinsi) b = b.eq('provinsi', provinsi);
    if (npsn) b = b.eq('npsn', npsn);
    return b;
  });
}

export async function tindakLanjut(id, status, catatan) {
  return chk(await sb.rpc('tindak_lanjut_laporan', { p_laporan_id: id, p_status: status, p_catatan: catatan || null }));
}

export async function getRekapProvinsi() {
  return chk(await sb.from('v_rekap_provinsi').select('*').order('provinsi'));
}

export async function getRekapKabkota(provinsi) {
  return chk(await sb.from('v_rekap_kabkota').select('*').eq('provinsi', provinsi).order('kab_kota'));
}

export async function getSekolahRekap(provinsi, onProgress) {
  return all(() => sb.from('v_sekolah_rekap').select('*').eq('provinsi', provinsi).order('npsn'), onProgress);
}

export async function getKkProvinsi(provinsi, onProgress) {
  return all(() => sb.from('v_kk').select('*').eq('provinsi', provinsi).order('kk_id'), onProgress);
}

export async function getKkNasional(onProgress) {
  return all(() => sb.from('v_kk').select('*').order('kk_id'), onProgress);
}

export async function getSebaranNasional() {
  return all(() => sb.from('v_sebaran').select('*').order('provinsi').order('bidang').order('program').order('konsentrasi'));
}

export async function getMitraNasional(limit = 100) {
  return chk(await sb.from('v_mitra_nasional').select('*').order('jml_kk', { ascending: false }).limit(limit));
}

export async function loginDirektorat(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('invalid login')) throw new Error('Email atau kata sandi salah.');
    if (m.includes('not confirmed')) throw new Error('Email belum dikonfirmasi. Di Supabase: Authentication → Users → pilih akun → Confirm user (atau buat ulang dengan "Auto Confirm User").');
    if (m.includes('invalid api key') || m.includes('apikey')) throw new Error('Kunci Supabase di config.js tidak valid. Salin ulang kunci "anon public".');
    throw new Error('Gagal masuk: ' + error.message);
  }
  return true;
}
export async function logoutDirektorat() { await sb.auth.signOut(); }
export async function isDirektorat() {
  const { data } = await sb.auth.getSession();
  return !!data.session;
}
