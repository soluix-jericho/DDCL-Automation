# Infrastructure Design — u2-step-library — CI/CD Pipeline

## Sources

- [Q1] Test beban terpisah, manual dan terjadwal, bukan di setiap push.
- [Q2] Backup otomatis sebelum migrasi.
- [Q3] Lockfile Tailwind lewat satu kali `docker run`.
- [memory] U1 `infrastructure-design/cicd-pipeline.md`: GitHub Actions, CI saja tanpa CD, deployment manual `docker compose up --build`, rollback lewat `git revert`; `team.md` ## Testing Posture (coverage baris 80% per app).

## Stages (CI)

Workflow U1 tetap, dengan penambahan ini:

| Order | Stage | Command (indikatif) | Gate |
|---|---|---|---|
| 1 | Install | `npm ci` per app dari lockfile (frontend kini memuat Tailwind, PostCSS, autoprefixer) | Lockfile tidak sinkron dengan `package.json` → gagal |
| 2 | Lint dan type-check | ESLint, `tsc --noEmit` | Ada error → memblokir PR |
| 3 | Migrate (backend) | `prisma migrate deploy` ke database uji, lalu test `pg_indexes` memeriksa `step_name_unique`, `bundle_name_unique`, dan indeks `ChecklistItem.stepId` ada | Migrasi gagal atau indeks hilang → memblokir PR |
| 4 | Test | Vitest dengan coverage per app, termasuk test konkurensi kecil (dua transaksi bersilang, dua PATCH bersamaan, hapus step bersamaan dengan simpan bundle) dan test batas ukuran | Coverage baris < 80% per app atau test gagal → memblokir PR |
| 5 | Build | Build backend dan frontend (Tailwind diproses saat build frontend) | Gagal build → memblokir PR |

**Test beban (Q1):** berada di `backend/tests/load` (bagian dari paket backend, memakai Vitest dan konfigurasi `vitest.load.config.ts` terpisah; `vitest.config.ts` biasa mengecualikan `tests/load/**` karena pola `tests/**/*.test.ts` akan mengambilnya). Cara kerja:
- Menjalankan aplikasi Fastify langsung di dalam proses test (`app.inject` atau `listen` di port acak) terhadap database uji dari `TEST_DATABASE_URL`; tidak memakai Docker Compose, sehingga tidak memerlukan template Excel dan tidak memicu backup.
- Seed lewat SQL massal (`INSERT ... SELECT generate_series(...)`), bukan ratusan ribu panggilan API: 1.000 step, 100 bundle, 100.000 `ChecklistItem` dengan `stepSnapshot` `jsonb` berisi teks berulang. Di CI ukuran snapshot 5 KB (sekitar 0,5 GB, muat di runner); ukuran penuh 20 KB hanya untuk jalan manual lokal lewat variabel `LOAD_SNAPSHOT_KB=20` (sekitar 2 GB, perlu disk cukup).
- Mengukur p95 dari 100 permintaan per rute dan satu skenario 20 permintaan bersamaan; menegaskan p95 < 2 detik.
- Manual: `docker compose run --rm backend npx vitest run -c vitest.load.config.ts` (database uji terpisah dari database aplikasi lewat `TEST_DATABASE_URL`, seperti test U1).
- CI: workflow `load-test.yml` terpisah, dipicu mingguan (`schedule`) dan `workflow_dispatch`, dengan service container PostgreSQL, `npm ci` backend, `prisma migrate deploy` ke database uji, lalu perintah di atas; `timeout-minutes: 30`. Gagal memerahkan workflow itu tetapi tidak memblokir PR.

**Database uji dan template:** seperti U1 (service container PostgreSQL di CI, workbook fixture sintetis).

**Memblokir PR:** branch protection pada `main` tetap pengaturan manual pemilik repo (U1); status check yang wajib lulus adalah backend dan frontend, bukan `load-test`.

## Deployment Strategy

- Tidak ada CD: `docker compose up --build` manual. Saat start, backend menjalankan `start-prod.sh` (Q2): bila ada migrasi tertunda pada database yang sudah berisi, ia membuat dump `pre-migrate-*.dump` di volume `ddcl_backups` (simpan 10 terbaru), lalu `prisma migrate deploy`, lalu server. Start tanpa migrasi tertunda tidak membuat dump.
- Promosi lingkungan, blue-green, canary, feature flag, artifact registry: tidak ada.

## Rollback

1. Hentikan backend (`docker compose stop backend`).
2. `git revert` komit bermasalah di `main`.
3. Bila migrasi U2 sudah diterapkan dan skema harus dikembalikan, ikuti prosedur pemulihan di `infrastructure-specification.md` (Pemulihan dari dump; perintah lengkap dengan `--entrypoint` di-override): kosongkan skema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`), lalu `pg_restore` (tanpa `--clean`) dari dump `pre-migrate-*.dump` yang dibuat tepat sebelum migrasi bermasalah (nama berkas memuat waktu UTC; hanya start yang menerapkan migrasi membuat dump, jadi dump itu mudah dikenali), lalu jalankan kode versi sebelumnya. Tabel baru ikut hilang karena skema dikosongkan; `_prisma_migrations` ikut dipulihkan dari dump.
4. Alternatif: migrasi lanjutan yang membalik perubahan.

## Lockfile Tailwind (satu kali, Q3)

Setelah `frontend/package.json` diubah, satu perintah `docker run --rm --user "$(id -u):$(id -g)" -v "<path mutlak folder frontend>:/app" -w /app node:20-bookworm-slim npm install --package-lock-only` memperbarui `frontend/package-lock.json` tanpa membuat `node_modules` di komputer (path dalam tanda kutip karena memuat spasi; `--user` agar berkas tidak dimiliki root). Dijalankan di Code Generation setelah izin pengguna; CI dan image memakai `npm ci`, dan Node 20 yang sama menjaga lockfile konsisten.

## Secrets in CI/CD

- Sama seperti U1: CI memakai database uji dengan kredensial yang dibuat di job; `.env` tidak dikomit, `.env.example` dikomit. Dump tidak pernah berada di folder repo: disimpan di volume Docker `ddcl_backups` (bukan folder OneDrive, bukan git) karena memuat data operasional tanpa masking.

## Assumptions & Open Questions

None.
