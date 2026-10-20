import { api } from './api.js';
import { $, esc, fmt, fmtPct, fmtWaktu, header, statusChip, progress, stackbar, legendMetode, hbars, tabs, modal, toast,
  downloadXlsx, kkRowsForExport, WARNA_METODE, errorBox } from './ui.js';
import { renderWilayah, renderLaporanTable, laporanRows } from './wilayah.js';
import { bukaRiwayat } from './riwayat.js';

const app = $('#app');
let rekap, sebaran, mitra, laporan;

$('#top').innerHTML = header({ subtitle: 'Dashboard Direktorat SMK — rekapitulasi nasional', title: 'Direktorat SMK', right: `<button class="link" id="logout">Keluar</button>` });
$('#logout').addEventListener('click', async () => { await api.logoutDirektorat(); location.href = '../index.html'; });

const parts = g => [
  { label: 'Bersama LSP', n: g.lsp, color: WARNA_METODE.LSP },
  { label: 'Bersama dunia kerja/asosiasi profesi', n: g.dudi, color: WARNA_METODE.DUDI },
  { label: 'Tidak melibatkan instansi lain', n: g.tanpa, color: WARNA_METODE.TANPA },
  { label: 'Belum diisi', n: g.belum, color: WARNA_METODE.BELUM },
];
function sum(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const g = m.get(k) || { key: k, jml_kk: 0, lsp: 0, dudi: 0, tanpa: 0, belum: 0, lsp_p1: 0, lsp_p2: 0, lsp_p3: 0, industri: 0, asosiasi: 0, sample: r };
    for (const f of ['jml_kk', 'lsp', 'dudi', 'tanpa', 'belum', 'lsp_p1', 'lsp_p2', 'lsp_p3', 'industri', 'asosiasi']) g[f] += Number(r[f] || 0);
    m.set(k, g);
  }
  return [...m.values()];
}

async function start() {
  if (!(await api.isDirektorat())) {
    app.innerHTML = `<div class="alert bad">Halaman ini khusus akun Direktorat SMK. <a href="../index.html">Masuk terlebih dahulu</a>.</div>`;
    return;
  }
  await nasional();
}

async function nasional() {
  app.innerHTML = '<div class="loading">Memuat rekap nasional…</div>';
  try {
    [rekap, sebaran, mitra, laporan] = await Promise.all([api.getRekapProvinsi(), api.getSebaranNasional(), api.getMitraNasional(100), api.getLaporan()]);
  } catch (e) { return errorBox(app, e); }
  const T = rekap.reduce((a, r) => { for (const k of ['jml_sekolah', 'lengkap', 'sebagian', 'belum', 'jml_kk', 'kk_terisi']) a[k] += Number(r[k] || 0); return a; },
    { jml_sekolah: 0, lengkap: 0, sebagian: 0, belum: 0, jml_kk: 0, kk_terisi: 0 });
  const lapBaru = laporan.filter(l => l.status === 'baru').length;
  app.innerHTML = `<div class="stack">
    <div class="row" style="justify-content:space-between"><h1>Rekapitulasi nasional</h1>
      <div class="row"><button class="btn" id="n-refresh">Muat ulang</button><button class="btn primary" id="n-unduh">Unduh Excel</button></div></div>
    <div class="grid-stats">
      <div class="stat"><div class="label">Jumlah SMK</div><div class="value">${fmt(T.jml_sekolah)}</div><div class="sub">${fmt(rekap.length)} provinsi · ${fmt(T.jml_kk)} KK</div></div>
      <div class="stat"><div class="label">Lengkap</div><div class="value" style="color:var(--ok)">${fmt(T.lengkap)}</div><div class="sub">${fmtPct(T.lengkap, T.jml_sekolah)} sekolah</div></div>
      <div class="stat"><div class="label">Sebagian</div><div class="value" style="color:var(--warn)">${fmt(T.sebagian)}</div><div class="sub">${fmtPct(T.sebagian, T.jml_sekolah)} sekolah</div></div>
      <div class="stat"><div class="label">Belum mengisi</div><div class="value" style="color:var(--bad)">${fmt(T.belum)}</div><div class="sub">${fmtPct(T.belum, T.jml_sekolah)} sekolah</div></div>
      <div class="stat"><div class="label">KK terisi</div><div class="value">${fmtPct(T.kk_terisi, T.jml_kk)}</div><div class="sub">${fmt(T.kk_terisi)} dari ${fmt(T.jml_kk)} KK</div></div>
    </div>
    <div class="card"><label for="cari">Cari sekolah (nama atau NPSN)</label><input id="cari" type="search" placeholder="Ketik minimal 3 huruf">
      <div id="cari-hasil" style="margin-top:8px"></div></div>
    <div class="card" id="n-tabs"></div>
  </div>`;
  $('#n-refresh').addEventListener('click', nasional);
  $('#n-unduh').addEventListener('click', unduhNasional);
  let timer;
  $('#cari').addEventListener('input', e => {
    clearTimeout(timer); const q = e.target.value.trim();
    if (q.length < 3) { $('#cari-hasil').innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const rows = await api.cariSekolah(q);
        $('#cari-hasil').innerHTML = rows.length ? `<div class="table-wrap"><table><tbody>${rows.map(s => `<tr class="click" data-npsn="${s.npsn}"><td class="num">${s.npsn}</td><td>${esc(s.nama)}</td><td class="small">${esc(s.kab_kota)}, ${esc(s.provinsi)}</td><td class="r num">${s.kk_terisi}/${s.jml_kk}</td><td>${statusChip(s.status_pengisian)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Tidak ditemukan.</p>';
      } catch (err) { errorBox($('#cari-hasil'), err); }
    }, 300);
  });
  $('#cari-hasil').addEventListener('click', e => { const tr = e.target.closest('tr[data-npsn]'); if (tr) detailSekolah(tr.dataset.npsn); });

  tabs($('#n-tabs'), [
    { key: 'prov', label: 'Per provinsi' }, { key: 'sebaran', label: 'Sebaran metode' },
    { key: 'mitra', label: 'Instansi mitra' }, { key: 'laporan', label: `Laporan KK${lapBaru ? ` (${lapBaru} baru)` : ''}` },
  ], (k, body) => ({ prov: tabProv, sebaran: tabSebaran, mitra: tabMitra, laporan: b => renderLaporanTable(b, laporan, { isDirektorat: true, showProv: true }) })[k](body));
}

function tabProv(body) {
  const met = new Map(sum(sebaran, r => r.provinsi).map(g => [g.key, g]));
  body.innerHTML = `<p class="muted small">Klik provinsi untuk menelusuri sampai ke kab/kota dan sekolah.</p>
  <div class="table-wrap"><table><thead><tr><th>Provinsi</th><th class="r">SMK</th><th class="r">Lengkap</th><th class="r">Sebagian</th><th class="r">Belum</th><th style="min-width:170px">Sekolah lengkap</th><th style="min-width:170px">KK terisi</th><th style="min-width:160px">Sebaran metode</th></tr></thead><tbody>
  ${rekap.map(r => `<tr class="click" data-prov="${esc(r.provinsi)}"><td>${esc(r.provinsi)}</td><td class="r num">${fmt(r.jml_sekolah)}</td><td class="r num">${fmt(r.lengkap)}</td><td class="r num">${fmt(r.sebagian)}</td><td class="r num">${fmt(r.belum)}</td>
    <td>${progress(r.lengkap, r.jml_sekolah)}</td><td>${progress(r.kk_terisi, r.jml_kk)}</td><td>${met.has(r.provinsi) ? stackbar(parts(met.get(r.provinsi))) : ''}</td></tr>`).join('')}
  </tbody></table></div><div style="margin-top:10px">${legendMetode()}</div>`;
  body.querySelector('tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-prov]'); if (!tr) return;
    window.scrollTo(0, 0);
    renderWilayah(app, tr.dataset.prov, { isDirektorat: true, onBack: nasional });
  });
}

function tabSebaran(body) {
  const all = sum(sebaran, () => 'nasional')[0] || { jml_kk: 0, lsp: 0, dudi: 0, tanpa: 0, belum: 0 };
  const bid = sum(sebaran, r => r.bidang).sort((a, b) => b.jml_kk - a.jml_kk);
  const kk = sum(sebaran, r => r.program + '|' + r.konsentrasi).sort((a, b) => b.jml_kk - a.jml_kk);
  body.innerHTML = `<div class="stack">
    <div><h3>Nasional (${fmt(all.jml_kk)} KK)</h3>${stackbar(parts(all))}<div style="margin-top:8px">${legendMetode()}</div>
      <div class="row small" style="margin-top:6px;gap:18px">${parts(all).map(p => `<span>${esc(p.label)}: <b class="num">${fmt(p.n)}</b> (${fmtPct(p.n, all.jml_kk)})</span>`).join('')}</div></div>
    <div><h3>Jenis instansi mitra</h3>${hbars([
      { label: 'LSP-P1', n: all.lsp_p1, color: 'var(--c-lsp)' }, { label: 'LSP-P2', n: all.lsp_p2, color: 'var(--c-lsp)' }, { label: 'LSP-P3', n: all.lsp_p3, color: 'var(--c-lsp)' },
      { label: 'Dunia Kerja/Industri', n: all.industri, color: 'var(--c-dudi)' }, { label: 'Asosiasi Profesi', n: all.asosiasi, color: 'var(--c-dudi)' }])}</div>
    <div><h3>Per bidang keahlian</h3><div class="table-wrap"><table><thead><tr><th>Bidang keahlian</th><th class="r">KK</th><th class="r">LSP</th><th class="r">DU/Asosiasi</th><th class="r">Tanpa mitra</th><th class="r">Belum</th><th style="min-width:200px"></th></tr></thead><tbody>
      ${bid.map(g => `<tr><td>${esc(g.key)}</td><td class="r num">${fmt(g.jml_kk)}</td>${parts(g).map(p => `<td class="r num">${fmt(p.n)}</td>`).join('')}<td>${stackbar(parts(g))}</td></tr>`).join('')}</tbody></table></div></div>
    <details><summary style="cursor:pointer"><h3 style="display:inline">Per konsentrasi keahlian</h3> <span class="small muted">(klik untuk membuka)</span></summary><div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Konsentrasi keahlian</th><th class="r">KK</th><th class="r">LSP</th><th class="r">DU/Asosiasi</th><th class="r">Tanpa mitra</th><th class="r">Belum</th><th style="min-width:200px"></th></tr></thead><tbody>
      ${kk.map(g => `<tr><td><div class="small muted">${esc(g.sample.program)}</div>${esc(g.sample.konsentrasi)}</td><td class="r num">${fmt(g.jml_kk)}</td>${parts(g).map(p => `<td class="r num">${fmt(p.n)}</td>`).join('')}<td>${stackbar(parts(g))}</td></tr>`).join('')}</tbody></table></div></details>
  </div>`;
}

function tabMitra(body) {
  const tanpa = sum(sebaran, r => r.provinsi).filter(g => g.tanpa > 0).sort((a, b) => b.tanpa - a.tanpa);
  body.innerHTML = `<div class="stack">
    <div><h3>100 instansi mitra yang paling sering disebut</h3><p class="small muted">Nama disamakan huruf besarnya agar penulisan yang sama terhitung satu.</p>
    ${mitra.length ? `<div class="table-wrap"><table><thead><tr><th>Nama instansi</th><th>Jenis</th><th class="r">KK</th><th class="r">Sekolah</th><th class="r">Provinsi</th></tr></thead><tbody>
      ${mitra.map(g => `<tr><td>${esc(g.nama_instansi)}</td><td class="small">${esc(g.jenis_mitra_nama)}</td><td class="r num">${fmt(g.jml_kk)}</td><td class="r num">${fmt(g.jml_sekolah)}</td><td class="r num">${fmt(g.jml_provinsi)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada instansi mitra.</p>'}</div>
    <div><h3>KK yang UKK-nya tidak melibatkan instansi lain, per provinsi</h3>
    ${tanpa.length ? hbars(tanpa.map(g => ({ label: g.key, n: g.tanpa, color: 'var(--c-tanpa)' }))) : '<p class="muted">Tidak ada.</p>'}
    <p class="small muted">Daftar sekolahnya bisa dilihat di tab “Instansi mitra” saat menelusuri tiap provinsi.</p></div>
  </div>`;
}

async function detailSekolah(npsn) {
  const m = modal({ wide: true, title: 'Memuat…', body: '<div class="loading">Memuat…</div>' });
  try {
    const [s, rows] = await Promise.all([api.getSekolah(npsn), api.getKkSekolah(npsn)]);
    m.el.closest('.modal').querySelector('h2').textContent = s.nama;
    m.el.innerHTML = `<p class="muted small" style="margin-top:-6px">NPSN ${s.npsn} · ${esc(s.kab_kota)}, ${esc(s.provinsi)} · ${statusChip(s.status_pengisian)} · ${s.kk_terisi}/${s.jml_kk} KK terisi</p>
      <div class="table-wrap"><table><thead><tr><th>Konsentrasi keahlian</th><th>Metode UKK</th><th>Jenis mitra</th><th>Nama instansi</th><th>Diubah</th><th></th></tr></thead><tbody>
      ${rows.map(k => `<tr${k.dikecualikan ? ' style="opacity:.6"' : ''}><td><div class="small muted">${esc(k.program || '')}</div>${esc(k.konsentrasi)} ${k.dikecualikan ? '<span class="chip grey">Dilaporkan tidak ada</span>' : ''}</td>
        <td>${k.metode_nama ? esc(k.metode_nama) : (k.dikecualikan ? '–' : '<span class="chip bad">Belum diisi</span>')}</td><td>${esc(k.jenis_mitra_nama || '–')}</td><td>${esc(k.nama_instansi || '–')}</td>
        <td class="small">${fmtWaktu(k.diubah_pada)}</td><td><button class="btn small ghost" data-riw="${k.kk_id}">Riwayat</button></td></tr>`).join('')}</tbody></table></div>`;
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-riw]'); if (!b) return;
      bukaRiwayat(rows.find(x => x.kk_id === +b.dataset.riw), { npsn, canRestore: true });
    });
  } catch (e) { errorBox(m.el, e); }
}

async function unduhNasional() {
  const m = modal({ title: 'Unduh data nasional', body: `
    <p>Pilih isi file Excel:</p>
    <div class="stack">
      <button class="btn" id="u-rekap">Rekap per provinsi + sebaran metode (cepat)</button>
      <button class="btn primary" id="u-full">Data lengkap seluruh KK (±40 ribu baris, perlu beberapa saat)</button>
      <div id="u-msg" class="small muted"></div>
    </div>` });
  const sebaranRows = () => sebaran.map(r => ({ 'Provinsi': r.provinsi, 'Bidang Keahlian': r.bidang, 'Program Keahlian': r.program, 'Konsentrasi Keahlian': r.konsentrasi,
    'Jumlah KK': r.jml_kk, 'Bersama LSP': r.lsp, 'Bersama DU/Asosiasi': r.dudi, 'Tanpa Instansi Lain': r.tanpa, 'Belum Diisi': r.belum,
    'LSP-P1': r.lsp_p1, 'LSP-P2': r.lsp_p2, 'LSP-P3': r.lsp_p3, 'Dunia Kerja/Industri': r.industri, 'Asosiasi Profesi': r.asosiasi }));
  const rekapRows = () => rekap.map(r => ({ 'Provinsi': r.provinsi, 'Jumlah SMK': r.jml_sekolah, 'Lengkap': r.lengkap, 'Sebagian': r.sebagian, 'Belum Mengisi': r.belum, 'Jumlah KK': r.jml_kk, 'KK Terisi': r.kk_terisi }));
  m.el.querySelector('#u-rekap').addEventListener('click', async () => {
    try { await downloadXlsx('SI-UKK_Rekap_Nasional.xlsx', [{ name: 'Rekap Provinsi', rows: rekapRows() }, { name: 'Sebaran Metode', rows: sebaranRows() }, { name: 'Laporan KK', rows: laporanRows(laporan) }]); m.close(); }
    catch (e) { toast(e.message, true); }
  });
  m.el.querySelector('#u-full').addEventListener('click', async e => {
    e.target.disabled = true; const msg = m.el.querySelector('#u-msg');
    try {
      const rows = await api.getKkNasional(n => { msg.textContent = `Mengambil data… ${fmt(n)} baris`; });
      msg.textContent = 'Menyusun file Excel…';
      await downloadXlsx('SI-UKK_Data_Lengkap_Nasional.xlsx', [{ name: 'Rekap Provinsi', rows: rekapRows() }, { name: 'Isian per KK', rows: kkRowsForExport(rows) }, { name: 'Laporan KK', rows: laporanRows(laporan) }]);
      m.close();
    } catch (err) { msg.textContent = 'Gagal: ' + err.message; e.target.disabled = false; }
  });
}

start();
