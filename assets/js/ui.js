// Alat bantu tampilan yang dipakai semua halaman
import { CONFIG } from './config.js';
import { isDemo } from './api.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmt = n => Number(n || 0).toLocaleString('id-ID');
export const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
export const fmtPct = (a, b) => (b ? pct(a, b).toLocaleString('id-ID') : '0') + '%';
export function fmtWaktu(t) {
  if (!t) return '–';
  const d = new Date(t);
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export const qs = name => new URLSearchParams(location.search).get(name);

export function html(strings, ...vals) {
  return strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), '');
}

export function header({ title, subtitle, right = '' }) {
  const banner = isDemo ? `<div class="demo-banner">Mode demo — memakai data contoh 3 provinsi; isian hanya tersimpan di browser ini.</div>` : '';
  return `${banner}<header class="topbar">
    <div class="brand">${esc(CONFIG.APP_NAME)}<small>${esc(subtitle || CONFIG.APP_SUBTITLE)}</small></div>
    <div class="spacer"></div>
    <div class="row" style="gap:16px">${title ? `<span class="small">${esc(title)}</span>` : ''}${right}</div>
  </header>`;
}

export function statusChip(st) {
  const cls = { 'Lengkap': 'ok', 'Sebagian': 'warn', 'Belum mengisi': 'bad', 'Tidak ada KK': 'grey' }[st] || 'grey';
  return `<span class="chip ${cls}">${esc(st)}</span>`;
}
export function laporanChip(st) {
  const m = { baru: ['info', 'Baru'], ditindaklanjuti: ['ok', 'Ditindaklanjuti'], ditolak: ['bad', 'Ditolak'], dibatalkan: ['grey', 'Dibatalkan'] };
  const [c, t] = m[st] || ['grey', st];
  return `<span class="chip ${c}">${t}</span>`;
}
export const JENIS_LAPORAN = {
  TIDAK_ADA: 'KK tidak ada / tidak UKK tahun ini',
  BELUM_TERCATAT: 'KK belum tercatat',
  LAINNYA: 'Data lain keliru',
};

export function progress(a, b) {
  return `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="progress" style="flex:1"><span style="width:${pct(a, b)}%"></span></div><span class="small num">${fmtPct(a, b)}</span></div>`;
}

export const WARNA_METODE = { LSP: 'var(--c-lsp)', DUDI: 'var(--c-dudi)', TANPA: 'var(--c-tanpa)', BELUM: 'var(--c-belum)' };
export function stackbar(parts) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return `<div class="stackbar" role="img" aria-label="${esc(parts.map(p => p.label + ' ' + p.n).join(', '))}">${parts.map(p =>
    p.n ? `<span title="${esc(p.label)}: ${fmt(p.n)}" style="width:${p.n / total * 100}%;background:${p.color}"></span>` : '').join('')}</div>`;
}
export function legendMetode() {
  return `<div class="legend">
    <span><i style="background:var(--c-lsp)"></i>Bersama LSP</span>
    <span><i style="background:var(--c-dudi)"></i>Bersama dunia kerja/asosiasi profesi</span>
    <span><i style="background:var(--c-tanpa)"></i>Tidak melibatkan instansi lain</span>
    <span><i style="background:var(--c-belum)"></i>Belum diisi</span></div>`;
}
export function hbars(items, color = 'var(--primary)') {
  const max = Math.max(1, ...items.map(i => i.n));
  return items.map(i => `<div class="hbar"><span>${esc(i.label)}</span><div class="track"><span style="width:${i.n / max * 100}%;background:${i.color || color}"></span></div><span class="num r">${fmt(i.n)}</span></div>`).join('');
}

export function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5000 : 2600);
}

export function modal({ title, body, wide = false }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="btn small ghost" data-close aria-label="Tutup">✕</button></div>
    <div class="modal-body">${body || ''}</div></div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  return { el: bg.querySelector('.modal-body'), close };
}

export function tabs(container, defs, onChange) {
  container.innerHTML = `<div class="tabs" role="tablist">${defs.map((d, i) =>
    `<button role="tab" data-k="${d.key}" aria-selected="${i === 0}">${esc(d.label)}</button>`).join('')}</div><div class="tab-body" style="margin-top:16px"></div>`;
  const body = container.querySelector('.tab-body');
  const select = key => {
    $$('.tabs button', container).forEach(b => b.setAttribute('aria-selected', b.dataset.k === key));
    onChange(key, body);
  };
  container.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) select(b.dataset.k); });
  select(defs[0].key);
  return { select };
}

// Unduh Excel. sheets = [{ name, rows: [ {kolom: nilai} ] }]
export async function downloadXlsx(filename, sheets) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Keterangan: 'Tidak ada data' }]);
    const keys = Object.keys(s.rows[0] || { Keterangan: '' });
    ws['!cols'] = keys.map(k => ({ wch: Math.min(60, Math.max(k.length, ...s.rows.slice(0, 300).map(r => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export function kkRowsForExport(rows) {
  return rows.map(r => ({
    'Provinsi': r.provinsi, 'Kab/Kota': r.kab_kota, 'NPSN': r.npsn, 'Nama Sekolah': r.nama_sekolah, 'Status Sekolah': r.status_sekolah,
    'Bidang Keahlian': r.bidang, 'Program Keahlian': r.program, 'Konsentrasi Keahlian': r.konsentrasi, 'Kurikulum': r.kurikulum,
    'Siswa XII': r.siswa_xii, 'Siswa XIII': r.siswa_xiii,
    'Keterangan KK': r.dikecualikan ? 'Dilaporkan tidak ada' : (r.sumber === 'tambahan' ? 'Tambahan sekolah' : ''),
    'Metode UKK': r.metode_nama || (r.dikecualikan ? '' : 'Belum diisi'), 'Jenis Mitra': r.jenis_mitra_nama || '',
    'Nama Instansi Mitra': r.nama_instansi || '', 'Terakhir Diubah': r.diubah_pada ? fmtWaktu(r.diubah_pada) : '',
  }));
}
export function sekolahRowsForExport(rows) {
  return rows.map(r => ({
    'Provinsi': r.provinsi, 'Kab/Kota': r.kab_kota, 'Kecamatan': r.kecamatan, 'NPSN': r.npsn, 'Nama Sekolah': r.nama,
    'Status Sekolah': r.status, 'Jumlah KK': r.jml_kk, 'KK Terisi': r.kk_terisi, 'Status Pengisian': r.status_pengisian,
    'Terakhir Diubah': r.terakhir_diubah ? fmtWaktu(r.terakhir_diubah) : '',
  }));
}

export function describeIsian(m, j, n, ref) {
  if (!m) return '<span class="muted">(kosong)</span>';
  const mn = ref.metode.find(x => x.kode === m)?.nama || m;
  if (m === 'TANPA') return esc(mn);
  const jn = ref.jenis.find(x => x.kode === j)?.nama || j;
  return `${esc(mn)} · ${esc(jn)} · <b>${esc(n)}</b>`;
}

export function errorBox(el, e) {
  el.innerHTML = `<div class="alert bad">${esc(e.message || e)}</div>`;
}
