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
   - Dari Unit akun pengguna (U4) ada variabel baru: `ALLOWED_ORIGINS` (menggantikan `FRONTEND_ORIGIN`; backend tidak
     start bila keduanya kosong), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `COOKIE_SECURE`, dan `TRUST_PROXY`.
     Salin bagian barunya dari `.env.example`.
2. Taruh file template Excel di folder `./template/`.
3. `docker compose up --build`
4. Buka `http://localhost:5173` (frontend) dan `http://localhost:3000/health` (backend).

Backend memulai dengan `backend/scripts/start-prod.sh`: cadangan basis data bila ada migrasi tertunda (lihat di bawah),
`prisma migrate deploy`, lalu server.

## Akun dan masuk pertama kali

Semua endpoint `/api/v1/*` (kecuali `POST /auth/login`) butuh sesi login. Ada tiga role: `viewer` (hanya baca dan ekspor),
`editor` (juga membuat dan mengubah step, bundle, DDCL), dan `admin` (juga menghapus, mengelola akun, melihat catatan audit).

- **Admin pertama.** Saat backend start dan belum ada akun sama sekali, backend membuat admin dari `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` (10 sampai 128 karakter), dan `ADMIN_NAME` (opsional) di `.env`. Nilai contoh
  `change-me-at-least-10-chars` ditolak: backend sengaja tidak start sampai Anda menggantinya. Setelah ada akun, ketiga
  variabel itu diabaikan sepenuhnya (tidak membuat akun dan tidak mengubah kata sandi); boleh dihapus dari `.env`.
  DDCL lama (dari U1 dan seterusnya) diisi pembuatnya dengan admin pertama itu.
- Masuk lewat `http://localhost:5173`, lalu buka tab **Akun** untuk menambah akun lain dan tab **Audit** untuk catatan
  peristiwa. Kata sandi diganti lewat **Ganti Kata Sandi** di menu pengguna.
- Lima kegagalan beruntun pada satu email mengunci email itu 15 menit; admin bisa membukanya dari tab Akun.
- **Cookie `dev-session` lama tidak lagi berlaku.** Stub dev-mode dicabut penuh tanpa saklar; semua permintaan tanpa sesi
  yang sah dijawab 401.

### Hosting di luar lokal (satu situs, HTTPS)

Untuk Docker Compose lokal biarkan `COOKIE_SECURE=false` (http). Bila portal dilayani di luar lokal: pakai **HTTPS**, set
`COOKIE_SECURE=true`, isi `ALLOWED_ORIGINS` dengan origin frontend yang sebenarnya, dan layani frontend dan backend dari
**satu situs** (domain terdaftar yang sama, mis. `portal.contoh.co.id` dan `api.contoh.co.id`). Cookie sesi bersifat
`SameSite=Lax`, jadi frontend di situs lain tidak akan mengirimnya. Set `TRUST_PROXY=true` hanya di belakang reverse proxy
yang Anda kendalikan, supaya alamat di log dan audit memakai `X-Forwarded-For`.

### Pemulihan akses (skrip di server)

Bila tidak ada admin yang bisa masuk (kata sandi lupa, terkunci, atau akun nonaktif), pakai skrip pemulihan di image
backend. Skrip ini jalur terakhir; jalur biasa adalah layar Akun. Setiap pemakaian ditulis ke catatan audit (pelaku
kosong, keterangan `recovery-script`).

```bash
docker compose run --rm backend node dist/scripts/recovery.js reset-password <email>
docker compose run --rm backend node dist/scripts/recovery.js unlock <email>
docker compose run --rm backend node dist/scripts/recovery.js reactivate <email>
docker compose run --rm backend node dist/scripts/recovery.js make-admin <email>
```

`reset-password` meminta kata sandi baru lewat **prompt tersembunyi** (tanpa gema) di terminal interaktif; ini juga
mencabut semua sesi akun itu dan membuka kunci loginnya. Tanpa terminal interaktif, kirim kata sandi lewat stdin dan
matikan alokasi TTY dengan `-T`:

```bash
printf '%s' 'kata-sandi-baru-panjang' | docker compose run --rm -T backend node dist/scripts/recovery.js reset-password <email> --password-stdin
```

Kata sandi **tidak boleh** diberikan sebagai argumen (`--password`, `-e VAR=nilai`): skrip menolaknya karena nilai itu
tersimpan di riwayat shell dan daftar proses.

### Migrasi U4 dan pemulihan penuh

Migrasi U4 (`20261127000000_u4_user_accounts`) menambah tabel `User`, `Session`, `LoginThrottle`, `AuditEvent` dan
menghapus kolom stub `DdclDocument.createdBy`. Seperti migrasi U2, `start-prod.sh` membuat dump pra-migrasi lebih dulu;
bila perlu kembali ke keadaan sebelum U4, ikuti **Pemulihan dari dump** di bawah (kode versi sebelum U4 tidak mengenal
tabel akun, jadi pulihkan dump dan kode bersamaan).

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

Test beban akun (login p95 di bawah 1 detik, tambahan gerbang sesi paling banyak 50 ms, daftar audit pada 500.000 baris
di bawah 2 detik, antrean hash penuh menjawab 503) dijalankan sendiri, manual atau terjadwal:

```bash
docker compose run --rm backend npx vitest run -c vitest.load.config.ts tests/load/auth.load.test.ts
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
