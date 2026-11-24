# NFR Design — u2-step-library — Questions

## Sources

- [memory] `nfr-requirements/` U2 (NFR1.5–NFR1.11, NFR2.6–NFR2.9, NFR3.4–NFR3.6, NFR4.2–NFR4.7) dan `reviews/review-01.md` (R-01 sampai R-06 masih terbuka dan diselesaikan di desain ini).
- [memory] `functional-spec.md` (Alur 3–5: edit, hapus, bundle yang menyentuh beberapa step sekaligus).

## Q1. [Arsitek] Urutan kunci dan penanganan deadlock (R-01)

Satu transaksi bisa mengunci banyak baris Step (step itu, pasangan rollback, semua anggota bundle).

- A. **Kunci semua baris Step yang terlibat dalam satu perintah `SELECT ... WHERE id IN (...) ORDER BY id FOR UPDATE` di awal transaksi (urut `id` naik), sehingga tidak ada urutan berlawanan. Bila PostgreSQL tetap menjawab deadlock (40P01) atau kegagalan serialisasi, transaksi diulang otomatis maksimal 2 kali, lalu 409 "coba lagi" (bukan 500).** Satu test dua transaksi bersilang membuktikannya
- B. Tanpa retry: deadlock langsung menjadi 409
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Indeks `ChecklistItem.stepId` dan data uji beban (R-02, R-05)

- A. **Indeks `ChecklistItem.stepId` menjadi bagian migrasi U2 (bukan menunggu pemicu). Test beban memakai 1.000 step, 100 bundle, 100.000 item dengan `stepSnapshot` berukuran realistis (sekitar 20 KB), 100 permintaan per rute, dan satu skenario 20 permintaan bersamaan**
- B. Tanpa indeks sampai lambat; test lebih ringan (jelaskan)
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek/Keamanan] Mitigasi body besar tanpa sesi dan batas ukuran (R-03, R-06)

- A. **`bodyLimit` 24 MiB untuk rute tulis Library (margin untuk escape `\uXXXX`), permintaan tulis serentak dibatasi 4 per proses lewat antrean sederhana (sisanya menunggu, bukan ditolak), dan risiko tetap dicatat sebagai syarat U4 (sesi)**
- B. Tetap 16 MiB tanpa pembatas serentak; hanya dicatat sebagai syarat U4
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek] Pencarian `%` dan `_` (R-04)

- A. **Escape manual `\`, `%`, `_` sebelum diberikan ke `contains`, dengan test wajib (`q` = `%` atau `_` hanya cocok literal)**
- B. Andalkan perilaku Prisma, hanya test
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
