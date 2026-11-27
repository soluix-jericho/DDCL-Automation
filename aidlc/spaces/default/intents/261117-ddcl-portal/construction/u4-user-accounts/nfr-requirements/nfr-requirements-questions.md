# NFR Requirements — u4-user-accounts — Questions

## Sources

- [memory] `requirements.md` NFR1 (interaksi <2 detik, <20 pengguna aktif), NFR2 (semua endpoint wajib sesi), NFR3 (jalan lokal via Docker Compose), NFR4 (data permanen), NFR5 (coverage 80%).
- [memory] U1 dan U2 `nfr-requirements/`: stack sudah diputuskan (Fastify, Prisma, PostgreSQL, React + Vite, log JSON ke stdout, cadangan pra-migrasi di U2), sehingga U4 mewarisinya dan hanya menanyakan hal yang baru; tidak ada pustaka backend baru (scrypt bawaan Node, Q2 Functional Design).
- [memory] `rules.md` U4 BR4.2 (scrypt, minimal 10 karakter), BR4.4 (kunci 15 menit), BR4.6 (sesi 8 jam / 7 hari, tulis `lastSeenAt` paling cepat sekali per menit), BR4.11 (admin pertama dari lingkungan), BR4.16 (migrasi `createdByUserId`).
- [memory] Hasil review Functional Design U4 (`functional-design/reviews/review-01.md`): dua temuan Major (R-01 tidak ada jalur pemulihan akses dan kunci bisa dipakai mengunci admin, R-02 kata sandi lama di ganti-kata-sandi tanpa pembatasan laju) dan delapan Minor; Q4, Q3, Q2, Q7 dan Q8 di bawah menutupnya.
- [assumption] Tidak ada target ketersediaan formal untuk v1 (NFR3.1 U1: alat internal lokal). Belum dikonfirmasi untuk U4.

## Q1. [Performa] Biaya hash kata sandi dan target waktu

scrypt sengaja lambat. Perlu angka supaya login terasa cepat tetapi tebakan mahal, dan supaya banyak login bersamaan tidak membekukan backend.

- A. Parameter scrypt N=32768, r=8, p=1 (sekitar 100 ms per hash); login selesai <1 detik; paling banyak 4 hash berjalan bersamaan (sisanya antre); pemeriksaan sesi pada tiap permintaan menambah ≤50 ms (p95); target NFR1 (<2 detik) tetap untuk semua endpoint
- B. Parameter lebih ringan N=16384 (sekitar 50 ms); sisanya seperti A
- X. Other (please specify)

[Answer]: A

## Q2. [Skalabilitas] Pembersihan data sesi dan penghitung login

Baris `Session` kedaluwarsa atau dicabut dan baris `LoginThrottle` (termasuk email acak yang tidak terdaftar) akan menumpuk bila tidak dibersihkan.

- A. Backend menghapus `Session` yang sudah kedaluwarsa atau dicabut lebih dari 7 hari, dan `LoginThrottle` yang tidak terkunci dan tidak diubah >24 jam, saat start dan lalu tiap jam; tanpa batas jumlah baris (skala <20 pengguna)
- B. Seperti A, ditambah batas 10.000 baris `LoginThrottle` (yang tertua dihapus bila terlampaui)
- C. Tanpa pembersihan di v1
- X. Other (please specify)

[Answer]: A

## Q3. [Keandalan/Keamanan] Pemulihan akses (temuan review R-01)

Saat ini admin tidak bisa mereset kata sandi akun lain, akun nonaktif tidak bisa diaktifkan lagi, dan `ADMIN_EMAIL`/`ADMIN_PASSWORD` diabaikan bila tabel pengguna sudah berisi. Admin yang lupa kata sandi atau terkunci (siapa pun yang tahu emailnya bisa mengunci login 15 menit berulang kali) kehilangan akses.

- A. Skrip perintah di server (`docker compose run backend ...`) untuk: mengatur ulang kata sandi akun, membuka kunci login email, mengaktifkan kembali akun nonaktif, dan menjadikan akun sebagai admin; tidak ada layar baru; setiap pemakaian dicatat di log
- B. Seperti A, ditambah di layar Akun: admin bisa mengatur ulang kata sandi akun lain dan membuka kunci login (menambah endpoint dan layar)
- C. Tidak ada jalur pemulihan di v1; diterima sebagai risiko dengan prosedur manual lewat database
- X. Other (please specify)

[Answer]: B

## Q4. [Keamanan] Pembatasan tebak kata sandi lama (temuan review R-02)

`POST /api/v1/auth/password` meminta kata sandi lama; tanpa pembatas, sesi yang tercuri bisa menebak kata sandi tanpa batas.

- A. Kata sandi lama yang salah dihitung ke penghitung yang sama dengan login email pengguna itu (5 salah beruntun mengunci 15 menit, dijawab 429); login yang berhasil mengosongkannya
- B. Penghitung terpisah khusus ganti kata sandi per pengguna (5 salah mengunci ganti kata sandi 15 menit, login tetap bisa)
- X. Other (please specify)

[Answer]: A

## Q5. [Observabilitas] Catatan peristiwa akun

- A. Log JSON ke stdout (seperti U1/U2) untuk: login berhasil, login gagal, penguncian, logout, akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti, 401/403 per rute; berisi waktu, jenis peristiwa, id pengguna (bila ada), id sesi, alamat IP, dan id permintaan; kata sandi, token, hash, dan isi cookie tidak pernah dicatat; tanpa tabel audit di database
- B. Seperti A, ditambah tabel audit di database yang bisa dilihat admin (menambah entitas dan layar)
- X. Other (please specify)

[Answer]: B

## Q6. [Keandalan] Migrasi dan start backend

Unit ini mengubah skema (`User`, `Session`, `LoginThrottle`) dan mengisi `createdByUserId` pada DDCL yang sudah ada.

- A. Seperti U2: cadangan database otomatis sebelum migrasi U4 dijalankan; migrasi dalam satu transaksi (gagal berarti dibatalkan semua); backend tidak start bila admin pertama tidak bisa dibuat atau migrasi gagal; "admin pertama" untuk mengisi DDCL lama didefinisikan sebagai admin dengan `createdAt` paling awal
- B. Tanpa cadangan otomatis; sisanya seperti A
- X. Other (please specify)

[Answer]: A

## Q7. [Keamanan] Cookie, CORS, dan pembawa sesi (temuan review R-05, R-10)

Backend dan frontend berbeda origin, sehingga permintaan preflight (OPTIONS) tidak membawa cookie.

- A. Variabel lingkungan `COOKIE_SECURE` (bawaan `false` di Compose lokal, `true` bila di belakang HTTPS) menentukan atribut Secure cookie, dan `ALLOWED_ORIGINS` menjadi daftar origin untuk CORS dan pemeriksaan Origin; OPTIONS/preflight dikecualikan dari pemeriksaan sesi dan role; satu-satunya pembawa sesi yang diterima server adalah cookie `ddcl_session` (`sessionToken` di badan respons tidak dipakai sebagai header Authorization di v1)
- B. Seperti A, tetapi server juga menerima `Authorization: Bearer <sessionToken>`
- X. Other (please specify)

[Answer]: B

## Q8. [Proses] Temuan Minor review Functional Design

Delapan temuan Minor (R-03 sampai R-10) menyangkut kerapian dokumen dan detail: catatan deviasi role di `requirements.md`/`unit-of-work.md`, respons 401/403/429 di Contract 2–5 beserta tabel role minimal tiap rute lama, kasus tepi `PATCH /users/{id}` (404, idempoten, atomik), kardinalitas `0..*` di entitas, dan nama implementasi di aturan. Functional Design U4 sudah tercatat selesai.

- A. Tidak membuka kembali Functional Design: perbaikan dimasukkan ke artefak NFR (tabel role minimal tiap rute, kasus tepi PATCH, retensi) dan diselesaikan saat NFR Design dan Code Generation (termasuk memperbarui `contract-summary.md` dan mencatat deviasi role di `requirements.md`); artefak Functional Design tidak diubah
- B. Buka kembali Functional Design sekarang untuk memperbaiki artefaknya (menambah satu putaran review sebelum NFR)
- X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
