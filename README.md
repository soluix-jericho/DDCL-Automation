# Portal DDCL Otomatis

Portal untuk menyusun dokumen DDCL dari Library Step yang bisa dipakai ulang, lalu mengekspornya ke Excel.
Monorepo dengan dua aplikasi terpisah: `backend/` (Node 20, Fastify, Prisma, ExcelJS) dan `frontend/` (React, Vite, Tailwind),
dengan PostgreSQL 16. Semuanya berjalan lokal lewat Docker Compose.

## Menjalankan

1. Salin `.env.example` menjadi `.env`, lalu ganti nilainya (`.env` tidak boleh dikomit).
   - `DATABASE_URL` memakai `?connection_limit=10` (ukuran pool koneksi). Jika `.env` Anda sudah ada dari versi sebelumnya,
     tambahkan bagian itu ke `DATABASE_URL`.
   - Backend memakai `POSTGRES_USER`, `POSTGRES_PASSWORD`, dan `POSTGRES_DB` untuk `psql` dan `pg_dump` (dibaca Compose,
     tidak ada variabel baru yang wajib).
2. Taruh file template Excel di folder `./template/`.
3. `docker compose up --build`
4. Buka `http://localhost:5173` (frontend) dan `http://localhost:3000/health` (backend).

Backend memulai dengan `backend/scripts/start-prod.sh`: cadangan basis data bila ada migrasi tertunda (lihat di bawah),
`prisma migrate deploy`, lalu server.

## Test

Kode disalin ke image, jadi bangun ulang image setelah kode berubah:

```bash
docker compose build backend frontend
docker compose up -d db
```

Test per Unit (contoh Unit `u2-step-library`):

```bash
docker compose run --rm backend npx vitest run tests/u2
docker compose run --rm --no-deps frontend npx vitest run tests/u2
```

Suite penuh dan coverage (lantai 80% baris per aplikasi):

```bash
docker compose run --rm backend npx vitest run --coverage
docker compose run --rm --no-deps frontend npx vitest run --coverage
```

Test backend memakai PostgreSQL sungguhan: `TEST_DATABASE_URL` di `.env` menunjuk ke basis data uji (namanya wajib memuat
`test`; dibuat dan dimigrasi otomatis).

### Test beban

Terpisah dari suite biasa (menanam 1.000 step, 100 bundle, 100.000 item checklist; p95 harus di bawah 2 detik):

```bash
docker compose run --rm backend npx vitest run -c vitest.load.config.ts
```

Di CI berjalan mingguan lewat `.github/workflows/load-test.yml` dengan snapshot 5 KB. Jalan penuh lokal memakai
`LOAD_SNAPSHOT_KB=20` (sekitar 2 GB disk).

## Cadangan basis data sebelum migrasi

Saat backend start dan ada migrasi yang akan diterapkan pada basis data yang sudah berisi, `start-prod.sh` membuat dump
`pre-migrate-<waktu UTC>.dump` di volume Docker `ddcl_backups` (di dalam container: `/backups`), lalu baru menerapkan migrasi.
Start tanpa migrasi tertunda tidak membuat dump. Jika dump gagal, backend tidak start (tidak ada migrasi tanpa cadangan).
Dump terbaru yang disimpan: 10 (ubah dengan `BACKUP_KEEP` di `.env`).

Dump berisi data operasional tanpa masking, karena itu disimpan di volume Docker, bukan di folder repo (OneDrive/git).
Folder itu tidak terlihat di Explorer. Salin keluar bila perlu:

```bash
docker compose run --rm --no-deps --entrypoint ls backend -l /backups
```

### Pemulihan dari dump

Dipakai bila migrasi atau kode baru bermasalah dan basis data harus kembali ke keadaan sebelum migrasi.
Ini **menghapus seluruh isi basis data saat ini** dan menggantinya dengan isi dump.

1. Hentikan backend: `docker compose stop backend`
2. Lihat daftar dump dan pilih berkas yang dibuat tepat sebelum migrasi bermasalah (nama memuat waktu UTC):
   `docker compose run --rm --no-deps --entrypoint ls backend -l /backups`
3. Kosongkan skema, lalu pulihkan. Entrypoint diganti agar `start-prod.sh` tidak ikut berjalan, dan `--clean` tidak dipakai
   karena skema sudah dikosongkan (tabel baru ikut hilang, dan `_prisma_migrations` kembali dari dump):

   ```bash
   docker compose run --rm --no-deps --entrypoint sh backend -c 'psql -d "$PGDATABASE" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && pg_restore -d "$PGDATABASE" /backups/NAMA-DUMP.dump'
   ```

   Variabel `PGHOST`, `PGUSER`, `PGPASSWORD`, dan `PGDATABASE` sudah diisi Compose dari `.env`.
4. Jalankan kode versi sebelumnya (`git revert` atau checkout komit lama), lalu `docker compose up --build`.

### Peringatan: `docker compose down -v`

`docker compose down -v` menghapus **semua volume**: data PostgreSQL (`ddcl_pgdata`) **dan** semua cadangan (`ddcl_backups`).
Jangan memakai `-v` kecuali memang ingin mengosongkan semuanya. `docker compose down` biasa aman.

### Pemeriksaan manual (butuh Docker Compose utuh)

Test otomatis memakai `pg_dump` palsu untuk logika skrip dan `pg_dump` 16 nyata terhadap basis data uji. Alur lengkap dicoba manual:
jalankan versi sebelum Unit ini sampai basis data berisi, lalu `docker compose up --build` dengan versi baru. Pastikan
`pre-migrate-*.dump` muncul di `ddcl_backups`, lalu coba pemulihan di atas.
