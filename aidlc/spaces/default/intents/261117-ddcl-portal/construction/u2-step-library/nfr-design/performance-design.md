# NFR Design — u2-step-library — Performance Design

Sumber: `nfr-requirements/performance-requirements.md` (NFR1.5–NFR1.8, NFR1.10, NFR1.11), `scalability-requirements.md` (NFR1.9), `functional-spec.md` (Alur 2 lihat/cari, Alur 1 dan 3 simpan), jawaban `nfr-design-questions.md` Q2, Q3, Q4.

## Daftar dan Cari (NFR1.5, NFR1.11)

- `GET /api/v1/steps` memilih hanya kolom ringkasan (id, nama, kategori, jenis, pasangan rollback ada atau tidak, jumlah kolom, jumlah lampiran). Teks langkah dan isi lampiran tidak dibaca dari database. Detail lewat `GET /api/v1/steps/{id}`.
- `usageCount` dihitung dengan satu kueri `GROUP BY stepId` atas `ChecklistItem` untuk id yang ada di halaman, digabung di lapisan endpoint (BR2.6, ADR-002). Kueri ini dibantu **indeks `ChecklistItem.stepId` yang menjadi bagian migrasi U2** (Q2), bukan menunggu pemicu.
- Cari: `name ILIKE '%q%'` dengan `q` yang sudah di-escape manual untuk `\`, `%`, dan `_` (Q4), ditambah filter `category`. Tanpa indeks teks penuh untuk 1.000 step.
- Daftar bundle: satu kueri ringkasan (id, nama, kategori, jumlah anggota forward dan rollback). Isi lengkap anggota hanya lewat `GET /api/v1/bundles/{id}` (menutup temuan bentuk respons bundle).

```
-- ringkasan usageCount untuk id halaman ini
SELECT "stepId", count(*) FROM "ChecklistItem" WHERE "stepId" = ANY($1) GROUP BY "stepId"
```

## Simpan dan Hapus (NFR1.6, NFR1.7)

Satu transaksi Prisma interaktif per aksi tulis (lihat `reliability-design.md`). Simpan memakai pola hapus-lalu-isi-ulang untuk kolom, langkah, dan lampiran dengan `createMany`, sehingga jumlah pernyataan SQL tetap kecil walau step di batas maksimum (10 kolom × 50 langkah).

## Batas Ukuran (NFR1.8, NFR1.10)

- Validasi skema Fastify menolak 400 sebelum kode aplikasi berjalan. Batas yang tidak bisa diekspresikan skema (hitung titik kode setelah trim, byte UTF-8 lampiran 102.400) diperiksa di fungsi validasi yang dipanggil di awal handler.
- `bodyLimit` rute Library dinaikkan menjadi **24 MiB** (Q3). Turunan untuk klien yang didukung (frontend memakai `JSON.stringify`, yang tidak meng-escape karakter non-ASCII): teks langkah maksimum 1.000.000 titik kode × paling banyak 4 byte UTF-8 = 4 MB, ditambah lampiran 10 × 102.400 byte = 1 MB, jadi sekitar 5 MB per step dan sekitar 10 MB dengan `rollbackStep` inline, ditambah overhead JSON kecil. 24 MiB memberi margin sekitar 2,4 kali di atas 10 MB. **Di luar jaminan:** klien lain yang meng-escape semua karakter non-ASCII (`ensure_ascii`, 3 kali lipat untuk karakter 2 byte, hingga 3 kali untuk non-BMP) pada payload yang sudah di batas maksimum bisa melampaui 24 MiB dan mendapat 413; itu bukan kasus yang didukung. Lebih dari batas dijawab 413 dengan error generik.
- **Pembatas tulis serentak (menggantikan antrean)**: hook `onRequest` pada rute tulis Library menghitung permintaan tulis yang sedang berjalan, dihitung sejak sebelum body dibaca sampai respons dikirim. Maksimal **4** serentak; permintaan ke-5 dan seterusnya langsung dijawab **503** dengan `Retry-After: 2` sebelum body dibaca, jadi memori tidak tertahan oleh permintaan yang menunggu. Ini mengubah bunyi Q3 ("menunggu") menjadi "ditolak cepat dengan 503 agar klien mencoba lagi": antrean yang menampung body tidak membatasi memori sama sekali. Frontend mencoba lagi otomatis satu kali setelah `Retry-After` lalu menampilkan pesan. Estimasi memori terburuk: 4 × 24 MiB × sekitar 4 (string, objek, hasil validasi) di bawah 400 MiB. Baca (GET) tidak dibatasi.

## Verifikasi (NFR1.5–NFR1.7)

Test beban di Build and Test: seed 1.000 step, 100 bundle, dan 100.000 `ChecklistItem` dengan `stepSnapshot` sekitar 20 KB; ukur p95 dari 100 permintaan berurutan per rute, ditambah satu skenario dengan 20 permintaan bersamaan (NFR1.9). Test NFR1.6 memakai payload di batas NFR1.8 termasuk `rollbackStep` inline dan satu varian berisi karakter non-ASCII (UTF-8 mentah, 4 byte per titik kode, komposisi terburuk klien yang didukung), dan membuktikan tidak ada 413.

## Assumptions & Open Questions

None.
