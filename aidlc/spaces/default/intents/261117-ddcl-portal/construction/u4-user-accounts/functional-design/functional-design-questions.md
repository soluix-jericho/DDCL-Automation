# Functional Design — u4-user-accounts — Questions

## Sources

- [memory] `unit-of-work.md` U4: entitas User penuh, alur login/logout, middleware penegakan sesi di seluruh endpoint, layar login dan manajemen akun dasar; stub sesi dev-mode U1 dicabut di semua endpoint U1–U3.
- [memory] `requirements.md` FR9 (lebih dari satu akun), NFR2 (semua endpoint mewajibkan sesi valid); model otorisasi detail (role, kepemilikan DDCL) Out of Scope v1.
- [memory] `stories.md` US6.2 / AC6.2.1: akun baru bisa login dan memakai seluruh fitur seperti pengguna lain.
- [memory] `contract-summary.md` Contract 1: `POST /api/v1/auth/login` (email, password → sessionToken, user), `POST /api/v1/auth/logout` (204 / 401), `GET /api/v1/auth/me`.
- [memory] Kode U1: cookie `ddcl_session` dengan nilai tetap `dev-session`, hook yang tidak pernah menolak permintaan; `ChecklistItem`/DDCL belum punya pembuat per pengguna.
- [assumption] Pengguna masuk dengan email dan kata sandi; tidak ada login pihak ketiga (SSO) di v1. Belum dikonfirmasi.

## Q1. [Produk] Bagaimana akun pertama dan akun berikutnya dibuat

Setelah stub dicabut, harus ada akun agar bisa login. Layar "manajemen akun dasar" di unit ini perlu tahu siapa boleh membuat akun.

- A. Akun pertama dibuat otomatis saat backend start dari variabel lingkungan (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) bila tabel pengguna masih kosong; sesudah itu pengguna yang sudah login boleh menambah akun baru lewat layar Akun (tanpa role, semua pengguna setara)
- B. Tidak ada layar tambah akun; semua akun dibuat lewat skrip perintah di server (`docker compose run ...`)
- C. Halaman pendaftaran terbuka (siapa pun bisa daftar)
- X. Other (please specify)

[Answer]: A, kalau bisa ada role, jadi ada role admin (semua), editor, bisa check list ddcl yang sudah dibuat dan buat ddcl, dan viewer (hanya bisa check list)

## Q2. [Keamanan] Kata sandi

- A. Disimpan sebagai hash (scrypt bawaan Node, tanpa dependensi baru) dengan garam acak; minimal 10 karakter, tanpa aturan kompleksitas lain; pengguna bisa mengganti kata sandinya sendiri (harus memberi kata sandi lama)
- B. Seperti A, tetapi tanpa fitur ganti kata sandi di v1 (diganti lewat skrip server)
- C. Seperti A dengan `argon2` (tambah dependensi baru)
- X. Other (please specify)

[Answer]: A

## Q3. [Keamanan] Sesi login

Cookie `ddcl_session` U1 dipertahankan sebagai pembawa sesi (httpOnly, SameSite=Lax); token sesi acak disimpan sebagai hash di database sehingga bisa dicabut.

- A. Sesi berlaku 8 jam sejak aktivitas terakhir (geser tiap permintaan), maksimum 7 hari sejak login; logout mencabut sesi; `sessionToken` di badan respons login tetap ada sesuai kontrak
- B. Sesi 30 hari tanpa batas aktivitas (nyaman, kurang aman)
- C. Sesi hingga browser ditutup (tanpa pembaruan)
- X. Other (please specify)

[Answer]: A

## Q4. [Keamanan] Perlindungan tebak kata sandi

- A. Batasi login gagal: 5 kegagalan beruntun untuk satu email mengunci login email itu 15 menit (pesan generik, tidak membocorkan apakah email ada); dihitung di database, tanpa layanan baru
- B. Tanpa pembatasan di v1 (portal hanya lokal)
- X. Other (please specify)

[Answer]: A

## Q5. [Produk] Mengelola akun yang ada

- A. Pengguna bisa menonaktifkan akun lain (bukan akunnya sendiri, dan tidak boleh menonaktifkan akun aktif terakhir); akun nonaktif tidak bisa login dan sesinya dicabut; akun tidak dihapus (agar DDCL lama tetap tahu pembuatnya)
- B. Tidak ada nonaktifkan/hapus di v1; hanya tambah akun dan ganti kata sandi sendiri
- C. Akun bisa dihapus permanen
- X. Other (please specify)

[Answer]: A

## Q6. [Produk] Pembuat DDCL

Tahap ini tidak membuat aturan izin, tetapi DDCL baru perlu mencatat siapa pembuatnya untuk rekap U5 (judul/pembuat/tanggal).

- A. DDCL baru mencatat `createdByUserId` dari sesi; DDCL lama (U1, dibuat sebelum login) diisi akun pertama lewat migrasi; semua pengguna tetap boleh melihat dan mengedit semua DDCL (sesuai Out of Scope)
- B. Pembuat tidak dicatat sekarang; ditambahkan di U3/U5
- X. Other (please specify)

[Answer]: A

## Q7. [Teknis] Mencabut stub dev-mode

- A. Dicabut penuh: semua rute `/api/v1/*` kecuali `POST /auth/login` dan health check menjawab 401 tanpa sesi valid; test U1–U3 memakai helper login; tidak ada saklar untuk mematikan autentikasi
- B. Dicabut, tetapi ada variabel `AUTH_DISABLED=true` untuk pengembangan lokal
- X. Other (please specify)

[Answer]: A

## Q8. [Teknis] Kerentanan penyalahgunaan dari browser (CSRF)

Karena sesi memakai cookie, permintaan tulis dari situs lain bisa ikut membawa cookie.

- A. Cukup SameSite=Lax ditambah pemeriksaan header `Origin` pada rute tulis (POST/PATCH/DELETE) yang harus sama dengan origin frontend yang diizinkan (CORS U1)
- B. Token CSRF terpisah per sesi pada setiap permintaan tulis
- X. Other (please specify)

[Answer]: A

## Follow-up (dari jawaban Q1: permintaan role admin / editor / viewer)

Jawaban Q1 menambah role, padahal `requirements.md` menaruh model otorisasi detail (role, kepemilikan DDCL) di Out of Scope v1, dan Q5/Q6 ditulis dengan asumsi semua pengguna setara. Tiga hal perlu diputuskan sebelum artefak dibuat.

## Q9. [Produk] Role masuk ke U4 atau ditunda

- A. Role masuk U4 sebagai perubahan scope yang tercatat (sumber: permintaan Anda di Q1); Out of Scope di requirements dianggap digeser untuk tiga role sederhana ini, tanpa kepemilikan per-DDCL
- B. Role ditunda ke unit berikutnya; U4 tetap semua pengguna setara (Q1 opsi A apa adanya)
- X. Other (please specify)

[Answer]: A

## Q10. [Produk] Hak tiap role

Saya mengartikan "check list" sebagai melihat daftar dan isi DDCL. Koreksi bila salah.

- A. **admin**: semua fitur + kelola akun (tambah, nonaktifkan, ubah role). **editor**: lihat, buat, ubah DDCL, kelola step library/objek, ekspor Excel; tidak bisa kelola akun; tidak bisa menghapus/arsip. **viewer**: hanya baca (lihat DDCL, step library, riwayat) dan ekspor Excel; tidak bisa ubah apa pun
- B. Seperti A, tetapi viewer tidak bisa ekspor Excel
- C. Seperti A, tetapi editor juga bisa menghapus/arsip DDCL
- X. Other (please specify)

[Answer]: A

## Q11. [Produk] Kelola akun dan penugasan role

Merevisi Q5/Q6 untuk model role.

- A. Hanya admin yang menambah akun (menentukan role awal), mengubah role, dan menonaktifkan akun; admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan rolenya; akun pertama dari `ADMIN_EMAIL` berrole admin; editor dan admin boleh mengedit semua DDCL (bukan hanya miliknya); `createdByUserId` tetap dicatat; DDCL lama diisi akun pertama
- B. Seperti A, tetapi editor hanya boleh mengedit DDCL buatannya sendiri
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

Ringkasan semua jawaban (Q1–Q14) dibacakan di percakapan dan mencakup putaran revisi.

- Looks correct
- Request changes

[Answer]: Looks correct

## Q12. [Produk] Admin mengatur ulang kata sandi akun lain

Putaran revisi: Functional Design dibuka kembali dari jawaban NFR Requirements Q3, Q5, Q7, Q8. Jawaban NFR menambah isi Functional Design: admin mengatur ulang kata sandi dan membuka kunci login lewat layar Akun (NFR Q3 B), tabel audit yang bisa dilihat admin (NFR Q5 B), `Authorization: Bearer` diterima selain cookie (NFR Q7 B), kata sandi lama yang salah dihitung ke penghitung login (NFR Q4 A), dan perbaikan temuan Minor review R-03 sampai R-10 (NFR Q8 B). Tiga detail (Q12 sampai Q14) perlu keputusan Anda.

- A. Admin mengetik kata sandi baru untuk akun itu (aturan sama dengan BR4.2); semua sesi akun itu dicabut dan kunci login emailnya dibuka; admin menyampaikan kata sandi di luar portal; pemilik bisa menggantinya sendiri
- B. Sistem membuat kata sandi sementara acak yang ditampilkan satu kali ke admin; akun wajib mengganti kata sandi saat login berikutnya (menambah status wajib-ganti)
- X. Other (please specify)

[Answer]: A

## Q13. [Produk] Tabel audit dan layar audit

- A. Tabel `AuditEvent` hanya-tambah (waktu, jenis peristiwa, pelaku, akun sasaran, alamat IP, keterangan ringkas tanpa kata sandi/token/hash) untuk: login berhasil/gagal/terkunci, logout, akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti atau diatur ulang admin, kunci dibuka; admin melihat daftar terbaru dengan filter jenis dan tanggal (hanya baca); disimpan permanen (sesuai NFR4)
- B. Seperti A, tetapi disimpan 1 tahun lalu dihapus otomatis
- X. Other (please specify)

[Answer]: B

## Q14. [Teknis] Cookie dan Bearer bersamaan

- A. Server menerima cookie `ddcl_session` atau `Authorization: Bearer <sessionToken>`; bila keduanya ada, Bearer dipakai; permintaan yang diautentikasi lewat Bearer tidak kena pemeriksaan Origin (tidak rentan CSRF), yang lewat cookie tetap kena (BR4.15)
- B. Cookie didahulukan bila keduanya ada; pemeriksaan Origin berlaku pada semua permintaan tulis yang membawa cookie
- X. Other (please specify)

[Answer]: A
