import { api, isDemo } from './api.js';
import { CONFIG } from './config.js';
import { $, $$, esc, statusChip } from './ui.js';

if (isDemo) $('#banner').innerHTML = `<div class="demo-banner">Mode demo — contoh NPSN: 20603307 (Banten). Direktorat: email bebas, kata sandi <b>demo</b>.</div>`;
$('#footer').textContent = `${CONFIG.INSTANSI} · ${CONFIG.SUMBER_DATA}`;

// Pilih peran
$('.role-tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-role]'); if (!b) return;
  $$('.role-tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  ['smk', 'dinas', 'dir'].forEach(r => $('#f-' + r).classList.toggle('hidden', r !== b.dataset.role));
});

// SMK: cari NPSN → konfirmasi nama sekolah → masuk
let ditemukan = null;
$('#npsn').addEventListener('input', () => { ditemukan = null; $('#smk-konfirmasi').innerHTML = ''; $('#btn-smk').textContent = 'Cari sekolah'; });
$('#f-smk').addEventListener('submit', async e => {
  e.preventDefault();
  const npsn = $('#npsn').value.replace(/\D/g, '');
  if (ditemukan && ditemukan.npsn === npsn) { location.href = 'smk/index.html?npsn=' + encodeURIComponent(npsn); return; }
  const box = $('#smk-konfirmasi');
  if (npsn.length !== 8) { box.innerHTML = `<div class="alert bad">NPSN terdiri dari 8 angka.</div>`; return; }
  box.innerHTML = `<div class="muted small">Mencari…</div>`;
  try {
    const s = await api.getSekolah(npsn);
    if (!s) {
      box.innerHTML = `<div class="alert bad">NPSN ${esc(npsn)} tidak ditemukan. Sistem hanya memuat SMK yang memiliki siswa kelas XII/XIII di Dapodik. Hubungi Dinas Pendidikan bila sekolah Anda belum terdaftar.</div>`;
      return;
    }
    ditemukan = s;
    box.innerHTML = `<div class="alert info"><b>${esc(s.nama)}</b><br><span class="small">${esc(s.kab_kota)}, ${esc(s.provinsi)} · ${s.jml_kk} KK · ${statusChip(s.status_pengisian)}</span><br><span class="small">Benar sekolah Anda? Tekan tombol di bawah untuk masuk.</span></div>`;
    $('#btn-smk').textContent = 'Masuk sebagai sekolah ini';
  } catch (err) { box.innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
});

// Dinas
(async () => {
  try {
    const list = await api.getDinasList();
    $('#dinas').innerHTML = `<option value="">— Pilih Dinas Pendidikan —</option>` +
      list.map(d => `<option value="${esc(d.provinsi)}">${esc(d.nama_dinas)}</option>`).join('');
  } catch (err) { $('#dinas').innerHTML = `<option value="">Gagal memuat: ${esc(err.message)}</option>`; }
})();
$('#f-dinas').addEventListener('submit', e => {
  e.preventDefault();
  const p = $('#dinas').value; if (!p) return;
  location.href = 'disdik/index.html?provinsi=' + encodeURIComponent(p);
});

// Direktorat
$('#f-dir').addEventListener('submit', async e => {
  e.preventDefault();
  $('#dir-msg').innerHTML = '';
  try {
    await api.loginDirektorat($('#email').value.trim(), $('#pw').value);
    location.href = 'direktorat/index.html';
  } catch (err) { $('#dir-msg').innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
});
