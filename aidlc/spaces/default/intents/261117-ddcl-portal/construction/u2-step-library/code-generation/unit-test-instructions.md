# Unit Test Instructions — u2-step-library

Metodologi: **test-after** per lapisan (Testing Contract). Strategi: Standard (5–8 test per komponen, plus test integrasi untuk batas penting). Lantai scope `mvp`: coverage baris 80% per app dan eksekusi di CI sebelum merge.

## Kerangka dan konfigurasi

- Backend dan frontend: Vitest 2.1.8 (sudah ada dari U1). Backend memakai PostgreSQL nyata (database uji `*_test`, dibuat dan dimigrasi oleh `tests/global-setup.ts`); frontend memakai jsdom dan Testing Library.
- Test U2 ada di `backend/tests/u2/` dan `frontend/tests/u2/`. Test beban terpisah di `backend/tests/load/` (dikecualikan dari suite biasa; konfigurasi `vitest.load.config.ts`).
- Prasyarat (satu kali): `.env` berisi `TEST_DATABASE_URL` (contoh di `.env.example`) dan layanan `db` berjalan: `docker compose up -d db`.

## Perintah yang dapat dijalankan (dibatasi pada Unit ini)

Setelah kode berubah, image dibangun ulang lebih dulu karena kode disalin ke image:

```bash
docker compose build backend frontend
```

Backend, hanya test U2 (jalan sebelum test pertama setelah runner siap):

```bash
docker compose run --rm backend npx vitest run tests/u2
```

Frontend, hanya test U2:

```bash
docker compose run --rm --no-deps frontend npx vitest run tests/u2
```

Per lapisan (dipakai selama pembangunan, tiap lapisan diuji sebelum lanjut):

```bash
docker compose run --rm backend npx vitest run tests/u2/data-model.test.ts tests/u2/migration.test.ts
docker compose run --rm backend npx vitest run tests/u2/stepText.test.ts tests/u2/stepRules.test.ts
docker compose run --rm backend npx vitest run tests/u2/stepRepository.test.ts tests/u2/bundleRepository.test.ts tests/u2/snapshot.test.ts tests/u2/concurrency.test.ts
docker compose run --rm backend npx vitest run tests/u2/stepsApi.test.ts tests/u2/bundlesApi.test.ts tests/u2/writeLimiter.test.ts
docker compose run --rm backend npx vitest run tests/u2/startProd.test.ts
```

Regresi U1 yang disesuaikan (harus tetap hijau):

```bash
docker compose run --rm backend npx vitest run tests/u1
docker compose run --rm --no-deps frontend npx vitest run tests/u1
```

Test beban (manual atau mingguan di CI, bukan di suite biasa):

```bash
docker compose run --rm backend npx vitest run -c vitest.load.config.ts
```

## Target coverage

- Lantai proyek: 80% baris per app (`backend/vitest.config.ts` dan `frontend/vitest.config.ts` memuat `thresholds.lines: 80`; tidak diubah). **Lantai ini diukur Build and Test pada suite penuh** dengan `npx vitest run --coverage` per app; satu run Unit-scoped tidak menjadi hakim lantai itu, dan ambangnya tidak boleh diturunkan agar run lolos.
- Target Unit ini: semua modul baru (`stepText`, `stepRules`, `libraryTx`, `stepRepository`, `bundleRepository`, `writeLimiter`, `libraryRoutes`, komponen `library/*`) mendekati 90% baris. Cabang galat (409, 503, 413, 404, deadlock habis pengulangan) wajib tersentuh.

## Mocking dan stub

- Database: **tidak di-mock**. Test repository dan API memakai PostgreSQL uji nyata, karena kunci baris, indeks fungsional, dan `stepSnapshot` hanya terbukti pada database sungguhan.
- Konkurensi: dua transaksi dibuat dengan `Promise.all` dan penghalang (`pg_sleep` atau gerbang `Promise` di dalam `fn`) agar urutan bersilang terjadi deterministik; hasil dinilai dari keadaan akhir database (tanpa 500, tanpa posisi ganda).
- `pg_dump` dan `psql` untuk `start-prod.sh`: skrip stub di folder PATH sementara; `pg_dump` nyata dan pemulihan diperiksa manual (README).
- Frontend: `fetch` di-stub dengan router `"METHOD path"` seperti test U1; tidak ada panggilan jaringan nyata.
- Kegagalan database: klien Prisma ke host tak terjangkau (`createUnreachablePrisma`, U1).

## Data uji

- Setiap test backend memulai dari `truncateAll` (diperluas dengan tabel baru); data dibuat lewat fungsi pabrik kecil di `tests/u2/helpers.ts` (step dengan kolom/langkah/lampiran, bundle, DDCL dengan item bersnapshot).
- Payload batas ukuran dibangkitkan di kode (string berulang), tidak disimpan sebagai berkas; varian non-ASCII memakai karakter 4 byte.
- Test beban membangkitkan data lewat `INSERT ... SELECT generate_series(...)`; tidak ada data operasional nyata dan tidak ada kredensial di berkas.

## Pemeriksaan manual (tidak otomatis)

- Backup dan pemulihan dengan Docker Compose utuh (README, bagian Pemulihan): start dengan migrasi tertunda membuat `pre-migrate-*.dump` di volume `ddcl_backups`, lalu perintah pemulihan mengembalikan skema.
