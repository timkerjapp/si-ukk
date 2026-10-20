// Dashboard satu provinsi — dipakai Dashboard Dinas dan Direktorat (saat menelusuri provinsi)
import { api } from './api.js';
import { $, esc, fmt, fmtPct, fmtWaktu, statusChip, laporanChip, progress, stackbar, legendMetode, hbars, tabs,
  modal, toast, downloadXlsx, kkRowsForExport, sekolahRowsForExport, WARNA_METODE, errorBox, JENIS_LAPORAN } from './ui.js';
import { bukaRiwayat } from './riwayat.js';

export async function renderWilayah(root, provinsi, { isDirektorat = false, onBack = null } = {}) {
  root.innerHTML = `<div class="loading" id="w-load">Memuat data ${esc(provinsi)}…</div>`;
  let sekolah, kk, laporan;
  const st = { kab: '', status: '', cari: '', batas: 200 };

  async function load() {
    [sekolah, kk, laporan] = await Promise.all([
      api.getSekolahRekap(provinsi, n => { const l = $('#w-load', root); if (l) l.textContent = `Memuat data ${provinsi}… ${fmt(n)} sekolah`; }),
      api.getKkProvinsi(provinsi),
      api.getLaporan({ provinsi }),
    ]);
  }
  try { await load(); } catch (e) { return errorBox(root, e); }

  function metodeParts(rows) {
    const a = rows.filter(r => !r.dikecualikan);
    return [
      { label: 'Bersama LSP', n: a.filter(r => r.metode === 'LSP').length, color: WARNA_METODE.LSP },
      { label: 'Bersama dunia kerja/asosiasi profesi', n: a.filter(r => r.metode === 'DUDI').length, color: WARNA_METODE.DUDI },
      { label: 'Tidak melibatkan instansi lain', n: a.filter(r => r.metode === 'TANPA').length, color: WARNA_METODE.TANPA },
      { label: 'Belum diisi', n: a.filter(r => !r.metode).length, color: WARNA_METODE.BELUM },
    ];
  }

  function render() {
    const jml = sekolah.length;
    const c = s => sekolah.filter(x => x.status_pengisian === s).length;
    const jmlKK = sekolah.reduce((a, s) => a + s.jml_kk, 0), terisi = sekolah.reduce((a, s) => a + s.kk_terisi, 0);
    const lapBaru = laporan.filter(l => l.status === 'baru').length;
    root.innerHTML = `<div class="stack">
      <div class="row" style="justify-content:space-between">
        <div>${onBack ? `<button class="btn small" id="w-back">← Semua provinsi</button> ` : ''}<h1 style="display:inline-block;margin-left:${onBack ? '8px' : 0}">Provinsi ${esc(provinsi)}</h1></div>
        <div class="row"><button class="btn" id="w-refresh">Muat ulang</button><button class="btn primary" id="w-unduh">Unduh Excel</button></div>
      </div>
      <div class="grid-stats">
        <div class="stat"><div class="label">Jumlah SMK</div><div class="value">${fmt(jml)}</div><div class="sub">${fmt(jmlKK)} KK wajib diisi</div></div>
        <div class="stat"><div class="label">Lengkap</div><div class="value" style="color:var(--ok)">${fmt(c('Lengkap'))}</div><div class="sub">${fmtPct(c('Lengkap'), jml)} sekolah</div></div>
        <div class="stat"><div class="label">Sebagian</div><div class="value" style="color:var(--warn)">${fmt(c('Sebagian'))}</div><div class="sub">${fmtPct(c('Sebagian'), jml)} sekolah</div></div>
        <div class="stat"><div class="label">Belum mengisi</div><div class="value" style="color:var(--bad)">${fmt(c('Belum mengisi'))}</div><div class="sub">${fmtPct(c('Belum mengisi'), jml)} sekolah</div></div>
        <div class="stat"><div class="label">KK terisi</div><div class="value">${fmtPct(terisi, jmlKK)}</div><div class="sub">${fmt(terisi)} dari ${fmt(jmlKK)} KK</div></div>
      </div>
      <div class="card" id="w-tabs"></div>
    </div>`;
    $('#w-back', root)?.addEventListener('click', onBack);
    $('#w-refresh', root).addEventListener('click', async () => { root.querySelector('#w-tabs').innerHTML = '<div class="loading">Memuat ulang…</div>'; await load(); render(); });
    $('#w-unduh', root).addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        await downloadXlsx(`SI-UKK_${provinsi.replace(/\W+/g, '_')}.xlsx`, [
          { name: 'Rekap Kab-Kota', rows: rekapKab().map(r => ({ 'Kab/Kota': r.kab, 'Jumlah SMK': r.jml, 'Lengkap': r.lengkap, 'Sebagian': r.sebagian, 'Belum Mengisi': r.belum, 'Jumlah KK': r.kk, 'KK Terisi': r.terisi })) },
          { name: 'Rekap Sekolah', rows: sekolahRowsForExport(sekolah) },
          { name: 'Isian per KK', rows: kkRowsForExport(kk) },
          { name: 'Laporan KK', rows: laporanRows(laporan) },
        ]);
      } catch (err) { toast('Gagal mengunduh: ' + err.message, true); }
      e.target.disabled = false;
    });
    tabs($('#w-tabs', root), [
      { key: 'kab', label: 'Per kab/kota' }, { key: 'sekolah', label: 'Per sekolah' },
      { key: 'sebaran', label: 'Sebaran metode' }, { key: 'mitra', label: 'Instansi mitra' },
      { key: 'laporan', label: `Laporan KK${lapBaru ? ` (${lapBaru} baru)` : ''}` },
    ], (k, body) => ({ kab: tabKab, sekolah: tabSekolah, sebaran: tabSebaran, mitra: tabMitra, laporan: tabLaporan })[k](body));
  }

  function rekapKab() {
    const m = new Map();
    for (const s of sekolah) {
      const g = m.get(s.kab_kota) || { kab: s.kab_kota, jml: 0, lengkap: 0, sebagian: 0, belum: 0, kk: 0, terisi: 0 };
      g.jml++; g.kk += s.jml_kk; g.terisi += s.kk_terisi;
      if (s.status_pengisian === 'Lengkap') g.lengkap++; else if (s.status_pengisian === 'Sebagian') g.sebagian++; else if (s.status_pengisian === 'Belum mengisi') g.belum++;
      m.set(s.kab_kota, g);
    }
    return [...m.values()].sort((a, b) => a.kab.localeCompare(b.kab));
  }

  function tabKab(body) {
    const rows = rekapKab();
    body.innerHTML = `<p class="muted small">Klik baris untuk melihat daftar sekolah di kab/kota tersebut.</p>
    <div class="table-wrap"><table><thead><tr><th>Kab/Kota</th><th class="r">SMK</th><th class="r">Lengkap</th><th class="r">Sebagian</th><th class="r">Belum</th><th style="min-width:180px">Sekolah lengkap</th><th style="min-width:180px">KK terisi</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="click" data-kab="${esc(r.kab)}"><td>${esc(r.kab)}</td><td class="r num">${fmt(r.jml)}</td><td class="r num">${fmt(r.lengkap)}</td><td class="r num">${fmt(r.sebagian)}</td><td class="r num">${fmt(r.belum)}</td><td>${progress(r.lengkap, r.jml)}</td><td>${progress(r.terisi, r.kk)}</td></tr>`).join('')}
    </tbody></table></div>`;
    body.querySelector('tbody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-kab]'); if (!tr) return;
      st.kab = tr.dataset.kab; st.batas = 200;
      root.querySelector('.tabs button[data-k=sekolah]').click();
    });
  }

  function tabSekolah(body) {
    const kabs = [...new Set(sekolah.map(s => s.kab_kota))].sort();
    body.innerHTML = `<div class="row" style="margin-bottom:12px">
      <div style="flex:1;min-width:180px"><label>Kab/Kota</label><select id="f-kab"><option value="">Semua</option>${kabs.map(k => `<option ${k === st.kab ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div style="flex:1;min-width:160px"><label>Status pengisian</label><select id="f-st"><option value="">Semua</option>${['Belum mengisi', 'Sebagian', 'Lengkap', 'Tidak ada KK'].map(s => `<option ${s === st.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div style="flex:2;min-width:200px"><label>Cari nama / NPSN</label><input id="f-cari" type="search" value="${esc(st.cari)}" placeholder="Ketik nama sekolah atau NPSN"></div>
    </div><div id="s-tabel"></div>`;
    const draw = () => {
      const q = st.cari.toLowerCase();
      const rows = sekolah.filter(s => (!st.kab || s.kab_kota === st.kab) && (!st.status || s.status_pengisian === st.status)
        && (!q || s.nama.toLowerCase().includes(q) || s.npsn.includes(q))).sort((a, b) => a.kab_kota.localeCompare(b.kab_kota) || a.nama.localeCompare(b.nama));
      const shown = rows.slice(0, st.batas);
      $('#s-tabel', body).innerHTML = `<p class="muted small">${fmt(rows.length)} sekolah. Klik baris untuk melihat isian sekolah.</p>
      <div class="table-wrap"><table><thead><tr><th>NPSN</th><th>Nama sekolah</th><th>Kab/Kota</th><th>Status</th><th class="r">KK terisi</th><th>Pengisian</th><th>Terakhir diubah</th></tr></thead><tbody>
      ${shown.map(s => `<tr class="click" data-npsn="${s.npsn}"><td class="num">${s.npsn}</td><td>${esc(s.nama)}</td><td class="small">${esc(s.kab_kota)}</td><td class="small">${esc(s.status || '')}</td><td class="r num">${s.kk_terisi}/${s.jml_kk}</td><td>${statusChip(s.status_pengisian)}</td><td class="small">${fmtWaktu(s.terakhir_diubah)}</td></tr>`).join('')}
      </tbody></table></div>
      ${rows.length > shown.length ? `<div style="text-align:center;margin-top:12px"><button class="btn" id="s-more">Tampilkan lebih banyak (${fmt(rows.length - shown.length)} lagi)</button></div>` : ''}`;
      $('#s-more', body)?.addEventListener('click', () => { st.batas += 300; draw(); });
    };
    $('#f-kab', body).addEventListener('change', e => { st.kab = e.target.value; st.batas = 200; draw(); });
    $('#f-st', body).addEventListener('change', e => { st.status = e.target.value; st.batas = 200; draw(); });
    $('#f-cari', body).addEventListener('input', e => { st.cari = e.target.value.trim(); st.batas = 200; draw(); });
    body.addEventListener('click', e => { const tr = e.target.closest('tr[data-npsn]'); if (tr) detailSekolah(tr.dataset.npsn); });
    draw();
  }

  function detailSekolah(npsn) {
    const s = sekolah.find(x => x.npsn === npsn);
    const rows = kk.filter(k => k.npsn === npsn).sort((a, b) => (a.program || '').localeCompare(b.program || '') || a.konsentrasi.localeCompare(b.konsentrasi));
    const lap = laporan.filter(l => l.npsn === npsn && l.status !== 'dibatalkan');
    const m = modal({ wide: true, title: s.nama, body: `
      <p class="muted small" style="margin-top:-6px">NPSN ${s.npsn} · ${esc(s.status || '')} · ${esc(s.kecamatan || '')}, ${esc(s.kab_kota)} · ${statusChip(s.status_pengisian)} · ${s.kk_terisi}/${s.jml_kk} KK terisi</p>
      <div class="table-wrap"><table><thead><tr><th>Program / Konsentrasi keahlian</th><th class="r">XII</th><th class="r">XIII</th><th>Metode UKK</th><th>Jenis mitra</th><th>Nama instansi</th><th>Diubah</th><th></th></tr></thead><tbody>
      ${rows.map(k => `<tr${k.dikecualikan ? ' style="opacity:.6"' : ''}><td><div class="small muted">${esc(k.program || '')}</div>${esc(k.konsentrasi)} ${k.kurikulum === 'K13' ? '<span class="chip grey">K13</span>' : ''} ${k.sumber === 'tambahan' ? '<span class="chip info">Tambahan</span>' : ''} ${k.dikecualikan ? '<span class="chip grey">Dilaporkan tidak ada</span>' : ''}</td>
        <td class="r num">${fmt(k.siswa_xii)}</td><td class="r num">${fmt(k.siswa_xiii)}</td>
        <td>${k.metode_nama ? esc(k.metode_nama) : (k.dikecualikan ? '–' : '<span class="chip bad">Belum diisi</span>')}</td>
        <td>${esc(k.jenis_mitra_nama || '–')}</td><td>${esc(k.nama_instansi || '–')}</td><td class="small">${fmtWaktu(k.diubah_pada)}</td>
        <td><button class="btn small ghost" data-riw="${k.kk_id}">Riwayat</button></td></tr>`).join('')}
      </tbody></table></div>
      ${lap.length ? `<h3 style="margin-top:16px">Laporan ketidaksesuaian KK</h3><ul>${lap.map(l => `<li class="small">${fmtWaktu(l.dibuat_pada)} — ${esc(JENIS_LAPORAN[l.jenis])}${l.konsentrasi ? ': ' + esc(l.konsentrasi) : ''}${l.keterangan ? ' — “' + esc(l.keterangan) + '”' : ''} ${laporanChip(l.status)}</li>`).join('')}</ul>` : ''}
      <p class="small muted" style="margin-top:12px">${isDirektorat ? 'Direktorat dapat memulihkan isian dari jendela Riwayat.' : 'Dinas Pendidikan hanya dapat melihat data.'}</p>` });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-riw]'); if (!b) return;
      const k = rows.find(x => x.kk_id === +b.dataset.riw);
      bukaRiwayat(k, { npsn, canRestore: isDirektorat, onRestored: async () => { await load(); } });
    });
  }

  function tabSebaran(body) {
    const aktif = kk.filter(r => !r.dikecualikan);
    const jenis = [['LSP-P1', 'LSP-P1'], ['LSP-P2', 'LSP-P2'], ['LSP-P3', 'LSP-P3'], ['INDUSTRI', 'Dunia Kerja/Industri'], ['ASOSIASI', 'Asosiasi Profesi']]
      .map(([k, l]) => ({ label: l, n: aktif.filter(r => r.jenis_mitra === k).length, color: k.startsWith('LSP') ? 'var(--c-lsp)' : 'var(--c-dudi)' }));
    const byKK = new Map();
    for (const r of aktif) { const key = r.program + '|' + r.konsentrasi; if (!byKK.has(key)) byKK.set(key, []); byKK.get(key).push(r); }
    const kkRows = [...byKK.values()].map(l => ({ program: l[0].program, konsentrasi: l[0].konsentrasi, parts: metodeParts(l), n: l.length }))
      .sort((a, b) => b.n - a.n);
    const byKab = new Map();
    for (const r of aktif) { if (!byKab.has(r.kab_kota)) byKab.set(r.kab_kota, []); byKab.get(r.kab_kota).push(r); }
    body.innerHTML = `<div class="stack">
      <div><h3>Seluruh KK di provinsi ini (${fmt(aktif.length)} KK)</h3>${stackbar(metodeParts(aktif))}<div style="margin-top:8px">${legendMetode()}</div>
        <div class="row small" style="margin-top:6px;gap:18px">${metodeParts(aktif).map(p => `<span>${esc(p.label)}: <b class="num">${fmt(p.n)}</b> (${fmtPct(p.n, aktif.length)})</span>`).join('')}</div></div>
      <div><h3>Jenis instansi mitra</h3>${hbars(jenis)}</div>
      <div><h3>Per kab/kota</h3><div class="table-wrap"><table><thead><tr><th>Kab/Kota</th><th class="r">KK</th><th style="min-width:260px">Sebaran metode</th></tr></thead><tbody>
        ${[...byKab].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => `<tr><td>${esc(k)}</td><td class="r num">${fmt(l.length)}</td><td>${stackbar(metodeParts(l))}</td></tr>`).join('')}</tbody></table></div></div>
      <details><summary style="cursor:pointer"><h3 style="display:inline">Per konsentrasi keahlian</h3> <span class="small muted">(klik untuk membuka)</span></summary><div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Konsentrasi keahlian</th><th class="r">KK</th><th class="r">LSP</th><th class="r">DU/Asosiasi</th><th class="r">Tanpa mitra</th><th class="r">Belum</th><th style="min-width:200px"></th></tr></thead><tbody>
        ${kkRows.map(r => `<tr><td><div class="small muted">${esc(r.program)}</div>${esc(r.konsentrasi)}</td><td class="r num">${fmt(r.n)}</td>${r.parts.map(p => `<td class="r num">${fmt(p.n)}</td>`).join('')}<td>${stackbar(r.parts)}</td></tr>`).join('')}</tbody></table></div></details>
    </div>`;
  }

  function tabMitra(body) {
    const m = new Map();
    for (const r of kk) {
      if (!r.nama_instansi || r.dikecualikan) continue;
      const nama = r.nama_instansi.replace(/\s+/g, ' ').trim().toUpperCase();
      const key = r.jenis_mitra + '|' + nama;
      const g = m.get(key) || { jenis: r.jenis_mitra_nama, nama, kk: 0, sek: new Set() };
      g.kk++; g.sek.add(r.npsn); m.set(key, g);
    }
    const all = [...m.values()].sort((a, b) => b.kk - a.kk);
    const tanpa = kk.filter(r => r.metode === 'TANPA' && !r.dikecualikan);
    body.innerHTML = `<div class="stack">
      <div class="row"><div style="flex:1;min-width:200px"><label>Cari instansi</label><input type="search" id="m-cari" placeholder="Ketik nama instansi"></div>
      <div class="small muted" style="flex:2">${fmt(all.length)} instansi mitra berbeda. Nama disamakan huruf besarnya agar penulisan yang sama terhitung satu.</div></div>
      <div id="m-tabel"></div>
      <div><h3>KK yang UKK-nya tidak melibatkan instansi lain (${fmt(tanpa.length)})</h3>
      ${tanpa.length ? `<div class="table-wrap"><table><thead><tr><th>Sekolah</th><th>Kab/Kota</th><th>Konsentrasi keahlian</th></tr></thead><tbody>${tanpa.slice(0, 500).map(r => `<tr><td>${esc(r.nama_sekolah)}</td><td class="small">${esc(r.kab_kota)}</td><td>${esc(r.konsentrasi)}</td></tr>`).join('')}</tbody></table></div>${tanpa.length > 500 ? '<p class="small muted">Menampilkan 500 pertama; daftar lengkap ada di file Excel.</p>' : ''}` : '<p class="muted">Tidak ada.</p>'}</div>
    </div>`;
    const draw = q => {
      const rows = all.filter(g => !q || g.nama.includes(q.toUpperCase())).slice(0, 200);
      $('#m-tabel', body).innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Nama instansi</th><th>Jenis</th><th class="r">KK</th><th class="r">Sekolah</th></tr></thead><tbody>
        ${rows.map(g => `<tr><td>${esc(g.nama)}</td><td class="small">${esc(g.jenis)}</td><td class="r num">${fmt(g.kk)}</td><td class="r num">${fmt(g.sek.size)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada instansi mitra.</p>';
    };
    $('#m-cari', body).addEventListener('input', e => draw(e.target.value.trim()));
    draw('');
  }

  function tabLaporan(body) { renderLaporanTable(body, laporan, { isDirektorat, onChanged: async () => { laporan = await api.getLaporan({ provinsi }); } }); }

  render();
}

export function laporanRows(list) {
  return list.map(l => ({ 'Tanggal': fmtWaktu(l.dibuat_pada), 'Provinsi': l.provinsi, 'Kab/Kota': l.kab_kota, 'NPSN': l.npsn,
    'Nama Sekolah': l.nama_sekolah, 'Jenis Laporan': JENIS_LAPORAN[l.jenis], 'Konsentrasi Keahlian': l.konsentrasi || '',
    'Keterangan': l.keterangan || '', 'Status': l.status, 'Catatan Direktorat': l.catatan_direktorat || '' }));
}

export function renderLaporanTable(body, laporan, { isDirektorat = false, showProv = false, onChanged } = {}) {
  let filt = 'baru';
  const draw = () => {
    const rows = laporan.filter(l => filt === 'semua' || l.status === filt);
    body.innerHTML = `<div class="row" style="margin-bottom:12px"><div style="min-width:200px"><label>Status laporan</label>
      <select id="l-st">${[['baru', 'Baru'], ['ditindaklanjuti', 'Ditindaklanjuti'], ['ditolak', 'Ditolak'], ['dibatalkan', 'Dibatalkan sekolah'], ['semua', 'Semua']]
        .map(([v, t]) => `<option value="${v}" ${v === filt ? 'selected' : ''}>${t} (${v === 'semua' ? laporan.length : laporan.filter(l => l.status === v).length})</option>`).join('')}</select></div>
      <p class="small muted" style="flex:1">${isDirektorat ? 'Tandai laporan setelah data Dapodik diperiksa. Menolak laporan “KK tidak ada” mengembalikan KK ke daftar wajib isi; menolak “KK belum tercatat” menyembunyikan KK tambahan.' : 'Laporan ditindaklanjuti oleh Direktorat SMK. Perbaikan permanen dilakukan sekolah di Dapodik.'}</p></div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Tanggal</th>${showProv ? '<th>Provinsi</th>' : ''}<th>Sekolah</th><th>Jenis</th><th>KK</th><th>Keterangan</th><th>Status</th>${isDirektorat ? '<th style="min-width:230px">Tindak lanjut</th>' : ''}</tr></thead><tbody>
      ${rows.map(l => `<tr><td class="small">${fmtWaktu(l.dibuat_pada)}</td>${showProv ? `<td class="small">${esc(l.provinsi)}</td>` : ''}<td>${esc(l.nama_sekolah)}<div class="small muted">${l.npsn} · ${esc(l.kab_kota)}</div></td>
        <td class="small">${esc(JENIS_LAPORAN[l.jenis])}</td><td>${esc(l.konsentrasi || '–')}</td><td class="small">${esc(l.keterangan || '')}${l.catatan_direktorat ? `<div class="muted">Catatan: ${esc(l.catatan_direktorat)}</div>` : ''}</td><td>${laporanChip(l.status)}</td>
        ${isDirektorat ? `<td>${l.status === 'dibatalkan' ? '–' : `<div class="stack" style="gap:6px"><select data-tl-st="${l.id}">${[['baru', 'Baru'], ['ditindaklanjuti', 'Ditindaklanjuti'], ['ditolak', 'Ditolak']].map(([v, t]) => `<option value="${v}" ${v === l.status ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <input type="text" data-tl-cat="${l.id}" placeholder="Catatan (opsional)" value="${esc(l.catatan_direktorat || '')}"><button class="btn small primary" data-tl="${l.id}">Simpan</button></div>`}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Tidak ada laporan dengan status ini.</p>'}`;
    body.querySelector('#l-st').addEventListener('change', e => { filt = e.target.value; draw(); });
  };
  body.onclick = async e => {
    const b = e.target.closest('[data-tl]'); if (!b) return;
    const id = +b.dataset.tl; b.disabled = true;
    try {
      const updated = await api.tindakLanjut(id, body.querySelector(`[data-tl-st="${id}"]`).value, body.querySelector(`[data-tl-cat="${id}"]`).value);
      const i = laporan.findIndex(l => l.id === id); if (i >= 0) laporan[i] = { ...laporan[i], ...updated };
      toast('Status laporan disimpan'); onChanged && onChanged(); draw();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  };
  draw();
}
