import { api } from './api.js';
import { $, esc, header, qs, errorBox } from './ui.js';
import { renderWilayah } from './wilayah.js';

const provinsi = qs('provinsi');
const app = $('#app');

(async () => {
  try {
    const list = await api.getDinasList();
    const d = list.find(x => x.provinsi === provinsi);
    if (!d) { app.innerHTML = `<div class="alert bad">Dinas Pendidikan tidak dikenal. <a href="../index.html">Kembali ke halaman masuk</a>.</div>`; return; }
    $('#top').innerHTML = header({ subtitle: 'Dashboard Dinas Pendidikan — pemantauan pengisian', title: d.nama_dinas, right: `<a href="../index.html">Keluar</a>` });
    document.title = 'SI-UKK SMK — ' + d.nama_dinas;
    await renderWilayah(app, provinsi, { isDirektorat: false });
  } catch (e) { errorBox(app, e); }
})();
