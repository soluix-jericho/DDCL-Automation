# Functional Design — u3-ddcl-composition — Questions

## Sources

- [memory] `unit-of-work.md` U3: header Release Document lengkap dan validasi field wajib (US2.1), susun/urutkan/duplikasi baris step (US2.2), rollback otomatis (US2.3), Checklist Capture opsional (US2.4), status Draft → Sudah Dikirim dan read-only (US3.1), versi vN (US3.2), lock dengan pelepasan otomatis (US6.1).
- [memory] `requirements.md` FR1, FR3–FR6, FR10, FR10.1: durasi timeout lock sengaja belum ditetapkan dan diputuskan di Functional Design; versi DDCL tampil terpisah atau dikelompokkan di rekap juga masih terbuka.
- [memory] `stories.md` AC2.1.2 (pesan field wajib yang kosong), AC2.4.1 (field minimum Checklist Capture dirinci di Functional Design), AC3.2.1–AC3.2.2 (nama "<nama asli> v2", "v3").
- [memory] U2 `rules.md` BR2.8 dan BR2.14: step dipasang dengan snapshot per item checklist; sumber rollback dan urutan untuk bundle ditetapkan sementara dan harus ditanyakan ulang ke pengguna di Functional Design U3.
- [memory] U4 `contract-summary.md` (respons tambahan Contract 2–5): peta role mencantumkan `DELETE` DDCL sebagai admin, tetapi Contract 3 tidak memuat rute hapus DDCL.
- [memory] Kode U1/U4: `DdclDocument` kini berisi `title`, `status`, `createdByUserId`, `createdAt`; `ReleaseHeader` dan `ChecklistItem` (dengan `stepSnapshot` dan `parameterValues`) sudah ada; belum ada `sentAt`, `parentDdclId`, lock, `RollbackItem`, `CaptureNote`.

## Q1. [Produk] Batas waktu tidak aktif sebelum lock edit dilepas otomatis

Saat Anda mengedit sebuah DDCL, DDCL itu dikunci supaya orang lain hanya bisa membaca (FR10). Jika Anda meninggalkannya tanpa menutup dengan benar, kunci dilepas otomatis setelah beberapa menit tidak ada aktivitas simpan (FR10.1). Berapa lama?

- A. 15 menit
- B. 30 menit
- C. 60 menit
- X. Other (please specify)

[Answer]: A

## Q2. [Produk] Tampilan versi (v2, v3) di rekap DDCL

Saat Anda membuat revisi, hasilnya DDCL baru "<nama> v2" yang terhubung ke DDCL asal. Di halaman rekap (dibangun di U5), bagaimana versi itu tampil? Jawaban ini menentukan bentuk daftar DDCL dari API.

- A. Satu baris per DDCL, termasuk tiap versi, dengan kolom "revisi dari" yang menyebut DDCL induknya
- B. Dikelompokkan: satu baris per DDCL asli, dengan v2, v3 dan seterusnya dilipat di bawahnya
- X. Other (please specify)

[Answer]: X, misal ada judul ddcl nanti misal ada revisi v1 v2 gitu2 nanti bisa ada dropdown dari yang pertama sampai yang terakhir

## Q3. [Produk] Rollback saat sebuah bundle dipasang ke DDCL

Sebuah bundle (kumpulan step di Library) punya urutan step forward dan rangkaian rollback sendiri, jumlahnya boleh berbeda (aturan U2 BR2.14). Saat bundle dipasang, rollback apa yang masuk ke bagian Rollback & Recovery Plan? Pasangan rollback per step dari anggota bundle tidak dipasang tambahan.

- A. Rangkaian rollback bundle, dalam urutan yang Anda simpan di bundle (tidak dibalik otomatis)
- B. Rangkaian rollback bundle, dibalik otomatis (dari yang terakhir ke yang pertama)
- C. Pasangan rollback tiap step forward anggota bundle, seperti bila step dipasang satu per satu
- X. Other (please specify)

[Answer]: A

## Q4. [Produk] Urutan rollback bila step dipasang satu per satu

Setiap step forward yang punya pasangan rollback di Library otomatis membawa rollback-nya ke DDCL (FR4.1). Dalam bagian Rollback & Recovery Plan, urutannya bagaimana?

- A. Berkebalikan dengan urutan step forward (step terakhir dibatalkan lebih dulu); ikut berubah bila Anda mengurutkan ulang checklist
- B. Sama dengan urutan step forward
- C. Urutan bebas yang bisa Anda atur sendiri, terpisah dari checklist
- X. Other (please specify)

[Answer]: C

## Q5. [Produk] Field header yang wajib diisi

Header Release Document punya tujuh field: Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, Technical Change (FR1). Sistem menolak melanjutkan dan menyebut field yang masih kosong (AC2.1.2), dan data yang sudah diisi tidak hilang. Field mana yang wajib?

- A. Semua tujuh wajib
- B. Wajib: Date, Impacted System, Environment, Release Objective. Opsional: Start Date, Phase/Release #, Technical Change
- C. Hanya Date dan Impacted System yang wajib; sisanya opsional
- X. Other (please specify)

[Answer]: X, yang Opsional hanya Technical Change

## Q6. [Produk] Isi minimum Checklist Capture per step

Checklist Capture mencatat bukti eksekusi per step dan boleh versi paling sederhana (FR5). Field apa yang tersedia per step, semuanya boleh dikosongkan?

- A. Satu kotak catatan teks bebas
- B. Catatan teks, status eksekusi (Belum, Berhasil, Gagal), dan waktu eksekusi
- C. Seperti B, ditambah nama pelaksana dan tautan/nama berkas bukti
- X. Other (please specify)

[Answer]: X, itu biarkan saja untuk saat ini yang penting ada saja tablenya untuk isinya biarkan saja kosoong (seperti template)

## Q7. [Produk] Tanggal kirim saat menandai "Sudah Dikirim"

DDCL dikirim ke klien secara manual, lalu Anda menandainya (FR6). Tanggal kirim yang tercatat berasal dari mana?

- A. Otomatis saat Anda menekan tombol (tanggal dan jam saat itu), tidak bisa diubah
- B. Terisi tanggal hari ini, tetapi Anda boleh mengubahnya (mis. menandai belakangan)
- X. Other (please specify)

[Answer]: A, tetapi bisa diubah dan ada 2 tombol kalau bisa terkirim pertama dan tereksekusi gitu jadi saya bisa check apa yang belum tereksekusi apa yang sudah

## Q8. [Produk] Isi DDCL baru saat membuat revisi (v2, v3)

Revisi dimulai dari status Draft dan terhubung ke DDCL asal (FR6.2). Apa yang disalin ke versi baru?

- A. Header, seluruh checklist (nilai yang sudah diisi) dan rollback; Checklist Capture dikosongkan karena bukti eksekusi milik versi lama
- B. Semuanya, termasuk Checklist Capture
- C. Hanya header; checklist disusun ulang dari awal
- X. Other (please specify)

[Answer]: B, checklist capture nanti jarang(tidakpernah) diisi jadi semua stepnya , karna untuk versi2 terbaru ini biasanya lebih kearah menambahkan atau mengurangi step/file

## Q9. [Produk] Menghapus DDCL

Aturan akses U4 menyediakan hak "hapus DDCL" khusus admin, tetapi kontrak API U3 belum memuat rute hapus, dan persyaratan data menyatakan tidak ada penghapusan otomatis di v1 (NFR4). Apakah DDCL bisa dihapus?

- A. Tidak ada hapus DDCL di v1; DDCL tersimpan permanen
- B. Admin boleh menghapus DDCL berstatus Draft saja (yang sudah dikirim tidak bisa)
- C. Admin boleh menghapus DDCL apa pun, setelah konfirmasi
- X. Other (please specify)

[Answer]: B

## Tindak lanjut dari jawaban Anda

## Q10. [Produk] Status "Tereksekusi" dan dua tombol (dari jawaban Q7)

Anda meminta dua tombol, "Terkirim" dan "Tereksekusi", supaya bisa melihat DDCL mana yang belum dan sudah dieksekusi. Itu menambah satu status setelah Sudah Dikirim. Bagaimana aturannya?

- A. Draft → Sudah Dikirim → Tereksekusi, berurutan. Tombol Tereksekusi baru muncul setelah Sudah Dikirim. Tanggal kirim dan tanggal eksekusi masing-masing terisi otomatis tetapi boleh Anda ubah. Isi DDCL (header, step) tetap read-only sejak Sudah Dikirim; hanya kedua tanggal itu yang masih bisa diubah
- B. Seperti A, tetapi Tereksekusi boleh langsung dari Draft (tanpa lewat Sudah Dikirim)
- C. Seperti A, dan status bisa dibatalkan satu langkah ke belakang (mis. salah menekan Tereksekusi), dicatat di riwayat
- X. Other (please specify)

[Answer]: A, tetapi misal sudah terkirim saya bisa membuat versi2 baru juga, misal ada tombol buat versi gitu atau yg lain lah, jadi ada 2 tombol, dan misal sudah tereksekusi berarti status sudah aman dan paling misal ada rollback klo bisa ada tombol atau atur yang bagus menurutmu gmn

## Q11. [Produk] Revisi dari DDCL yang sudah Tereksekusi (dari Q8 dan Q10)

Revisi (v2, v3) dari DDCL mana saja boleh dibuat?

- A. Dari DDCL berstatus Sudah Dikirim atau Tereksekusi (tidak dari Draft)
- B. Hanya dari Tereksekusi
- C. Dari status apa pun, termasuk Draft
- X. Other (please specify)

[Answer]: A

## Q12. [Produk] Kolom tabel Checklist Capture (dari jawaban Q6)

Tabel Checklist Capture dibuat seperti template Excel dengan isi kosong. Kolomnya mengikuti template. Apakah ini benar: tabel tampil dengan kolom persis seperti di template dan tidak ada isian yang dihubungkan ke step? Kalau Anda tahu kolomnya, tuliskan.

- A. Ya, kolom mengikuti template, isi kosong, tidak terhubung ke step dan tidak divalidasi
- X. Other (please specify) — mis. sebutkan kolomnya

[Answer]: A

## Q13. [Produk] Status "rollback" setelah Tereksekusi (dari jawaban Q11)

Anda menyebut DDCL yang sudah Tereksekusi dianggap aman, tetapi kadang perlu rollback, dan meminta tombol untuk itu. Saya usulkan: dari Tereksekusi ada tombol "Tandai Rollback" yang mengubah status menjadi "Di-rollback" (dengan tanggal yang bisa diubah dan catatan singkat), dan dari DDCL Sudah Dikirim atau Tereksekusi ada tombol "Buat Versi Baru". Apakah itu sesuai?

- A. Ya, sesuai usulan; "Di-rollback" adalah status akhir (read-only), versi baru dibuat lewat "Buat Versi Baru"
- B. Seperti A, tetapi tanpa catatan; hanya status dan tanggal
- C. Tidak ada status rollback; cukup "Buat Versi Baru" dan rollback dicatat di versi baru
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Ringkasan jawaban Anda sudah ditampilkan di percakapan. Sesuai?

- Looks correct
- Request changes

[Answer]: Looks correct
