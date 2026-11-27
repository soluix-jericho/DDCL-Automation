# NFR Design — u4-user-accounts — Performance

Sumber: `nfr-requirements/performance-requirements.md` (NFR1.20–NFR1.24), `scalability-requirements.md` (NFR1.25), `functional-spec.md` W2, W3, W11, jawaban `nfr-design-questions.md` Q1 dan Q3.

Angka yang berlaku untuk hash bersamaan adalah **2** (NFR1.24). Sisa penyebutan "4 hash" di `security-requirements.md` NFR2.33 dan `scalability-requirements.md` (butir multi-instance) adalah salah ketik yang dibawa dari draf awal; dokumen desain ini yang dipakai Code Generation.

## Anggaran Waktu per Permintaan

| Tahap | Anggaran | Cara |
|---|---|---|
| Baca token dan cari sesi | ≤ 10 ms | Satu kueri bergabung `Session` ke `User` lewat indeks unik `tokenHash` (Q3 A: tanpa cache) |
| Geser `lastSeenAt` | ≤ 5 ms, paling banyak sekali per menit per sesi | `UPDATE ... WHERE id = ? AND lastSeenAt < now() - interval '1 minute'`; tanpa transaksi terpisah dan tanpa menunggu hasilnya untuk menjawab |
| Pemeriksaan Origin dan role | < 1 ms | Perbandingan dalam memori terhadap `ALLOWED_ORIGINS` dan role minimal rute |
| Jumlah | ≤ 50 ms p95 (NFR1.21) | |

## Login (NFR1.20, NFR1.24)

- Biaya utama adalah satu hash scrypt (N=32768, r=8, p=1, `maxmem` 64 MiB, sekitar 122 ms terukur).
- Pintu hash: penghitung dalam proses dengan 2 slot dan antrean FIFO. Permintaan yang menunggu lebih dari 5 detik dijawab 503 generik dengan `Retry-After`, tanpa memegang koneksi database selama menunggu.
- Terburuk untuk 4 login serentak: 2 berjalan dan 2 menunggu satu putaran, sekitar 250 ms.
- Urutan kerja login mengikuti protokol A, hash, B di `security-design.md` (Penguncian): transaksi A (upsert, kunci baris, periksa `lockedUntil`), antre dan jalankan hash di luar transaksi, lalu transaksi B (upsert, kunci baris, **periksa ulang `lockedUntil`**, lalu hitung gagal atau terbitkan sesi dan kosongkan penghitung). Dua transaksi ini pendek (masing-masing beberapa kueri berindeks) dan koneksi database tidak dipegang selama hash berjalan; pemeriksaan ulang di B tidak boleh dilewati.
- Email tidak terdaftar memakai hash tiruan yang melewati pintu yang sama, sehingga waktunya tidak membedakan email (NFR2.20).

## Daftar Audit (NFR1.23)

- Pembagian halaman memakai kursor `(occurredAt, id)` menurun; respons memuat kursor halaman berikutnya dan tidak menghitung total (menghindari `COUNT(*)` pada 500.000 baris).
- Indeks: `(occurredAt DESC, id DESC)` dan `(type, occurredAt DESC, id DESC)` untuk filter jenis; filter tanggal memakai rentang pada `occurredAt`.
- Ukuran halaman bawaan 50, maksimum 100; nilai di luar rentang atau filter tidak sah dijawab 400.

## Hal yang sengaja tidak dilakukan

- Tanpa cache sesi (Q3 A): pencabutan dan perubahan role berlaku seketika, dan biayanya (satu kueri berindeks) sudah di dalam anggaran 50 ms.
- Tanpa pemrosesan asinkron untuk login selain pintu hash.

## Verifikasi

Sesuai `performance-requirements.md` Verifikasi: 100 login termasuk gelombang 4 serentak, 200 permintaan terautentikasi, dan 50 permintaan daftar audit pada seed 500.000 baris; skenario antrean penuh membuktikan 503.

## Assumptions & Open Questions

None.
