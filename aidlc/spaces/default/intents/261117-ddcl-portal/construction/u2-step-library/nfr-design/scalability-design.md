# NFR Design — u2-step-library — Scalability Design

Sumber: `nfr-requirements/scalability-requirements.md` (NFR1.9, NFR4.2, Konkurensi), jawaban `nfr-design-questions.md` Q1, Q2, Q3.

## Arsitektur Scaling

Satu proses backend dan satu PostgreSQL di Docker Compose lokal; tanpa scaling horizontal, load balancer, atau partisi (NFR1.9: kurang dari 20 pengguna, sampai 1.000 step dan 100 bundle). Pembatas tulis serentak di memori (maksimal 4 permintaan tulis Library dalam proses, `performance-design.md`) berlaku per proses, cukup karena hanya ada satu proses; bila backend nanti dijalankan multi-instance, penguncian baris database tetap menjaga kebenaran, hanya batas serentaknya yang menjadi per instance.

## Kapasitas dan Pemicu

| Pemicu | Tindakan |
|---|---|
| Pencarian atau daftar p95 mendekati 1 detik di data nyata | Tambah indeks `pg_trgm` pada `Step.name` lewat migrasi, lalu paginasi daftar. |
| Jumlah step mendekati 1.000 | Tambah paginasi daftar (`limit`/`offset`). |
| Disk Library dan snapshot mendekati kapasitas volume | Tinjau retensi snapshot di versi berikutnya (NFR4.2). |

Indeks `ChecklistItem.stepId` sudah ada sejak migrasi U2 (Q2), bukan pemicu.

## Konkurensi (menutup R-01)

Semua transaksi tulis Library mengikuti satu aturan penguncian, sehingga urutan kunci tidak pernah bersilang:

Urutan global kunci: semua baris `StepBundle` (id naik), lalu semua baris `Step` (id naik). Setiap aksi tulis memakai protokol dua fase berikut (menutup lock-then-read race):

1. **Baca kandidat (tanpa kunci):** hitung himpunan kandidat dari database: id Step (step itu, pasangan rollback lama dan baru, step yang akan kehilangan pasangan karena menunjuknya, semua anggota bundle yang terdampak) dan id StepBundle (bundle yang memuat salah satu step itu, dan bundle yang disimpan atau dihapus).
2. **Kunci:** `SELECT id FROM "StepBundle" WHERE id = ANY(${bundleIds}::text[]) ORDER BY id FOR UPDATE`, lalu `SELECT id FROM "Step" WHERE id = ANY(${stepIds}::text[]) ORDER BY id FOR UPDATE` (Q1), lewat klien `tx` dari transaksi interaktif.
3. **Baca ulang di dalam kunci dan verifikasi:** hitung ulang himpunan kandidat; bila sama atau subset dari yang terkunci, lanjutkan; bila ada id baru (pasangan atau keanggotaan bundle berubah di antara langkah 1 dan 2), batalkan transaksi dan ulangi dari langkah 1 (dihitung dalam batas 2 pengulangan di butir 5).
4. Aturan ini berlaku untuk **semua** aksi tulis: PATCH step, **DELETE step (mengunci semua `StepBundle` yang memuat step itu sebelum mengunci Step-nya, karena BR2.7 menghapus bundle yang kehilangan anggota forward terakhir dan merapatkan posisi anggota)**, dan simpan atau hapus bundle. Dengan begitu posisi `(bundleId, position)` dan `(columnId, position)` tidak pernah bentrok.
5. Bila PostgreSQL tetap menjawab deadlock (`40P01`) atau kegagalan serialisasi (`40001`, Prisma `P2034`), transaksi diulang otomatis (bersama pengulangan butir 3, total maksimal 2 kali); bila masih gagal, jawab 409 "coba lagi" (bukan 500). Pengulangan aman karena seluruh transaksi sudah dibatalkan; ini berbeda dari retry klien atas POST yang dilarang `contract-summary.md` Q5.
5. Hasil akhirnya persis satu salinan utuh dari penyimpan terakhir (terakhir menang, Q5 inti), karena PATCH mengganti seluruh kolom, langkah, dan lampiran dalam satu transaksi.

Test wajib: (a) dua transaksi bersilang (A mengubah step X yang berpasangan dengan Y, B mengubah Y sekaligus menghapus X) tanpa 500 dan tanpa kolom ganda; (b) dua PATCH bersamaan pada step yang sama menghasilkan salinan utuh milik yang terakhir; (c) hapus step bersamaan dengan simpan bundle yang memuat step itu; (d) PATCH yang mengganti pasangan rollback bersamaan dengan hapus pasangan lama. Semuanya berakhir dengan keadaan konsisten (tanpa 500, tanpa posisi ganda).

Batas pool: `connection_limit=10` pada `DATABASE_URL` backend (tulis maksimal 4 serentak, sisanya untuk baca dan rute U1); `P2024` (pool habis) dipetakan ke 503 dengan `Retry-After` (lihat `reliability-design.md`).

## Assumptions & Open Questions

None.
