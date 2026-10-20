// Jendela riwayat perubahan satu KK (dipakai di semua dashboard)
import { api } from './api.js';
import { esc, fmtWaktu, modal, toast, describeIsian, errorBox } from './ui.js';

export async function bukaRiwayat(kk, { npsn, canRestore = false, onRestored } = {}) {
  const m = modal({ title: 'Riwayat isian — ' + kk.konsentrasi, body: '<div class="loading">Memuat riwayat…</div>' });
  const render = async () => {
    try {
      const [ref, rows] = await Promise.all([api.getRef(), api.getRiwayat(kk.kk_id)]);
      if (!rows.length) { m.el.innerHTML = '<p class="muted">Belum ada perubahan yang tercatat untuk KK ini.</p>'; return; }
      m.el.innerHTML = `<p class="muted small">Urutan terbaru di atas. ${canRestore ? 'Pilih “Kembalikan ke isian ini” untuk memakai lagi isian pada versi tersebut. Pemulihan juga tercatat sebagai perubahan baru.' : ''}</p>
      <ul class="timeline">${rows.map((r, i) => `<li>
        <div class="small muted">${fmtWaktu(r.waktu)} · ${r.aksi === 'pulihkan' ? 'Dipulihkan' : 'Disimpan'}${i === 0 ? ' · <b>isian saat ini</b>' : ''}</div>
        <div>${describeIsian(r.metode_baru, r.jenis_mitra_baru, r.nama_instansi_baru, ref)}</div>
        <div class="small muted">sebelumnya: ${describeIsian(r.metode_lama, r.jenis_mitra_lama, r.nama_instansi_lama, ref)}</div>
        ${canRestore && i > 0 ? `<button class="btn small" style="margin-top:6px" data-restore="${r.id}">Kembalikan ke isian ini</button>` : ''}
        ${canRestore && i === rows.length - 1 && r.metode_lama === null ? `<button class="btn small ghost" style="margin-top:6px" data-restore-empty="${r.id}">Kosongkan (kembali ke belum diisi)</button>` : ''}
      </li>`).join('')}</ul>`;
    } catch (e) { errorBox(m.el, e); }
  };
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-restore],[data-restore-empty]'); if (!b) return;
    const id = +(b.dataset.restore || b.dataset.restoreEmpty);
    const versi = b.dataset.restore ? 'baru' : 'lama';
    b.disabled = true;
    try {
      await api.pulihkan(npsn, id, versi);
      toast('Isian dipulihkan');
      onRestored && onRestored();
      render();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
  render();
}
