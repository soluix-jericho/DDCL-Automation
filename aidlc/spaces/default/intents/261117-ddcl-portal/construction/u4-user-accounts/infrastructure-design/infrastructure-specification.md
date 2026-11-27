# Infrastructure Design — u4-user-accounts — Infrastructure Specification

## Sources

- [Q1] Variabel lingkungan baru diteruskan di Compose dan ditulis di `.env.example`; `ALLOWED_ORIGINS` menggantikan `FRONTEND_ORIGIN`.
- [Q2] Skrip pemulihan di image backend, dijalankan lewat `docker compose run`.
- [Q5] Hosting di luar lokal mensyaratkan frontend dan backend satu situs.
- [memory] `nfr-design/logical-components.md` dan `reliability-design.md`: tidak ada layanan atau port baru; urutan start dan migrasi; kunci penasihat database; `createdByUserId` nullable di database (keputusan manusia pada tahap NFR Design).
- [memory] `components.md` (Domain Design, komponen UserAccount): tetap satu modul di backend modular monolith yang sama, sehingga tidak ada komponen atau proses baru.
- [memory] `functional-spec.md` (Functional Design U4, W1 bootstrap, W2 login, W10 pengaturan ulang): semua alur memakai API backend dan database yang sama.
- [memory] U1 dan U2 `infrastructure-design/infrastructure-specification.md`: topologi tiga container (`backend`, `frontend`, `db`), `start-prod.sh` (cadangan bersyarat, `prisma migrate deploy`, server), volume `ddcl_backups`, `db` tanpa published port.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Tetap tiga container U1 (`backend`, `frontend`, `db`); tidak ada container, proses, atau penjadwal luar baru. Pembersihan terjadwal dan pembuatan admin pertama berjalan di dalam proses `backend` | NFR3.1 (lokal penuh), NFR4.20 |
| Networking topology | Tidak berubah: satu jaringan Compose, `db` tanpa published port. Frontend (`localhost:5173`) dan backend (`localhost:3000`) adalah satu situs (hanya beda port), sehingga cookie SameSite=Lax terkirim pada fetch dengan kredensial | NFR2.31 (mewarisi NFR2.4 U1), NFR2.22 |
| Storage strategy | Tidak ada volume baru. `ddcl_pgdata` dan `ddcl_backups` dari U1 dan U2 tetap; tabel baru `User`, `Session`, `LoginThrottle`, `AuditEvent` ada di database yang sama | NFR4.21 |
| Environments | Satu lingkungan lokal, tidak berubah. Di luar lokal (Q5): frontend dan backend wajib satu situs (mis. `app.contoh.com` dan `api.contoh.com`, atau satu domain dengan proxy), HTTPS, `COOKIE_SECURE=true`; dicatat di README | `team.md` ## Deployment, NFR2.22, NFR2.32 |
| IaC approach | `docker-compose.yml`, `Dockerfile`, `backend/scripts/start-prod.sh`, `.env.example`; tidak ada IaC baru | Cukup untuk lokal |
| Resource sizing | Tanpa limit eksplisit. Puncak memori hash sekitar 128 MiB (2 hash × `maxmem` 64 MiB) di dalam proses backend; `UV_THREADPOOL_SIZE=8` | NFR1.24, NFR1.25 |
| Konfigurasi lingkungan baru (Q1) | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (hanya dibaca saat tabel `User` kosong; `ADMIN_PASSWORD` tanpa nilai bawaan di Compose, jadi backend gagal start bila tabel kosong dan variabel kosong atau tidak sah); `ALLOWED_ORIGINS` (daftar dipisah koma; menggantikan `FRONTEND_ORIGIN`). Compose meneruskan keduanya apa adanya tanpa nilai bawaan (`ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}` dan `FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:-}`), sehingga nilai bawaan tidak menyembunyikan konfigurasi lama. Backend menyelesaikan daftar dengan urutan: `ALLOWED_ORIGINS` bila tidak kosong, jika tidak `FRONTEND_ORIGIN` (cadangan satu rilis), jika keduanya kosong backend gagal start. Nilai `http://localhost:5173` hanya ada sebagai isi `ALLOWED_ORIGINS` di `.env.example` (bukan di Compose), jadi `.env` lama yang hanya berisi `FRONTEND_ORIGIN` non-localhost tetap bekerja; `COOKIE_SECURE=false`; `TRUST_PROXY=false`; `UV_THREADPOOL_SIZE=8`. Semua diteruskan di `environment` service `backend` dan ditulis di `.env.example` dengan placeholder (`ADMIN_PASSWORD=change-me-at-least-10-chars`; backend menolak nilai placeholder persis itu seperti nilai tidak sah, jadi admin tidak bisa tercipta dengan kata sandi contoh). `.env` tetap di luar git | NFR2.3, NFR2.25, NFR2.26, NFR2.32 |
| Urutan start | `start-prod.sh` tidak berubah dalam urutan: cadangan bersyarat lalu `prisma migrate deploy` lalu `node dist/server.js`. Di dalam server, sebelum mendengarkan: admin pertama dan pengisian `createdByUserId` di bawah kunci penasihat database (tanpa DDL di luar Prisma); pembersihan pertama berjalan di latar belakang setelah server mendengarkan | NFR3.21, NFR4.20 |
| Healthcheck | Tetap `GET /health` (tanpa sesi, dikecualikan dari penegakan); `start_period` 300 detik dari U2 tetap | NFR2.23 |
| Rotasi log | Service `backend` mendapat `logging: driver: json-file, options: max-size: 10m, max-file: 5` di Compose, karena driver `json-file` bawaan Docker tidak merotasi sendiri; log audit di database tetap sumber tahan lama | NFR3.24 |
| Skrip pemulihan (Q2) | Sumber di `backend/src/scripts/recovery.ts`, sehingga `tsconfig.build.json` (`rootDir` src, `outDir` dist) menerbitkan `dist/scripts/recovery.js`; dibangun di image backend dan dijalankan `docker compose run --rm backend node dist/scripts/recovery.js <perintah>` dengan perintah `reset-password`, `unlock`, `reactivate`, `make-admin`. Kata sandi dari prompt tersembunyi (terminal interaktif) atau `--password-stdin` dengan `docker compose run --rm -T`; argumen kata sandi dan `-e VAR=nilai` tidak diterima. Langkah dan contoh dicatat di README. Memakai variabel lingkungan dan kode hash yang sama dengan backend | NFR3.22, NFR2.20 |
| Batas ukuran dan hook di aplikasi | Rantai penegakan sesi, pemeriksaan Origin, dan pintu hash adalah konfigurasi di kode Fastify; tanpa reverse proxy sehingga tidak ada penegakan di lapisan lain. `TRUST_PROXY` hanya diaktifkan bila nanti ada proxy | NFR2.27, NFR2.32 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| PostgreSQL (`db`) | database | Tidak berubah; objek tambahan: tabel `User`, `Session`, `LoginThrottle`, `AuditEvent`, kolom `DdclDocument.createdByUserId` (nullable, foreign key ke `User`); indeks unik `Session.tokenHash`, `User.email`, indeks audit `(occurredAt, id)` dan `(type, occurredAt, id)` | `max_connections` bawaan cukup untuk pool `connection_limit=10`. Akun database aplikasi yang sama menjalankan migrasi dan DML; kode backend tidak butuh hak DDL tambahan |
| Backend (`backend`) | application server | Environment baru di atas; image memuat skrip pemulihan; `UV_THREADPOOL_SIZE=8` | Healthcheck U1 dipertahankan |
| Frontend (`frontend`) | web UI | Tidak berubah selain layar baru (Login, Akun, Audit, ganti kata sandi); memakai `VITE_API_BASE_URL` yang ada dan cookie sesi dengan kredensial | Tanpa dependensi baru |
| Cache / queue / search / CDN / DNS / load balancer | — | Tidak ada | Skala v1 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| PostgreSQL (satu database) | u1-walking-skeleton | u2, u3, u4 (skema akun), u5, u6 | Hanya backend yang terhubung; migrasi Prisma berurutan antar Unit |
| Rantai penegakan sesi dan role (SessionGate, RoleRegistry) | u4-user-accounts | Semua rute U1–U3 dan otomatis U5/U6 | Dipasang sekali di pintu masuk `/api/v1/*`; unit baru hanya mendeklarasikan role minimal rutenya |
| Volume `ddcl_backups` dan `start-prod.sh` | u2-step-library | u3 sampai u6 (migrasi U4 ikut tercadangkan) | Hanya `backend` yang menulis |
| Threadpool libuv (`UV_THREADPOOL_SIZE=8`) | u4-user-accounts | Operasi berkas, kompresi, dan ekspor Excel (U1, U6) | Hash dibatasi 2 sehingga 6 thread tersisa |

## Traceability Notes

- NFR1.20, NFR1.21, NFR1.23, NFR1.24, NFR1.25: perilaku aplikasi dan konfigurasi proses; satu-satunya tambahan infrastruktur adalah `UV_THREADPOOL_SIZE=8`.
- NFR2.x: konfigurasi lingkungan (`ALLOWED_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY`, `ADMIN_*`) dan jaringan internal yang tidak berubah.
- NFR3.20–NFR3.23, NFR4.20, NFR4.21: urutan start, skrip pemulihan, dan pembersihan di proses backend.

## Assumptions & Open Questions

None.
