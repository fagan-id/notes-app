# Work Orders

> Untuk AI agent: kerjakan satu work order per permintaan (AGENTS.md aturan 1),
> berurutan WO-1 sampai WO-5. Langkah memakai checkbox `- [ ]`. Jangan commit,
> push, atau deploy (AGENTS.md aturan 4). Di akhir tiap WO jalankan ketiga
> perintah di "Gate bersama" lalu tulis ringkasan file yang diubah dan hasil tes.
>
> Untuk pemilik proyek: branch `main` dikunci ruleset `protect-main`. Setiap WO
> dikerjakan di branch sendiri (misalnya `wo-1-storage`), lalu di-merge lewat
> pull request setelah check `checks` di CI hijau. Commit dan PR dibuat oleh
> pemilik proyek, bukan agent.

**Goal:** aplikasi catatan offline untuk HP sesuai `docs/specs.md`.

**Architecture:** satu halaman (opsi A): form Judul/Isi inline di atas daftar.
Semua akses data lewat `createStore()` di `src/storage.js`; `src/main.js` hanya
mengurus DOM. Offline memakai `vite-plugin-pwa` mode `injectManifest`, dengan
service worker kita sendiri di `src/sw.js`.

**Tech stack:** HTML, CSS, JavaScript murni (ES modules), Vite 8, Vitest,
Playwright, ESLint, GitHub Actions.

**Spec:** `docs/specs.md` dan desain `docs/superpowers/specs/2026-10-31-notes-app-design.md`.

## Aturan global

- Kode (nama fungsi, variabel, komentar) dalam English; teks tampilan dalam Bahasa Indonesia.
- UI contract, teks persis: heading "Catatan"; tombol "Tambah catatan", "Simpan", "Hapus"; input berlabel "Judul", "Isi", "Cari".
- Label memakai `<label for>` yang terlihat, supaya `getByLabel` di test bekerja.
- Layar 360 px tanpa horizontal scroll; target sentuh minimal 44 x 44 px; `font-size` input minimal 16 px.
- Data di `localStorage`, key `notes-app:v1`, bentuk `{ version: 1, notes: Note[] }`.
- Isi catatan selalu ditampilkan lewat `textContent`, tidak pernah lewat `innerHTML`.
- `vite.config.js` memakai `base: "./"` agar app jalan di GitHub Pages (`/notes-app/`). Semua path yang ditulis tangan (service worker, manifest, ikon) harus relatif, tidak boleh diawali `/`.
- Tanpa UI framework. Semua dependency adalah devDependency dengan versi dipatok tepat.
- Folder `tests/` dibuat oleh WO ini. Setelah sebuah test ada, WO berikutnya tidak boleh mengubah, menghapus, atau men-skip-nya (AGENTS.md aturan 2); WO berikutnya hanya boleh menambah test.

## Gate bersama

```
npm run lint
npm test
npm run test:e2e
```

Ketiganya harus lulus di akhir setiap WO, baik di lokal maupun di CI
(`.github/workflows/ci.yml`, job `checks`).

Saat ini `test` memakai `--passWithNoTests` dan `test:e2e` memakai
`--pass-with-no-tests`, jadi gate lulus walau belum ada test. WO-1 menghapus
flag pertama, WO-2 menghapus flag kedua, supaya file test yang hilang langsung
membuat gate gagal.

`reuseExistingServer` bernilai `!process.env.CI`. Di lokal, Playwright memakai
server di port 4173 kalau sudah ada. Matikan `npm run preview` sebelum
menjalankan `npm run test:e2e`, karena kalau tidak, test diuji terhadap build lama.

## Dependency

| Paket | Versi | Dipasang di |
|---|---|---|
| `eslint` | 10.14.0 | WO-0 (sudah) |
| `@eslint/js` | 10.0.1 | WO-0 (sudah) |
| `globals` | 17.13.0 | WO-0 (sudah) |
| `vitest` | 5.0.5 | WO-0 (sudah) |
| `@playwright/test` | 1.64.1 | WO-0 (sudah, plus browser Chromium) |
| `vite-plugin-pwa` | 2.0.0 | WO-4 |
| `workbox-build` | 7.4.1 | WO-4 (peer dependency vite-plugin-pwa) |
| `workbox-window` | 7.4.1 | WO-4 (peer dependency vite-plugin-pwa) |

`@vite-pwa/assets-generator` adalah peer opsional dan tidak dipasang.

`npm audit` melaporkan 5 kerentanan moderate di `minimatch` yang ikut lewat
ESLint. Ini hanya ada di tools development, tidak masuk ke bundle. Jangan
jalankan `npm audit fix --force`, karena perintah itu menurunkan ESLint ke versi 4.

## Hal yang harus dijaga walau spec tidak menyebutnya

Tiap baris punya test di WO pemiliknya.

1. Data di storage rusak atau versinya tidak dikenal: app tetap jalan dengan daftar kosong, dan data lama dipindah ke key cadangan, tidak ditimpa. (WO-1)
2. Penyimpanan gagal (kuota penuh, mode private): muncul pesan galat, form tetap terbuka, dan teks yang diketik tidak hilang. (WO-2)
3. Judul atau isi berisi HTML seperti `<img src=x onerror=alert(1)>` tampil sebagai teks dan tidak dijalankan. (WO-2)
4. Kata panjang tanpa spasi, misalnya URL 200 karakter, tidak memicu horizontal scroll di 360 px. (WO-2)
5. Catatan yang sedang diedit sudah dihapus di tab lain: "Simpan" tetap menyimpan teks pengguna, tidak membuangnya. (WO-1)

---

## WO-0: Tooling dan CI (selesai)

Sudah ada di repo, tidak perlu dikerjakan ulang:

- `package.json`: skrip `lint` (`eslint .`), `test` (`vitest run --passWithNoTests`), dan `test:e2e` (`playwright test --pass-with-no-tests`).
- `vite.config.js`: `base: "./"`; Vitest hanya menjalankan `tests/unit/**/*.test.js`.
- `eslint.config.js`: `js.configs.recommended`, global browser dan node untuk semua file, mengabaikan `dist/`, `playwright-report/`, `test-results/`, `.lighthouseci/`.
- `playwright.config.js`: `testDir: ./tests/e2e`, satu project `mobile-chrome` (emulasi Pixel 5, viewport 393 x 851), `baseURL: http://localhost:4173`, `webServer` menjalankan build lalu `preview` di port 4173.
- `.github/workflows/ci.yml`: job `checks` menjalankan lint, unit test, dan e2e di setiap pull request dan push ke `main`.
- `.gitignore`: `.superpowers/`, `test-results/`, `playwright-report/`.

---

## WO-1: Storage

**Tujuan:** menyimpan, membaca, menghapus, dan mencari catatan di `localStorage`
lewat satu API yang bisa dites tanpa browser.

**File:**
- Buat: `src/storage.js`, `tests/unit/storage.test.js`
- Ubah: `package.json` (buang `--passWithNoTests` dari skrip `test`)

**Interface yang dihasilkan** (dipakai WO-2 dan WO-3):

```js
// Note: { id: string, title: string, body: string, createdAt: number, updatedAt: number }
export const STORAGE_KEY = 'notes-app:v1'
export function createStore(storage = globalThis.localStorage) {
  return { list, save, remove, search }
}
// list(): Note[]                    salinan, urut updatedAt menurun
// save({ id?, title, body }): Note  mengembalikan catatan yang tersimpan
// remove(id: string): boolean       true kalau ada yang dihapus
// search(text: string): Note[]      urutan sama dengan list()
```

Default `globalThis.localStorage` dipakai, bukan `window.localStorage`, supaya
modul ini bisa di-import di Vitest (environment `node`) tanpa `window`.

Aturan perilaku:
- `save` tanpa `id`: buat id baru dengan `crypto.randomUUID()`, isi `createdAt` dan `updatedAt` dengan `Date.now()`.
- `save` dengan `id` yang ada: perbarui `title`, `body`, `updatedAt`, dan pertahankan `createdAt`.
- `save` dengan `id` yang tidak ada (sudah dihapus di tab lain): simpan sebagai catatan dengan id itu. Teks pengguna tidak boleh dibuang.
- `save` dengan `title.trim() === ''`: lempar `Error('title is required')`. `body` kosong boleh. `title` dan `body` disimpan setelah di-trim.
- `search`: `text.trim()` kosong mengembalikan `list()`. Selain itu cocokkan tanpa membedakan huruf besar/kecil terhadap `title` atau `body`.
- Data dibaca ulang dari `storage` setiap kali dipanggil, bukan disimpan di memori, supaya perubahan dari tab lain terbaca.
- Kalau isi key tidak bisa dipakai (JSON rusak, `version !== 1`, atau `notes` bukan array): `list()` mengembalikan `[]` dan memanggil `console.warn`. Pada `save` berikutnya, salin dulu string mentahnya ke key `notes-app:backup:<Date.now()>`, baru tulis data baru.
- Galat dari `storage.setItem` (misalnya `QuotaExceededError`) diteruskan ke pemanggil, tidak ditelan.

Langkah:

- [ ] **1.** Tulis `tests/unit/storage.test.js` dengan `import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'`. Storage palsu adalah objek berbasis `Map` dengan `getItem`, `setItem`, `removeItem`. Waktu dikendalikan dengan `vi.useFakeTimers()` dan `vi.setSystemTime(n)`, lalu dikembalikan dengan `vi.useRealTimers()` di `afterEach`. `console.warn` dibungkam dengan `vi.spyOn(console, 'warn').mockImplementation(() => {})`. Test dan assertion-nya:
  - `save without id creates a note` → `id` cocok dengan regex UUID, `createdAt === updatedAt === now`, `list().length === 1`
  - `save trims title and body` → `save({ title: '  A ', body: ' b ' })` menghasilkan `title === 'A'`, `body === 'b'`
  - `save with existing id updates and keeps createdAt` → `createdAt` tetap, `updatedAt` = waktu baru, `list().length === 1`
  - `save with unknown id keeps the text` → `list()[0]` berisi id, title, dan body yang dikirim
  - `save rejects empty title` → `expect(() => store.save({ title: '   ', body: 'x' })).toThrow(/title is required/)`, storage tidak berubah
  - `list is sorted by updatedAt descending` → tiga catatan pada waktu 1, 2, 3, lalu yang pertama diedit; urutan menjadi pertama, ketiga, kedua
  - `list returns a copy` → mengubah array hasil `list()` tidak memengaruhi `list()` berikutnya
  - `remove deletes and reports` → `remove(id) === true` dan catatan hilang; `remove('nope') === false`
  - `search matches title or body, case-insensitive` → catatan `{ title: 'Belanja', body: 'beras' }` ditemukan oleh `'BELANJA'` dan `'Beras'`, tidak ditemukan oleh `'minyak'`
  - `search with blank text returns all` → `search('   ')` sama dengan `list()`
  - `persists through storage` → `createStore(fake)` baru di atas storage yang sama membaca catatan yang sama; `JSON.parse(fake.getItem(STORAGE_KEY)).version === 1`
  - `corrupt data is not lost` → isi key dengan `'{oops'`; `list()` mengembalikan `[]` dan `console.warn` terpanggil; setelah `save`, ada key berawalan `notes-app:backup:` yang berisi `'{oops'`
  - `unknown version is not lost` → isi key dengan `JSON.stringify({ version: 2, notes: [] })`; perilakunya sama dengan test sebelumnya
  - `setItem errors propagate` → `setItem` palsu melempar; `save` ikut melempar error yang sama
- [ ] **2.** Buang `--passWithNoTests` dari skrip `test` di `package.json`.
- [ ] **3.** Jalankan `npm test`. Harus GAGAL karena `src/storage.js` belum ada.
- [ ] **4.** Implementasikan `src/storage.js` sesuai Interface dan aturan perilaku di atas.
- [ ] **5.** Jalankan ketiga perintah Gate bersama. Semuanya harus LULUS.

**Gate:** `tests/unit/storage.test.js` lulus dan `npm run lint` bersih.

---

## WO-2: Layar daftar dan editor

**Tujuan:** UI satu halaman sesuai UI contract, memakai `createStore()`. File contoh
Vite dihapus.

**File:**
- Hapus: `src/counter.js`, `src/assets/hero.png`, `src/assets/javascript.svg`, `src/assets/vite.svg`, `public/icons.svg`
- Ubah: `index.html`, `src/main.js`, `src/style.css`, `package.json` (buang `--pass-with-no-tests` dari skrip `test:e2e`)
- Buat: `tests/e2e/notes.spec.js`

**Interface:**
- Memakai: `createStore()`, `list()`, `save()`, `remove()` dari WO-1
- Menghasilkan: struktur DOM yang dipakai WO-3, yaitu input "Cari" yang sudah tampil tapi belum menyaring, elemen daftar `<ul>`, dan region status `aria-live="polite"`

Struktur halaman, dari atas: `<h1>Catatan</h1>`, input `type="search"` berlabel "Cari",
`<button type="button">Tambah catatan</button>`, `<form>` berisi input "Judul",
`<textarea>` "Isi", tombol "Simpan" (`type="submit"`) dan "Hapus" (`type="button"`),
lalu `<ul>` daftar catatan dengan setiap item berupa `<li><button>` yang menampilkan
judul dan potongan isi.

Perilaku:
- Form tersembunyi (`hidden`) sampai "Tambah catatan" atau sebuah item diklik. Saat terbuka, fokus pindah ke "Judul".
- "Hapus" hanya tampil saat mengedit catatan tersimpan, dan meminta konfirmasi lewat `confirm('Hapus catatan ini?')`.
- "Simpan" dengan judul kosong: tampilkan "Judul wajib diisi" di elemen yang ditautkan lewat `aria-describedby`, beri input `aria-invalid="true"`, dan biarkan form tetap terbuka.
- Kalau `save` melempar error lain: tampilkan "Gagal menyimpan. Penyimpanan perangkat mungkin penuh." Form tetap terbuka dan teks tidak hilang.
- Setelah simpan atau hapus berhasil: form ditutup, isinya dikosongkan, dan daftar dirender ulang.
- Daftar kosong menampilkan "Belum ada catatan".
- `index.html`: `lang="id"`, `<title>Catatan</title>`, `<meta name="description">`, `<meta name="theme-color">`.
- CSS: satu kolom, `box-sizing: border-box`, `overflow-wrap: anywhere` pada judul dan isi, target sentuh 44 px, input 16 px, kontras AA, `:focus-visible` terlihat.

Langkah:

- [ ] **1.** Tulis `tests/e2e/notes.spec.js` dengan `test.describe('WO-2', ...)`. Setiap test dimulai dari `page.goto('/')` di context baru, jadi storage selalu bersih. Konfirmasi hapus diterima dengan `page.once('dialog', d => d.accept())`, karena Playwright menolak dialog secara default. Project `mobile-chrome` memakai viewport Pixel 5 yang lebarnya 393 px, sedangkan spec menuntut 360 px. Karena itu, dua test terakhir ditaruh di `test.describe` bersarang yang memanggil `test.use({ viewport: { width: 360, height: 740 } })`. Test dan assertion-nya:
  - `shows heading and controls` → `getByRole('heading', { name: 'Catatan' })`, `getByRole('button', { name: 'Tambah catatan' })`, dan `getByLabel('Cari')` terlihat
  - `adds a note` → klik "Tambah catatan", isi "Judul" dan "Isi", klik "Simpan"; daftar memuat judul itu dan form tersembunyi
  - `edits a note` → klik item, ubah "Judul", klik "Simpan"; daftar memuat judul baru dan tidak lagi memuat judul lama
  - `deletes a note after confirm` → klik item, klik "Hapus", terima dialog; daftar menampilkan "Belum ada catatan"
  - `keeps note when delete is cancelled` → dialog ditolak; catatan masih ada
  - `rejects empty title` → "Simpan" dengan judul kosong menampilkan "Judul wajib diisi", "Judul" punya `aria-invalid="true"`, dan form tetap terlihat
  - `persists after reload` → tambah catatan, `page.reload()`, catatan masih ada
  - `save failure keeps the text` → `page.addInitScript` membuat `Storage.prototype.setItem` melempar `DOMException('full', 'QuotaExceededError')`; "Simpan" menampilkan "Gagal menyimpan", lalu "Judul" dan "Isi" masih berisi teks yang diketik
  - `renders HTML as text` → judul `<img src=x onerror="window.__xss=1">`; daftar menampilkan string itu apa adanya, `page.evaluate(() => window.__xss)` bernilai `undefined`, dan tidak ada `img` di dalam daftar
  - `no horizontal scroll at 360px` (viewport 360) → setelah menambah catatan berjudul 200 karakter `'a'` tanpa spasi, `document.documentElement.scrollWidth <= 360`
  - `touch targets are at least 44px` (viewport 360) → setiap `button`, `input`, dan `textarea` yang terlihat punya `boundingBox()` dengan lebar dan tinggi `>= 44`
- [ ] **2.** Buang `--pass-with-no-tests` dari skrip `test:e2e` di `package.json`.
- [ ] **3.** Jalankan `npm run test:e2e -- --grep "WO-2"`. Harus GAGAL karena halaman masih contoh Vite.
- [ ] **4.** Hapus file contoh Vite, lalu implementasikan `index.html`, `src/main.js`, dan `src/style.css` sesuai struktur dan perilaku di atas.
- [ ] **5.** Jalankan ketiga perintah Gate bersama. Semuanya harus LULUS.

**Gate:** `test.describe('WO-2')` di `tests/e2e/notes.spec.js` lulus, dan unit test WO-1 tetap lulus.

---

## WO-3: Pencarian

**Tujuan:** input "Cari" menyaring daftar saat pengguna mengetik, memakai `store.search`.

**File:**
- Ubah: `src/main.js`, `tests/e2e/notes.spec.js` (hanya menambah blok baru)

**Interface:**
- Memakai: `search(text)` dari WO-1, serta input "Cari", `<ul>`, dan region status dari WO-2

Perilaku:
- Event `input` pada "Cari" merender daftar dari `store.search(value)`. Tidak ada tombol cari.
- Pencarian yang tidak cocok menampilkan "Tidak ada catatan yang cocok", berbeda dari "Belum ada catatan".
- Region `aria-live` mengumumkan jumlah hasil, misalnya "2 catatan ditemukan".
- Setelah simpan atau hapus, daftar dirender ulang dengan kata kunci "Cari" yang sedang aktif.

Langkah:

- [ ] **1.** Tambahkan `test.describe('WO-3', ...)` ke `tests/e2e/notes.spec.js`. Setiap test diawali dengan menambah dua catatan, "Belanja" (isi "beras") dan "Tugas" (isi "laporan"). Test dan assertion-nya:
  - `filters while typing` → mengisi "Cari" dengan `bel` membuat "Belanja" terlihat dan "Tugas" tidak terlihat
  - `matches body text` → `LAPORAN` menampilkan "Tugas"
  - `shows no-match message` → `zzz` menampilkan "Tidak ada catatan yang cocok"
  - `clearing search shows all` → mengosongkan "Cari" menampilkan kedua catatan lagi
  - `announces result count` → region `aria-live` memuat "1 catatan ditemukan" setelah mengetik `bel`
- [ ] **2.** Jalankan `npm run test:e2e -- --grep "WO-3"`. Harus GAGAL.
- [ ] **3.** Sambungkan event `input` pada "Cari" ke `store.search` di `src/main.js`.
- [ ] **4.** Jalankan ketiga perintah Gate bersama. Semuanya harus LULUS.

**Gate:** `test.describe('WO-3')` lulus. Logika pencarian sudah dikunci oleh unit test `search ...` di WO-1, dan semua test sebelumnya tetap lulus.

---

## WO-4: Offline + home screen

**Tujuan:** aplikasi bisa dibuka tanpa jaringan dan bisa di-install ke HP.

**File:**
- Buat: `src/sw.js`, `public/icons/pwa-192.png`, `public/icons/pwa-512.png`, `scripts/render-icons.js`
- Ubah: `vite.config.js` (tambah plugin, pertahankan `base` dan `test`), `src/main.js` (pendaftaran service worker), `package.json`, `.gitignore` (tambah `dev-dist/`), `eslint.config.js` (abaikan `dev-dist/`), `tests/e2e/notes.spec.js` (hanya menambah blok baru)

Perbedaan dari contoh awal yang memakai `public/sw.js` dan `public/manifest.webmanifest`:
sesuai keputusan desain, service worker ditulis di `src/sw.js` agar plugin bisa
menyuntikkan daftar aset ber-hash ke `self.__WB_MANIFEST`. Manifest dibuat oleh
plugin dari opsi `manifest`, jadi tidak ada file manifest yang ditulis tangan.

Tambahan di `plugins` pada `vite.config.js`. Semua path ditulis relatif karena `base: "./"`:

```js
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  injectRegister: false,
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
  manifest: {
    name: 'Catatan', short_name: 'Catatan', lang: 'id',
    start_url: './', scope: './', display: 'standalone',
    background_color: '#ffffff', theme_color: '<sama dengan meta theme-color>',
    icons: [
      { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

Isi `src/sw.js` (tanpa import dari Workbox). Plugin mewajibkan string `self.__WB_MANIFEST` muncul tepat satu kali, jadi tampung dulu ke satu konstanta:
- `install`: buka cache yang namanya diturunkan dari isi `self.__WB_MANIFEST` (gabungan `url` dan `revision`, di-hash), `cache.addAll` semua `url`-nya, lalu `self.skipWaiting()`.
- `activate`: hapus semua cache yang namanya berbeda dari cache saat ini, lalu `self.clients.claim()`.
- `fetch` untuk request GET same-origin: request navigasi dijawab dengan `index.html` dari cache, dengan URL yang dibentuk lewat `new URL('index.html', self.registration.scope)` dan bukan `'/index.html'`. Request lain cache-first, dan kalau tidak ada di cache, ambil dari jaringan.

Pendaftaran di `src/main.js`: `if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js')`.

Ikon: `scripts/render-icons.js` memakai Playwright untuk membuka `public/favicon.svg` di tengah kanvas berlatar putih, lalu menyimpan screenshot 192 dan 512 px ke `public/icons/`. Script ini dijalankan sekali dengan `node scripts/render-icons.js`, dan PNG hasilnya disimpan di repo.

Langkah:

- [ ] **1.** Pasang `vite-plugin-pwa`, `workbox-build`, dan `workbox-window` dengan `npm install -D -E` sesuai tabel Dependency.
- [ ] **2.** Tambahkan `test.describe('WO-4', ...)` ke `tests/e2e/notes.spec.js`. Test dan assertion-nya:
  - `serves a valid manifest` → tag `link[rel="manifest"]` ada; manifest hasil fetch punya `name === 'Catatan'`, `display === 'standalone'`, dan ikon 192 serta 512 yang masing-masing merespons 200
  - `works offline after first visit` → tambah catatan, tunggu `navigator.serviceWorker.ready`, lalu pastikan `navigator.serviceWorker.controller` tidak `null` (reload sekali kalau perlu). Setelah `context.setOffline(true)` dan `page.reload()`, heading "Catatan" dan catatan tadi tetap terlihat. Tambahkan juga pemeriksaan kanari: `page.evaluate(() => fetch('./missing-' + Date.now()).then(() => 'online', () => 'offline'))` harus bernilai `'offline'`. Belum dipastikan apakah `setOffline` ikut memutus fetch dari service worker. Kalau kanari bernilai `'online'`, berarti jaringan masih terbuka dan test ini tidak membuktikan apa pun. Kalau itu terjadi, berhenti dan laporkan ke pemilik proyek, jangan dilewati.
- [ ] **3.** Jalankan `npm run test:e2e -- --grep "WO-4"`. Harus GAGAL.
- [ ] **4.** Buat `scripts/render-icons.js`, jalankan, lalu pastikan kedua PNG ada dengan ukuran yang benar.
- [ ] **5.** Implementasikan perubahan `vite.config.js`, `src/sw.js`, dan pendaftaran service worker.
- [ ] **6.** Jalankan `npm run build`, lalu pastikan: `dist/sw.js` tidak lagi memuat string `self.__WB_MANIFEST`; `dist/` berisi `manifest.webmanifest`; dan tag manifest di `dist/index.html` memakai path relatif (`./manifest.webmanifest`), bukan `/manifest.webmanifest`.
- [ ] **7.** Jalankan ketiga perintah Gate bersama. Semuanya harus LULUS.

**Gate:** `test.describe('WO-4')` lulus, dan semua test sebelumnya tetap lulus.

---

## WO-5: Polish

**Tujuan:** Lighthouse (Mobile) Performance dan Accessibility >= 90, ditambah
perubahan tampilan yang ditunda ke akhir.

**File:** hanya yang dibutuhkan oleh temuan Lighthouse, biasanya `src/style.css`
dan `index.html`. Daftar perubahan tampilan disepakati dengan pemilik proyek
sebelum dikerjakan.

Langkah:

- [ ] **1.** Jalankan `npm run build && npm run preview`, buka `http://localhost:4173` di Chrome, lalu jalankan Lighthouse dari DevTools dengan mode Mobile dan kategori Performance dan Accessibility. Catat skor awal.
- [ ] **2.** Perbaiki setiap temuan yang menurunkan skor. Jangan menambah dependency tanpa bertanya.
- [ ] **3.** Kerjakan perubahan tampilan yang sudah disepakati.
- [ ] **4.** Ulangi Lighthouse dan catat skor akhir di ringkasan WO.
- [ ] **5.** Matikan `npm run preview`, lalu jalankan ketiga perintah Gate bersama. Semuanya harus LULUS.

**Gate:** laporan Lighthouse di Chrome DevTools menunjukkan Performance >= 90
dan Accessibility >= 90, dan semua test tetap lulus. Skor Accessibility 90 atau
lebih bukan bukti kepatuhan WCAG. Untuk itu tetap dibutuhkan pengujian manual
dengan pembaca layar.
