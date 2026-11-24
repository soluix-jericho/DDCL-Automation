# Infrastructure Design — u2-step-library — Infrastructure Specification

## Sources

- [Q1] Test beban terpisah dari suite biasa.
- [Q2] Backup otomatis sebelum migrasi. Rancangan awal (service Compose terpisah yang membuat dump di setiap `up`) diganti setelah review: backup dibuat di entrypoint backend hanya bila ada migrasi yang akan diterapkan (lihat Backup sebelum migrasi).
- [Q3] Lockfile Tailwind lewat satu kali `docker run` tanpa mengubah Compose.
- [memory] `nfr-design/logical-components.md ## Perubahan Infrastruktur untuk Infrastructure Design`: tidak ada layanan atau port baru; berubah hanya migrasi Prisma, `bodyLimit`, `connection_limit`, dan paket Tailwind.
- [memory] `components.md` (Domain Design): StepLibrary tetap satu modul di backend modular monolith yang sama, sehingga tidak ada komponen atau proses baru.
- [memory] `functional-spec.md` (Functional Design U2, Alur 1–5): semua alur Library memakai API backend dan database yang sama; Alur 4 (hapus step) mengosongkan `ChecklistItem.stepId` sehingga kolom itu menjadi nullable di migrasi.
- [memory] U1 `infrastructure-design/infrastructure-specification.md`: topologi Docker Compose lokal tiga container tetap berlaku.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Tetap tiga container U1 (`backend`, `frontend`, `db`); tidak ada container baru | NFR3.4: lokal penuh. Backup berjalan di dalam proses start `backend`. |
| Networking topology | Tidak berubah: satu jaringan Compose, `db` tanpa published port | NFR2.4 tetap berlaku. |
| Storage strategy | Named volume PostgreSQL (U1) ditambah named volume Docker `ddcl_backups` yang di-mount ke `/backups` di container `backend`. Bukan bind mount ke folder repo | Folder repo ada di OneDrive; dump berisi data operasional tanpa masking (NFR2.5) dan tidak boleh tersinkron ke cloud atau masuk git. Konsekuensi: tidak terlihat di Explorer; salin keluar dengan `docker cp` atau `docker run` bila perlu. |
| Environments | Satu lingkungan lokal, tidak berubah | `team.md` ## Deployment. |
| IaC approach | `docker-compose.yml`, `Dockerfile` per app, dan `backend/scripts/start-prod.sh` (di dalam image, bukan di-mount) | Cukup untuk lokal. `.gitattributes` menetapkan `*.sh text eol=lf` agar skrip tidak rusak oleh CRLF di Windows/OneDrive. |
| Resource sizing | Tanpa limit eksplisit; `DATABASE_URL` backend memuat `connection_limit=10` (`scalability-design.md`) | NFR1.9 dan NFR1.10: empat tulis serentak ditambah baca, pool 10. |
| Backup sebelum migrasi (Q2) | Image backend memasang `postgresql-client-16` dari repo apt PGDG (`apt.postgresql.org`, ditambahkan di Dockerfile dengan kunci GPG-nya), karena repo bookworm bawaan hanya memuat klien 15 dan `pg_dump` 15 menolak server 16. `start-prod.sh` (bit eksekusi diset di Dockerfile dengan `chmod +x`) berjalan sebelum server dan memakai variabel libpq terpisah, bukan `DATABASE_URL` (yang memuat `connection_limit` dan ditolak libpq): `PGHOST=db`, `PGUSER=$POSTGRES_USER`, `PGPASSWORD=$POSTGRES_PASSWORD`, `PGDATABASE=$POSTGRES_DB` (semuanya sudah ada di environment backend lewat `env_file`). Langkah: (1) deteksi migrasi tertunda tanpa `prisma migrate status` (kode keluar 1 mencampur banyak kondisi): hitung folder di `prisma/migrations` (`N_files`) dan, bila tabel `_prisma_migrations` ada (`psql -tAc "SELECT to_regclass('_prisma_migrations')"`), hitung barisnya yang `finished_at IS NOT NULL` (`N_applied`); tertunda bila `N_files > N_applied`; galat `psql` menghentikan start; (2) bila tertunda **dan** tabel `_prisma_migrations` ada (database tidak kosong), jalankan `pg_dump -Fc` ke `/backups/pre-migrate-<UTC-timestamp>.dump.partial`, lalu `mv` ke `.dump` hanya jika `pg_dump` sukses; (3) pangkas: hapus `*.partial` sisa gagal dan simpan `BACKUP_KEEP` (default 10) dump terbaru, dengan `ls -1t /backups/pre-migrate-*.dump 2>/dev/null \| tail -n +$((BACKUP_KEEP+1)) \| xargs -r rm --` di bawah `set -u` tanpa `pipefail` agar daftar kosong tidak menggagalkan skrip; (4) `prisma migrate deploy`; (5) `exec node dist/server.js`. `package.json` `start:prod` diganti menjadi `./scripts/start-prod.sh`. Gagal backup menghentikan start (fail fast), tidak ada migrasi tanpa cadangan. Start tanpa migrasi tertunda tidak membuat dump, jadi tidak ada dump per `up`, dan menjalankan test lewat `docker compose run backend` tidak memicunya | Menutup temuan review: dump hanya dibuat saat benar-benar diperlukan, sehingga dump pra-migrasi tidak tergusur oleh start biasa. Basis data kosong pertama kali tidak perlu dump (tidak ada `_prisma_migrations`). Kredensial: `start-prod.sh` memakai `PGPASSWORD` yang diambil dari `POSTGRES_PASSWORD` dan host/user/database dari `DATABASE_URL` yang sudah ada di environment backend (NFR2.3). |
| Pemulihan dari dump | Dicatat di README dengan perintah lengkap, karena dump hanya ada di volume `ddcl_backups` yang di-mount ke `backend`: (1) `docker compose stop backend`; (2) lihat daftar dump: `docker compose run --rm --no-deps --entrypoint ls backend -l /backups`; (3) pulihkan dengan entrypoint di-override agar `start-prod.sh` tidak ikut berjalan: `docker compose run --rm --no-deps --entrypoint sh backend -c 'psql -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && pg_restore -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" /backups/<nama-dump>.dump'` (tanpa `--clean`, karena skema sudah dikosongkan; `PGPASSWORD` dari `POSTGRES_PASSWORD` diekspor di perintah itu; dump memuat `_prisma_migrations` sehingga status migrasi ikut kembali); (4) jalankan kode versi sebelumnya dengan `docker compose up --build`. Tabel baru U2 ikut hilang karena skema dikosongkan, jadi skema kembali persis seperti sebelum migrasi | Menutup temuan Critical: `pg_restore --clean` saja tidak menghapus tabel baru dan gagal pada FK. |
| Environment variables | Tidak ada variabel wajib baru; `connection_limit` ditulis di contoh `DATABASE_URL` di `.env.example`; `BACKUP_KEEP` (opsional, default 10) | NFR2.3 (kredensial dari environment) tetap. |
| Build frontend | `frontend/package.json` menambah devDependency `tailwindcss` (v3), `postcss`, `autoprefixer`; `package-lock.json` diperbarui sekali lewat `docker run --rm --user "$(id -u):$(id -g)" -v "<path mutlak frontend>:/app" -w /app node:20-bookworm-slim npm install --package-lock-only`, dijalankan **setelah** `package.json` diubah, path di dalam tanda kutip karena memuat spasi, `--user` agar berkas tidak dimiliki root (Q3). Image frontend tetap memakai `npm ci` dari lockfile; Tailwind diproses PostCSS oleh Vite | Tanpa CDN (tech-stack-decisions), tanpa `node_modules` di komputer pengembang; Node 20 yang sama dengan image menjaga lockfile konsisten dengan `npm ci`. Perlu izin pengguna saat Code Generation. |
| Migrasi skema | `prisma migrate deploy` tetap forward-only, kini didahului backup bersyarat di atas. Migrasi U2 dibuat dengan `--create-only` lalu ditinjau, berisi SQL mentah untuk dua indeks unik fungsional dan backfill `stepSnapshot` | `reliability-design.md ## Keunikan Nama`, `## Migrasi U2`. |
| Hook dan batas di aplikasi | `bodyLimit` 24 MiB dan pembatas tulis 4 serentak adalah konfigurasi Fastify di kode; tanpa reverse proxy sehingga tidak ada batas ukuran body di lapisan lain | `performance-design.md`. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| PostgreSQL (`db`) | database | Tidak berubah (U1); tambahan objek: tabel Step diperluas, StepColumn, StepLine, StepAttachment, StepBundle, anggota bundle, dua indeks unik fungsional, indeks `ChecklistItem.stepId` | `max_connections` bawaan (100) lebih dari cukup untuk pool 10. |
| Backend (`backend`) | application server | Perintah start menjadi `start-prod.sh` (backup bersyarat, migrasi, server); mount `ddcl_backups:/backups`; `DATABASE_URL` dengan `connection_limit=10`; `postgresql-client-16` di image | `healthcheck` U1 dipertahankan; `start_period` dinaikkan dari 20 ke 300 detik karena dump dan migrasi dapat memakan waktu pada data besar (frontend menunggu backend sehat, jadi start_period yang terlalu pendek akan menunda UI; kegagalan nyata tetap menghentikan container lewat fail fast, bukan lewat healthcheck). |
| Volume `ddcl_backups` | penyimpanan dump | Named volume Docker, hanya di-mount ke `backend` | Terhapus oleh `docker compose down -v`; jangan pakai `-v` kecuali memang mau menghapus data dan cadangan. |
| Frontend (`frontend`) | web UI | Tidak berubah kecuali dependensi Tailwind di build | Healthcheck U1. |
| Cache / queue / search / CDN / DNS / load balancer | — | Tidak ada | Skala v1. |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| PostgreSQL (satu database) | u1-walking-skeleton | u2-step-library (perluasan skema), u3 sampai u6 | Hanya backend yang terhubung; migrasi Prisma berurutan antar Unit. |
| Volume `ddcl_backups` dan `start-prod.sh` | u2-step-library | u3 sampai u6 (setiap migrasi mereka ikut tercadangkan) | Hanya `backend` yang menulis; operator yang memulihkan. |

## Ukuran Disk Cadangan

Dump format custom terkompresi. Perkiraan: data Library kecil (puluhan MB sampai sekitar 100 MB pada asumsi NFR1.9; `stepSnapshot` di 100.000 item bisa sampai beberapa GB sebelum kompresi). Batas 10 dump menjadi sekitar 10 kali ukuran database terkompresi; operator memeriksa `docker system df -v` dan menurunkan `BACKUP_KEEP` bila perlu.

## Traceability Notes

- NFR1.5–NFR1.11, NFR2.7–NFR2.9, NFR3.5, NFR3.6, NFR4.3–NFR4.7: perilaku aplikasi dan skema; infrastruktur tidak menambah resource selain yang tercantum di atas.
- NFR4.2: disk dikendalikan dengan batas 10 dump dan volume lokal.
- NFR3.4: seluruh Library tetap lokal via Docker Compose.

## Assumptions & Open Questions

None.
