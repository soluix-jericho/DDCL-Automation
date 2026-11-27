# Infrastructure Design — u4-user-accounts — CI/CD Pipeline

## Sources

- [Q3] `ci.yml` tetap dengan variabel uji dan satu test deklarasi role per rute; test beban mingguan tidak ditambah skenario.
- [Q1] Variabel lingkungan baru; `.env` di luar git.
- [memory] U1 dan U2 `cicd-pipeline.md`: GitHub Actions, CI saja tanpa CD, deployment manual `docker compose up --build`, rollback lewat `git revert` dan pemulihan dari dump pra-migrasi; `team.md` ## Testing Posture (coverage baris 80% per app).

## Stages (CI)

Workflow `ci.yml` U1 dan U2 tetap, dengan penambahan ini:

| Order | Stage | Command (indikatif) | Gate |
|---|---|---|---|
| 1 | Install | `npm ci` per app dari lockfile (tidak ada paket baru di U4) | Lockfile tidak sinkron → gagal |
| 2 | Lint dan type-check | ESLint, `tsc --noEmit` | Ada error → memblokir PR |
| 3 | Migrate (backend) | `prisma migrate deploy` ke database uji; test memeriksa `schema.prisma` sama dengan hasil migrasi (tidak ada drift) dan indeks `Session.tokenHash`, `User.email`, dan indeks audit ada | Migrasi gagal, drift, atau indeks hilang → memblokir PR |
| 4 | Test | Vitest dengan coverage per app memakai variabel uji sekali pakai (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`; bukan rahasia nyata, ditulis langsung di workflow seperti kredensial service container). Seluruh suite U1–U3 berjalan ulang lewat helper login (regresi). Test wajib NFR5.20 termasuk satu test yang mendaftar semua rute terdaftar di Fastify dan menegaskan tiap rute punya deklarasi role atau sengaja bernilai admin (gagal bila ada rute tanpa deklarasi), serta test konkurensi untuk penguncian, admin terakhir, dan pembuatan admin pertama | Coverage baris < 80% per app atau test gagal → memblokir PR |
| 5 | Build | Build backend (termasuk `dist/scripts/recovery.js` dari `backend/src/scripts/recovery.ts`) dan frontend; langkah sesudah build memeriksa `dist/scripts/recovery.js` ada, dan satu test menjalankan jalur `--password-stdin` (kata sandi dari stdin, bukan argumen) terhadap database uji | Gagal build, berkas tidak ada, atau test stdin gagal → memblokir PR |

**Test beban:** `tests/load` (U2) memanggil endpoint yang kini wajib sesi, sehingga harus diubah supaya login lewat helper yang sama dengan suite biasa dan membawa cookie; tanpa itu seluruh test beban menjadi 401. `load-test.yml` mendapat variabel uji yang sama (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`). Itu bagian dari regresi U1–U3 (NFR5.20), bukan skenario baru. Tidak ada skenario baru di test beban terjadwal (Q3 B): NFR1.20 dan NFR1.23 dibuktikan oleh test di Build and Test (100 login termasuk gelombang 4 serentak, daftar audit pada seed 500.000 baris), dijalankan manual lewat `docker compose run --rm backend npx vitest run -c vitest.load.config.ts`. Pembuktian itu bukan gerbang otomatis di CI; kegagalannya baru terlihat saat dijalankan.

## Deployment (manual, lokal)

1. Salin `.env.example` ke `.env` dan isi `ADMIN_EMAIL`, `ADMIN_PASSWORD` (minimal 10 karakter), `ALLOWED_ORIGINS`, dan nilai lain; `.env` tidak masuk git.
2. `docker compose up --build`. `start-prod.sh` membuat cadangan bila ada migrasi tertunda pada database berisi, menjalankan migrasi, lalu server; server membuat admin pertama bila tabel `User` kosong dan mengisi `createdByUserId` DDCL lama.
3. Buka frontend dan login dengan akun `ADMIN_EMAIL`. Setelah admin pertama ada, variabel `ADMIN_*` diabaikan.

## Rollback

- Kode: `git revert` lalu `docker compose up --build`.
- Data: pulihkan dari dump pra-migrasi (prosedur U2 di README: hentikan backend, kosongkan skema, `pg_restore`). Karena migrasi U4 forward-only dan skema kembali ke keadaan sebelum U4 setelah pemulihan, tabel akun ikut hilang; DDCL kembali tanpa pembuat.
- Peringatan rollback: pemulihan dari dump mengembalikan data ke saat sebelum migrasi U4, sehingga akun, DDCL, dan perubahan yang dibuat setelah deploy ikut hilang. Dump pra-U4 hanya bertahan selama masih termasuk `BACKUP_KEEP` (bawaan 10) dump terbaru; bila ada banyak migrasi sesudahnya, salin dump itu ke luar volume atau naikkan `BACKUP_KEEP` sebelum migrasi berikutnya.
- Akses terkunci: pemulihan akses lewat layar Akun oleh admin lain atau skrip `recovery.js` (tidak butuh rollback).

## Secrets management

Kredensial dan `ADMIN_PASSWORD` hanya di `.env` lokal (gitignored) dan environment container; tidak di kode, log, atau audit. CI memakai nilai uji sekali pakai yang bukan rahasia nyata. Tidak ada rotasi otomatis di v1; pergantian kata sandi akun lewat portal atau skrip pemulihan.

## Assumptions & Open Questions

None.
