// =====================================================================
// PENGATURAN SISTEM — satu-satunya file yang perlu diubah saat pemasangan
// =====================================================================
export const CONFIG = {
  // 'demo'     → memakai data contoh di browser (tanpa Supabase), untuk mencoba tampilan
  // 'supabase' → memakai database Supabase sungguhan
  MODE: 'supabase',

  // Isi dari Supabase: Project Settings → API
  SUPABASE_URL: 'https://aqqppvjksucxevhywlnu.supabase.co/rest/v1/',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxcXBwdmprc3VjeGV2aHl3bG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTM5MDIsImV4cCI6MjEwODA2OTkwMn0.Yj8rsulUzhLE8xOrgn1YHBad-IrCCPbGGQaqWb5WeIg',

  APP_NAME: 'SI-UKK SMK',
  APP_SUBTITLE: 'Sistem Informasi Uji Kompetensi Keahlian SMK se-Indonesia',
  INSTANSI: 'Direktorat Sekolah Menengah Kejuruan, Kemendikdasmen',
  SUMBER_DATA: 'Data acuan: Dapodik per 27 September 2026',
};
