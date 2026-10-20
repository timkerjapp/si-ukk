import { api } from './api.js';
import { $, $$, esc, fmt, fmtWaktu, header, statusChip, laporanChip, progress, toast, modal, qs, errorBox, JENIS_LAPORAN } from './ui.js';
import { bukaRiwayat } from './riwayat.js';

const npsn = (qs('npsn') || '').replace(/\D/g, '');
const app = $('#app');
let ref, sekolah, kks = [], laporan = [];

$('#top').innerHTML = header({ subtitle: 'Dashboard SMK — pengisian metode UKK', right: `<a href="../index.html">Keluar</a>` });

async function load() {
  try {
    if (!npsn) { app.innerHTML = `<div class="alert bad">NPSN tidak ada. <a href="../index.html">Kembali ke halaman masuk</a>.</div>`; return; }
    [ref, sekolah, kks, laporan] = await Promise.all([api.getRef(), api.getSekolah(npsn), api.getKkSekolah(npsn), api.getLaporan({ npsn })]);
    if (!sekolah) { app.innerHTML = `<div class="alert bad">NPSN ${esc(npsn)} tidak ditemukan. <a href="../index.html">Kembali</a>.</div>`; return; }
    render();
  } catch (e) { errorBox(app, e); }
}

function jenisOptions(metode, selected) {
  const list = ref.jenis.filter(j => j.metode_kode === metode);
  return `<option value="">— Pilih jenis mitra —</option>` + list.map(j => `<option value="${j.kode}" ${j.kode === selected ? 'selected' : ''}>${esc(j.nama)}</option>`).join('');
}

function kkCard(k) {
  const badges = [
    k.kurikulum === 'K13' ? `<span class="chip grey" title="Siswa kelas XII/XIII masih tercatat di Kurikulum 2013">K13</span>` : '',
    k.sumber === 'tambahan' ? `<span class="chip info">Tambahan sekolah</span>` : '',
  ].join(' ');
  const siswa = `Siswa kelas XII: <b class="num">${fmt(k.siswa_xii)}</b>${k.siswa_xiii ? ` · kelas XIII: <b class="num">${fmt(k.siswa_xiii)}</b>` : ''}`;
  if (k.dikecualikan) {
    const lap = laporan.find(l => l.kk_id === k.kk_id && l.jenis === 'TIDAK_ADA' && l.status !== 'dibatalkan');
    return `<div class="kk excluded" data-kk="${k.kk_id}">
      <div class="kk-head"><div><div class="kk-title">${esc(k.konsentrasi)} ${badges}</div><div class="small muted">${siswa}</div></div>
      <span class="chip grey">Dilaporkan tidak ada</span></div>
      <p class="small muted" style="margin:8px 0 0">KK ini tidak dihitung dalam pengisian.${lap?.keterangan ? ' Keterangan: ' + esc(lap.keterangan) : ''}</p>
      ${lap && lap.status === 'baru' ? `<div class="kk-actions"><button class="btn small" data-batal="${lap.id}">Batalkan laporan</button></div>` : ''}
    </div>`;
  }
  const m = k.metode || '';
  const tanpa = m === 'TANPA' || !m;
  return `<div class="kk" data-kk="${k.kk_id}">
    <div class="kk-head">
      <div><div class="kk-title">${esc(k.konsentrasi)} ${badges}</div><div class="small muted">${siswa}</div></div>
      <div>${k.terisi ? `<span class="chip ok">Sudah diisi</span> <span class="small muted">${fmtWaktu(k.diubah_pada)}</span>` : `<span class="chip bad">Belum diisi</span>`}</div>
    </div>
    <form class="kk-form" data-form="${k.kk_id}">
      <div><label>Metode UKK</label>
        <select name="metode" required>
          <option value="">— Pilih metode UKK —</option>
          ${ref.metode.map(x => `<option value="${x.kode}" ${x.kode === m ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}
        </select></div>
      <div><label>Jenis mitra</label>
        <select name="jenis" ${tanpa ? 'disabled' : ''}>${m && m !== 'TANPA' ? jenisOptions(m, k.jenis_mitra) : '<option value="">–</option>'}</select></div>
      <div><label>Nama instansi mitra</label>
        <input name="nama" type="text" maxlength="200" value="${esc(k.nama_instansi || '')}" ${tanpa ? 'disabled' : ''} placeholder="${m === 'TANPA' ? 'Tidak perlu diisi' : m === 'LSP' ? 'contoh: LSP P1 SMKN 1 …' : m ? 'contoh: PT … / Asosiasi …' : 'Pilih metode UKK dulu'}"></div>
      <div><button class="btn primary" type="submit">Simpan</button></div>
    </form>
    <div class="kk-actions">
      <button class="btn small ghost" data-riwayat="${k.kk_id}">Riwayat perubahan</button>
      <button class="btn small ghost" data-lapor-tidak="${k.kk_id}">Laporkan KK ini tidak ada</button>
    </div>
  </div>`;
}

function render() {
  const s = sekolah;
  const groups = new Map();
  for (const k of kks) { const g = k.program || 'Lainnya'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k); }
  const lapAktif = laporan.filter(l => l.status !== 'dibatalkan');
  app.innerHTML = `
  <div class="stack">
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h1>${esc(s.nama)}</h1>
          <div class="muted small">NPSN ${esc(s.npsn)} · ${esc(s.status || '')} · ${esc(s.kecamatan || '')}, ${esc(s.kab_kota)}, ${esc(s.provinsi)}</div></div>
        <div>${statusChip(s.status_pengisian)}</div>
      </div>
      <div style="margin-top:12px"><div class="small muted" style="margin-bottom:4px"><b class="num">${s.kk_terisi}</b> dari <b class="num">${s.jml_kk}</b> konsentrasi keahlian sudah diisi</div>${progress(s.kk_terisi, s.jml_kk)}</div>
    </div>
    <div class="alert info small">
      Isi <b>metode UKK</b> dan <b>instansi mitra</b> untuk setiap konsentrasi keahlian (KK) di bawah, lalu tekan <b>Simpan</b> pada KK tersebut.
      Daftar KK diambil dari Dapodik (KK dengan siswa kelas XII/XIII). Isian bisa diubah kapan saja dan setiap perubahan tercatat di riwayat.
      Bila daftar KK tidak sesuai kenyataan, gunakan tombol <b>Laporkan ketidaksesuaian KK</b>.
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="btn-lapor">Laporkan ketidaksesuaian KK</button></div>
    <div id="kk-list">${kks.length ? [...groups].map(([g, list]) => `<div class="program-head">${esc(g)}</div><div class="stack">${list.map(kkCard).join('')}</div>`).join('') : '<div class="alert warn">Belum ada KK tercatat untuk sekolah ini. Gunakan “Laporkan ketidaksesuaian KK” untuk menambahkan KK.</div>'}</div>
    ${lapAktif.length ? `<div class="card"><h2>Laporan ketidaksesuaian dari sekolah ini</h2>
      <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>KK</th><th>Keterangan</th><th>Status</th><th></th></tr></thead><tbody>
      ${lapAktif.map(l => `<tr><td class="small">${fmtWaktu(l.dibuat_pada)}</td><td>${esc(JENIS_LAPORAN[l.jenis])}</td><td>${esc(l.konsentrasi || '–')}</td>
        <td class="small">${esc(l.keterangan || '')}${l.catatan_direktorat ? `<div class="muted">Catatan Direktorat: ${esc(l.catatan_direktorat)}</div>` : ''}</td>
        <td>${laporanChip(l.status)}</td><td>${l.status === 'baru' ? `<button class="btn small" data-batal="${l.id}">Batalkan</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
  </div>`;
}

async function refresh() {
  [sekolah, kks, laporan] = await Promise.all([api.getSekolah(npsn), api.getKkSekolah(npsn), api.getLaporan({ npsn })]);
  render();
}

// Metode berubah → atur isian jenis & nama
app.addEventListener('change', e => {
  const f = e.target.closest('form[data-form]'); if (!f || e.target.name !== 'metode') return;
  const m = e.target.value, jenis = f.elements.jenis, nama = f.elements.nama;
  if (!m || m === 'TANPA') {
    jenis.innerHTML = '<option value="">–</option>'; jenis.disabled = true;
    nama.value = ''; nama.disabled = true; nama.placeholder = m === 'TANPA' ? 'Tidak perlu diisi' : 'Pilih metode UKK dulu';
  } else {
    jenis.innerHTML = jenisOptions(m, ''); jenis.disabled = false;
    nama.disabled = false; nama.placeholder = m === 'LSP' ? 'contoh: LSP P1 SMKN 1 …' : 'contoh: PT … / Asosiasi …';
  }
});

app.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const id = +f.dataset.form, m = f.elements.metode.value, j = f.elements.jenis.value, n = f.elements.nama.value;
  if (!m) return toast('Pilih metode UKK dulu', true);
  if (m !== 'TANPA' && !j) return toast('Pilih jenis mitra', true);
  if (m !== 'TANPA' && !n.trim()) return toast('Isi nama instansi mitra', true);
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Menyimpan…';
  try { await api.simpanIsian(npsn, id, m, j, n); toast('Tersimpan'); await refresh(); }
  catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Simpan'; }
});

app.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.riwayat) {
    const k = kks.find(x => x.kk_id === +t.dataset.riwayat);
    bukaRiwayat(k, { npsn, canRestore: true, onRestored: refresh });
  } else if (t.dataset.laporTidak) {
    formLapor('TIDAK_ADA', +t.dataset.laporTidak);
  } else if (t.id === 'btn-lapor') {
    formLapor();
  } else if (t.dataset.batal) {
    t.disabled = true;
    try { await api.batalkanLaporan(npsn, +t.dataset.batal); toast('Laporan dibatalkan'); await refresh(); }
    catch (err) { toast(err.message, true); t.disabled = false; }
  }
});

function formLapor(jenis = 'TIDAK_ADA', kkId = null) {
  const aktif = kks.filter(k => !k.dikecualikan);
  const sudah = new Set(kks.filter(k => !k.dikecualikan).map(k => k.konsentrasi));
  const opsiKK = ref.konsentrasi.filter(r => !sudah.has(r.konsentrasi));
  const byProg = new Map(); for (const r of opsiKK) { const g = r.program; if (!byProg.has(g)) byProg.set(g, []); byProg.get(g).push(r); }
  const m = modal({ title: 'Laporkan ketidaksesuaian KK', body: `
    <form id="f-lapor" class="stack">
      <fieldset style="border:0;padding:0;margin:0" class="stack">
        <label style="display:flex;gap:8px;color:var(--text)"><input type="radio" name="jenis" value="TIDAK_ADA" ${jenis === 'TIDAK_ADA' ? 'checked' : ''}> KK tercatat, tetapi tidak ada / tidak melaksanakan UKK tahun ini</label>
        <label style="display:flex;gap:8px;color:var(--text)"><input type="radio" name="jenis" value="BELUM_TERCATAT" ${jenis === 'BELUM_TERCATAT' ? 'checked' : ''}> KK ada di sekolah, tetapi belum tercatat</label>
        <label style="display:flex;gap:8px;color:var(--text)"><input type="radio" name="jenis" value="LAINNYA" ${jenis === 'LAINNYA' ? 'checked' : ''}> Data lain keliru (nama KK, jumlah siswa, dll.)</label>
      </fieldset>
      <div data-show="TIDAK_ADA LAINNYA"><label>Konsentrasi keahlian</label>
        <select name="kk"><option value="">— Pilih KK —</option>${aktif.map(k => `<option value="${k.kk_id}" ${k.kk_id === kkId ? 'selected' : ''}>${esc(k.konsentrasi)}</option>`).join('')}</select></div>
      <div data-show="BELUM_TERCATAT"><label>Konsentrasi keahlian yang belum tercatat</label>
        <select name="konsentrasi"><option value="">— Pilih dari daftar KK Kurikulum Merdeka —</option>
          ${[...byProg].map(([p, l]) => `<optgroup label="${esc(p)}">${l.map(r => `<option>${esc(r.konsentrasi)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div data-show="BELUM_TERCATAT" class="row" style="flex-wrap:nowrap">
        <div style="flex:1"><label>Jumlah siswa kelas XII</label><input name="xii" type="number" min="0" value="0"></div>
        <div style="flex:1"><label>Jumlah siswa kelas XIII</label><input name="xiii" type="number" min="0" value="0"></div></div>
      <div><label>Keterangan <span data-ket-wajib>(wajib untuk “Data lain keliru”)</span></label><textarea name="ket" rows="3" maxlength="500"></textarea></div>
      <div id="lapor-msg"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Batal</button><button class="btn primary" type="submit">Kirim laporan</button></div>
    </form>` });
  const f = m.el.querySelector('#f-lapor');
  const sync = () => {
    const j = f.elements.jenis.value;
    $$('[data-show]', f).forEach(d => d.classList.toggle('hidden', !d.dataset.show.split(' ').includes(j)));
  };
  f.addEventListener('change', sync); sync();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const j = f.elements.jenis.value;
    const d = { jenis: j, kkId: +f.elements.kk.value || null, konsentrasi: f.elements.konsentrasi.value,
      siswaXii: +f.elements.xii.value || 0, siswaXiii: +f.elements.xiii.value || 0, keterangan: f.elements.ket.value };
    if (j === 'TIDAK_ADA' && !d.kkId) return toast('Pilih KK yang dilaporkan', true);
    if (j === 'BELUM_TERCATAT' && !d.konsentrasi) return toast('Pilih KK yang belum tercatat', true);
    try { await api.lapor(npsn, d); m.close(); toast('Laporan terkirim'); await refresh(); }
    catch (err) { m.el.querySelector('#lapor-msg').innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
  });
}

load();
