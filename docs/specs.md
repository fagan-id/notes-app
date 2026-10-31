# Spec: Notes App 
## Goal Aplikasi catatan cepat untuk HP yang tetap bisa dipakai saat offline. 

## Features 
- Tambah, edit, dan hapus catatan (judul + isi) 
- Cari catatan berdasarkan teks di judul atau isi
- Bisa dibuka offline dan ditambahkan ke home screen (PWA) 

## Mobile 
- Rapi di layar selebar 360 px, tanpa horizontal scroll 
- Tombol dan area sentuh minimal 44 x 44 px 

## Data dan stack 
- Disimpan di browser (localStorage). Tanpa server, tanpa login. 
- HTML, CSS, JavaScript murni + Vite. Tanpa UI framework. 

## UI contract (nama ini dipakai oleh tests) 
- Heading halaman: "Catatan" 
- Tombol: "Tambah catatan", "Simpan", "Hapus" 
- Input berlabel: "Judul", "Isi", "Cari" 

## Done when 
- npm run lint, npm test, dan npm run test:e2e lulus 
- Lighthouse (mode Mobile): Performance dan Accessibility >= 90 

## Out of scope 
- Sync antar device, berbagi catatan, gambar 
