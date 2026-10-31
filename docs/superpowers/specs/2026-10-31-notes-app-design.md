# Design: Notes App (PWA catatan cepat offline)

Tanggal: 2026-10-31
Status: menunggu persetujuan
Sumber: `docs/specs.md`, `docs/AGENTS.md`, diskusi brainstorming

## Maksud dan alasannya

Aplikasi catatan cepat untuk HP yang tetap bisa dipakai saat offline, sesuai
`docs/specs.md`. Nilai utamanya adalah kecepatan menulis catatan di perangkat
sendiri tanpa server dan tanpa login: buka, tulis, simpan, selesai. Offline
bukan fitur tambahan, melainkan alasan aplikasi ini ada, jadi keputusan teknis
yang mengorbankan keandalan offline tidak sejalan dengan maksudnya.

Konteks pengerjaan: ini tugas kuliah dengan `docs/AGENTS.md` yang mengatur cara
AI agent bekerja. Pekerjaan dimulai dari scaffold Vite default, bukan dari kode
catatan yang sudah ada.

## Keadaan repo saat ini

Diperiksa langsung sebelum dokumen ini ditulis:

- `src/` masih scaffold Vite default: `main.js`, `counter.js`, `style.css`, plus
  `src/assets/` berisi `hero.png`, `javascript.svg`, `vite.svg`.
- `public/` berisi `favicon.svg` dan `icons.svg`.
- `package.json` hanya punya skrip `dev`, `build`, `preview`, dengan satu
  devDependency `vite ^8.3.5`. Tidak ada `lint`, `test`, `test:e2e`.
- Folder `tests/` belum ada. Tidak ada satu pun file test.
- `docs/AGENTS.md` menyuruh membaca `spec.md` dan `docs/work-orders.md`; yang ada
  `docs/specs.md`, dan `docs/work-orders.md` tidak ada.

Konsekuensi: syarat "Done when" di spec menyebut tiga perintah yang skripnya
belum ada, dan AGENTS.md melarang mengubah atau men-skip file di `tests/`.
Larangan itu ditafsirkan berlaku untuk test yang sudah ada; membuat test baru
dari nol adalah bagian pekerjaan ini dan sudah disetujui pemilik proyek.

## Tujuan

1. Tambah, edit, hapus catatan (judul + isi), tersimpan di `localStorage`.
2. Cari catatan berdasarkan teks di judul atau isi.
3. Bisa dibuka offline dan dipasang ke home screen sebagai PWA.
4. Rapi di layar 360 px tanpa horizontal scroll, target sentuh minimal 44 x 44 px.
5. `npm run lint`, `npm test`, `npm run test:e2e` lulus.
6. Lighthouse mode Mobile: Performance dan Accessibility >= 90, diukur pada hasil
   `vite preview`.

## Bukan tujuan

- Sync antar perangkat, berbagi catatan, lampiran gambar (eksplisit out of scope).
- Autentikasi, backend, database.
- UI framework atau state management library.
- URL unik per catatan.
- Rich text, tag, folder, pin, arsip.

## Anti-tujuan

Hal yang membuat pekerjaan ini gagal walau secara teknis jalan:

- Kehilangan catatan pengguna karena bug penyimpanan atau perubahan bentuk data
  tanpa migrasi. Ini kegagalan paling mahal karena tidak ada backup.
- Lulus test tapi tidak bisa dipakai offline sungguhan.
- Menambah dependency yang membuat aplikasi tidak lagi "HTML, CSS, JavaScript
  murni" seperti bunyi spec.
- Teks UI yang menyimpang dari UI contract sehingga test jadi rapuh.

## Batasan

- Stack: HTML, CSS, JavaScript murni + Vite. Tanpa UI framework.
- Penyimpanan: `localStorage`. Tanpa server, tanpa login.
- Kode (nama fungsi, variabel, komentar) dalam English; teks tampilan dalam
  Bahasa Indonesia.
- JavaScript modern, ES modules.
- UI contract yang dipakai test, teks persis:
  - Heading halaman: "Catatan"
  - Tombol: "Tambah catatan", "Simpan", "Hapus"
  - Input berlabel: "Judul", "Isi", "Cari"
- Agent tidak menjalankan `git commit`, `git push`, atau deploy (AGENTS.md).
  Dokumen ini juga tidak di-commit oleh agent.
- Dependency baru harus dinyatakan lebih dulu. Yang sudah disetujui ada di
  bagian Dependency.

## Approaches

### Alur layar

| | Bentuk | Trade-off |
|---|---|---|
| **A (dipilih)** | Satu halaman. Tombol "Tambah catatan" membuka form Judul/Isi inline di bawah heading; klik catatan mengisi form yang sama untuk edit. | Paling sedikit kode dan paling mudah dites karena tanpa navigasi dan tanpa manajemen fokus dialog. Ruang mengetik paling sempit dan tidak ada URL per catatan. |
| B | Daftar penuh dengan tombol tambah mengambang, editor sebagai `<dialog>` native. | Paling terasa seperti aplikasi HP. Dialog menambah kerja manajemen fokus dan risiko aksesibilitas yang ikut dinilai Lighthouse. |
| C | Dua view terpisah (daftar dan detail) lewat hash routing `#/note/<id>`. | Ruang paling lega dan catatan bisa dibuka lewat URL. Butuh router buatan sendiri dan penanganan link mati, padahal URL per catatan bukan tujuan. |

Keputusan: **A**, dipilih pemilik proyek. Kerumitan paling rendah untuk fitur
yang diminta, dan A bisa dinaikkan ke C nanti tanpa membongkar bentuk data.
Perubahan tampilan, kalau ada, dibahas di akhir setelah aplikasi jalan.

### Bentuk data di localStorage

| | Bentuk | Trade-off |
|---|---|---|
| **Satu key berisi array (dipilih)** | `notes-app:v1` berisi `{ version, notes: [...] }`. | Satu sumber kebenaran, mudah dimigrasi, mudah dites. Setiap simpan menulis ulang seluruh koleksi. |
| Satu key per catatan | `note:<id>` plus key indeks terpisah. | Menulis satu catatan lebih hemat. Butuh indeks yang rawan tidak sinkron dengan isinya. |

Keputusan: **satu key berisi array**, usulan saya, diserahkan pemilik proyek.
Untuk puluhan catatan di satu perangkat biaya tulis ulang tidak terasa, sementara
risiko indeks tidak sinkron menyerang langsung anti-tujuan kehilangan data.
Pembungkus `version` ada supaya perubahan bentuk data nanti bisa dimigrasi.

### Service worker dan PWA

| | Cara | Trade-off |
|---|---|---|
| **vite-plugin-pwa mode `injectManifest` (dipilih)** | Logika service worker tetap kode kita; plugin menyuntik daftar aset ber-hash hasil build ke `self.__WB_MANIFEST`. | Precache lengkap sejak pemasangan. Workbox hanya devDependency, tidak masuk bundle browser. Menambah satu dependency dengan pohon transitif besar. |
| Tulis tangan penuh | `public/sw.js` plus manifest, didaftarkan manual. | Nol dependency. Nama aset build ber-hash baru ada setelah build, jadi daftar precache tidak bisa ditulis; penambalnya cache-saat-pertama-diambil, dan app yang dipasang lalu langsung offline tanpa pernah dibuka bisa kehilangan aset. |
| Mode `generateSW` | Plugin menulis seluruh service worker. | Paling sedikit kode kita, paling banyak perilaku tersembunyi, paling jauh dari semangat "tanpa framework". |

Keputusan: **`injectManifest`**, dipilih pemilik proyek. Offline adalah fitur
utama, dan lubang aset ber-hash pada opsi tulis tangan menyerang tepat di sana.

Kategori PWA sudah dihapus dari Lighthouse sejak v12, jadi service worker tidak
menyumbang apa pun ke target Performance dan Accessibility >= 90. Dia murni
untuk fitur offline.

## Dependency

Semua devDependency, versi dipatok tepat (bukan range). Versi dicek lewat
`npm view` pada 2026-10-31.

| Paket | Versi | Untuk |
|---|---|---|
| `@playwright/test` | 1.64.1 | `test:e2e`, dan merender ikon PWA |
| `eslint` | 10.14.0 | `lint` |
| `@eslint/js` | 10.0.1 | konfigurasi `recommended` untuk flat config |
| `globals` | 17.13.0 | daftar global browser, node, service worker |
| `vite-plugin-pwa` | 2.0.0 | precache `injectManifest` + manifest |
| `workbox-build` | 7.4.1 | peer dependency vite-plugin-pwa 2.0.0 |
| `workbox-window` | 7.4.1 | peer dependency vite-plugin-pwa 2.0.0 |

`vite-plugin-pwa` 2.0.0 mencantumkan `vite ^8.0.0` di peer-nya, cocok dengan
`vite 8.3.5` yang terpasang. Peer `@vite-pwa/assets-generator` tidak dipasang
karena ikon dibuat tanpa alat itu; kalau npm memperlakukannya sebagai peer wajib,
itu dilaporkan ke pemilik proyek sebelum dipasang.

`npm test` memakai test runner bawaan Node (`node --test`), bukan Vitest atau
Jest, supaya tidak ada dependency test tambahan.

## Rancangan

### Struktur file

```
index.html
src/
  main.js          wiring DOM dan event
  storage.js       baca/tulis localStorage + migrasi versi
  notes.js         logika murni: create, update, remove, search
  style.css
  sw.js            service worker (injectManifest)
public/
  favicon.svg
  icons.svg
  icons/pwa-192.png  dirender dari favicon.svg
  icons/pwa-512.png  dirender dari favicon.svg
tests/
  unit/            node --test
  e2e/             Playwright
vite.config.js
eslint.config.js
playwright.config.js
```

Scaffold Vite yang dihapus: `src/counter.js`, `src/assets/hero.png`,
`src/assets/javascript.svg`, `src/assets/vite.svg`.

### Bentuk data

```js
// localStorage key: "notes-app:v1"
{
  version: 1,
  notes: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000", // crypto.randomUUID()
      title: "Belanja mingguan",
      body: "Beras, minyak, sabun",
      createdAt: 1762000000000, // Date.now()
      updatedAt: 1762000000000
    }
  ]
}
```

Urutan dalam `notes`: `updatedAt` menurun, jadi catatan yang baru diubah muncul
di atas. Urutan disimpan apa adanya di storage, bukan diurutkan ulang saat
render, supaya hasilnya bisa diprediksi test.

Pembacaan bersikap defensif: JSON rusak, key hilang, `version` tak dikenal, atau
`notes` bukan array tidak boleh membuat aplikasi mati. Semua kasus itu jatuh ke
koleksi kosong dan dicatat lewat `console.warn`, tanpa menghapus data mentah yang
ada. Penulisan pertama setelah itu tidak boleh menimpa data mentah yang tidak
terbaca; data itu dipindah dulu ke key cadangan.

### UI dan perilaku

Satu halaman, dari atas ke bawah: `<h1>Catatan</h1>`, input "Cari", tombol
"Tambah catatan", form Judul/Isi (tersembunyi sampai dipicu), lalu daftar catatan.

- "Tambah catatan" adalah `<button type="button">`, membuka form kosong dan
  memindahkan fokus ke input "Judul".
- Klik catatan di daftar memuat isinya ke form yang sama untuk diedit. Item
  daftar adalah `<button>` di dalam `<li>` supaya bisa dicapai keyboard tanpa
  `tabindex` buatan.
- "Simpan" menulis catatan baru atau memperbarui yang sedang diedit, lalu
  menutup form dan memperbarui daftar.
- "Hapus" muncul hanya saat mengedit catatan yang sudah tersimpan, dan meminta
  konfirmasi lewat `confirm()` karena data tidak bisa dipulihkan.
- Judul kosong (setelah di-trim) ditolak: pesan galat tampil di dekat input
  "Judul", bukan `alert`, dikaitkan lewat `aria-describedby` plus
  `aria-invalid`. Isi kosong diperbolehkan.
- "Cari" menyaring saat diketik, tanpa tombol cari. Pencocokan case-insensitive
  terhadap judul atau isi.
- Daftar kosong menampilkan pesan; hasil pencarian kosong menampilkan pesan yang
  berbeda, supaya "belum ada catatan" tidak tertukar dengan "tidak ada yang cocok".
- Perubahan daftar diumumkan lewat region `aria-live="polite"` agar pembaca layar
  tahu hasil pencarian berubah.

Label memakai `<label for>` sungguhan dan terlihat, bukan `aria-label` atau
placeholder: pengguna tetap melihat labelnya, dan test bisa memakai `getByLabel`
sesuai UI contract.

### Mobile dan aksesibilitas

- Satu kolom, `box-sizing: border-box`, tanpa lebar tetap yang melebihi viewport.
- Semua target sentuh (tombol, item daftar, input) minimal 44 x 44 px.
- `font-size` input minimal 16 px supaya Safari iOS tidak melakukan zoom paksa.
- Kontras warna memenuhi WCAG AA.
- Fokus terlihat jelas; outline tidak dihapus tanpa pengganti.
- Verifikasi penuh WCAG butuh pengujian manual dengan teknologi bantu dan
  tinjauan ahli; yang dikerjakan di sini pemeriksaan otomatis plus praktik di atas.

### PWA

`vite.config.js` memakai `VitePWA` dengan `strategies: 'injectManifest'`,
`srcDir: 'src'`, `filename: 'sw.js'`. Service worker kita mem-`cache.addAll`
daftar dari `self.__WB_MANIFEST`, memakai cache-first untuk aset app shell, dan
membersihkan cache versi lama saat `activate`.

Manifest: `name` "Catatan", `short_name` "Catatan", `display` "standalone",
`start_url` "/", `lang` "id", plus ikon 192 dan 512 px. Ikon dirender dari
`public/favicon.svg` memakai Playwright yang sudah terpasang.

Service worker hanya aktif pada build produksi, tidak di `vite dev`, supaya tidak
mengacaukan hot reload.

### Test

`npm test` (`node --test tests/unit/`) menguji logika murni tanpa browser:
pembuatan dan pembaruan catatan, hapus, penyaringan pencarian termasuk
case-insensitive dan cocok di isi saja, penolakan judul kosong, urutan
`updatedAt` menurun, serta pembacaan storage yang rusak atau versinya tak dikenal.

`npm run test:e2e` (Playwright, viewport 360 px) menguji lewat UI contract:
tambah catatan lalu muncul di daftar, edit catatan tersimpan, hapus dengan
konfirmasi, pencarian menyaring daftar, data bertahan setelah reload, tidak ada
horizontal scroll pada 360 px, dan ukuran target sentuh. Satu test offline
memakai build hasil `preview`: muat app, tunggu service worker aktif, putus
jaringan, muat ulang, lalu pastikan app tetap tampil beserta catatannya.

Setiap test memulai dari `localStorage` bersih agar tidak saling bergantung.

### Skrip npm

```
lint      eslint .
test      node --test tests/unit/
test:e2e  playwright test
```

`test:e2e` memakai `webServer` di `playwright.config.js` supaya build dan
`vite preview` dijalankan otomatis, dan test offline mengukur build sebenarnya.

## Keputusan kecil yang saya ambil sendiri

Semua sudah disebut di atas, dikumpulkan di sini supaya mudah diperiksa:

1. `npm test` memakai `node --test`, bukan Vitest.
2. "Hapus" memakai `confirm()`.
3. Judul kosong ditolak dengan pesan inline; isi kosong diizinkan.
4. Pencarian menyaring saat diketik, tanpa tombol.
5. Scaffold Vite yang tidak terpakai dihapus.
6. Lighthouse diukur pada `vite preview`.
7. Ikon PWA dirender dengan Playwright.
8. `.superpowers/` ditambahkan ke `.gitignore`.
9. Service worker aktif hanya pada build produksi.
10. Data storage yang tidak terbaca dipindah ke key cadangan, tidak ditimpa.

## Yang diserahkan ke pelaksana

- Palet warna, spasi, tipografi, selama kontras AA dan target 44 px terpenuhi.
- Nama fungsi dan modul internal, selama dalam English dan ES modules.
- Aturan ESLint spesifik, selama `npm run lint` lulus tanpa dependency baru.
- Teknik pemotongan pratinjau isi catatan di daftar.
- Cara membersihkan cache lama di service worker.
- Pembagian file test, selama cakupan di atas terpenuhi.

## Hal yang belum terverifikasi

- Skor Lighthouse >= 90 belum diukur; baru bisa setelah ada build.
- Pemasangan paket dan peer dependency belum dijalankan.
- `context.setOffline()` di Playwright belum dipastikan ikut memutus fetch dari
  service worker. Kalau tidak, test offline bisa lulus palsu, dan pelaksana harus
  memakai cara lain (misalnya menghentikan server preview).
- Perilaku offline belum diuji pada perangkat atau browser sungguhan di luar
  Playwright.
