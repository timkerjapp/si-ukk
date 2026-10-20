// Lapisan data: semua halaman hanya memanggil fungsi di sini.
// Isinya dipilih sesuai CONFIG.MODE (Supabase sungguhan atau demo).
import { CONFIG } from './config.js';

let impl;
async function load() {
  if (!impl) {
    impl = CONFIG.MODE === 'supabase'
      ? await import('./api-supabase.js')
      : await import('./api-demo.js');
  }
  return impl;
}

const names = [
  'getRef', 'getDinasList', 'getSekolah', 'cariSekolah', 'getKkSekolah', 'simpanIsian', 'getRiwayat', 'pulihkan',
  'lapor', 'batalkanLaporan', 'getLaporan', 'tindakLanjut',
  'getRekapProvinsi', 'getRekapKabkota', 'getSekolahRekap', 'getKkProvinsi', 'getKkNasional',
  'getSebaranNasional', 'getMitraNasional',
  'loginDirektorat', 'logoutDirektorat', 'isDirektorat',
];
export const api = Object.fromEntries(names.map(n => [n, async (...a) => (await load())[n](...a)]));
export const isDemo = CONFIG.MODE !== 'supabase';
