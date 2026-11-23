# Infrastructure Design — u1-walking-skeleton — Infrastructure Specification

## Sources

- [Q1] Deployment seluruhnya Docker Compose lokal, tanpa layanan AWS/cloud.
- [Q2] Satu jaringan internal, named volume PostgreSQL, port database tidak di-publish, backend mem-publish satu port.
- [Q3] Secrets lewat `.env` (tidak dikomit) + `.env.example`.
- [memory] `team.md` ## Deployment: v1 lokal via Docker Compose; hosting jangka panjang sengaja belum dikunci.
- [memory] `nfr-design/logical-components.md`: tiga komponen (backend, frontend, PostgreSQL), dua failure domain app + database.
- [memory] `components.md` (Domain Design): StepLibrary, DdclDocument, ExcelExportService hidup di satu backend modular monolith.
- [memory] `functional-spec.md` (Functional Design U1): alur buat step → susun DDCL → ekspor Excel, yang memakai API backend dan database yang sama.
- [memory] `nfr-requirements/tech-stack-decisions.md`: Fastify, Prisma, PostgreSQL, React + Vite, Vitest.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Tiga container Docker Compose: `backend` (Node.js/Fastify), `frontend` (React + Vite), `db` (PostgreSQL) | NFR3.1: berjalan penuh lokal tanpa layanan eksternal; sesuai tiga komponen logis. |
| Networking topology | Satu default bridge network Compose; backend mem-publish satu port ke host; frontend mem-publish port dev-server/browser; `db` tidak mem-publish port apa pun | NFR2.4: database hanya terjangkau dari jaringan internal Compose. |
| Storage strategy | Named volume Docker untuk direktori data PostgreSQL; tidak ada penghapusan otomatis | NFR4.1: data permanen. Volume bertahan saat `docker compose down` (tanpa `-v`). |
| Environments | Satu: lokal (developer/operasional). Tidak ada staging/production | `team.md` ## Deployment; arah hosting cloud ditunda. Topologi sama bila nanti ada lingkungan lain (hanya skala yang berbeda). |
| IaC approach | `docker-compose.yml` + `Dockerfile` per app di repo (monorepo dua app) | Cukup untuk lokal; tidak ada CDK/CloudFormation karena tidak ada resource cloud. |
| Resource sizing | Tanpa limit eksplisit; satu instance per container | NFR1.4: < 20 pengguna aktif; NFR1.1–1.3: respons < 2 detik cukup dipenuhi satu instance. |
| Secrets | `.env` dibaca lewat `env_file`; `.env` di `.gitignore`; `.env.example` dikomit | NFR2.3: kredensial DB dari environment variable, tidak di source/config yang dikomit. Catatan: `POSTGRES_USER`/`POSTGRES_PASSWORD` hanya dipakai saat volume pertama kali diinisialisasi; mengubahnya di `.env` kemudian tidak mengubah kredensial di volume yang sudah ada (reset lewat `docker compose down -v`, yang menghapus data). |
| Environment variables | `.env.example` mendaftar: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` (host `db`), `BACKEND_PORT` (default 3000), `FRONTEND_PORT` (default 5173), `FRONTEND_ORIGIN` (untuk CORS backend), `VITE_API_BASE_URL` (alamat backend dari browser), `DDCL_TEMPLATE_PATH` (default `/app/template/DDCL BCAS PROD 202611 - TEMPLATE.xlsx`) | Nilai default port adalah default desain; dapat diganti lewat `.env`. Backend hanya menerima origin frontend lewat CORS karena browser memanggil backend langsung (port berbeda). |
| Template Excel | Berkas template tidak ada di git (sudah tidak dilacak). Compose mem-bind-mount folder host `./template/` (diabaikan git) ke `/app/template` di container backend secara read-only; path-nya dibaca dari `DDCL_TEMPLATE_PATH`. Operator menaruh berkas template di `./template/` sebelum `docker compose up`; `.env.example` dan README menjelaskannya | NFR6.1: ekspor harus cocok 1:1 dengan template asli; template tidak boleh dibakar ke image karena tidak ada di repo. Bila berkas hilang, ekspor gagal dengan 500 generik dan log `operation` (NFR3.2, BR1.5); backend tetap hidup untuk endpoint lain. |
| Migrasi skema | Container `backend` menjalankan `prisma migrate deploy` saat start, sebelum server Fastify listen; berjalan setelah `db` sehat. Migrasi hanya maju (forward-only) | Prisma (tech-stack) butuh skema terpasang; tanpa langkah ini compose baru tidak berfungsi. Kegagalan migrasi menghentikan container (fail fast). |
| TLS / load balancer / cache | Tidak ada | Keputusan NFR Design: jaringan lokal, skala kecil. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| PostgreSQL (container `db`) | database | Satu instance, satu database, named volume, kredensial dari `.env`, tanpa replikasi | Satu-satunya pemakai: backend (Prisma). Gagal → backend balas 500 generik (NFR3.2). |
| Backend (container `backend`) | application server | Node.js + Fastify; Prisma; `depends_on` db dengan `condition: service_healthy`; healthcheck `GET /health` (lihat monitoring-design) | Satu proses modular monolith (StepLibrary, DdclDocument, ExcelExportService). Template Excel dibaca dari bind mount read-only (lihat Deployment > Template Excel). |
| Frontend (container `frontend`) | web UI | React + Vite; memanggil API backend lewat port backend yang di-publish; healthcheck HTTP ke port frontend sendiri | Gagal → UI tidak tersedia, backend dan data tidak terpengaruh. |
| Cache / queue / search / CDN / DNS / load balancer | — | Tidak ada | Tidak dibutuhkan pada skala v1. |

## Shared Infrastructure

Tidak berlaku: hanya satu Unit (u1) yang memakai database; Unit lain memperluas skema yang sama di fase berikutnya.

## Traceability Notes

- NFR1.1–NFR1.4: tidak butuh resource tambahan; dipenuhi satu instance backend + PostgreSQL lokal (tidak ada jaringan jauh).
- NFR2.1 (cookie sesi HTTP-only, nilai stub): logika aplikasi, tanpa infrastruktur tambahan.
- NFR2.5 (tanpa masking): tanpa kontrol infrastruktur.
- NFR6.1 (ekspor Excel 1:1): infrastruktur menyediakan template asli ke backend lewat bind mount read-only `./template/` + `DDCL_TEMPLATE_PATH` (Deployment > Template Excel); kecocokan 1:1 sendiri diverifikasi manual pada checkpoint skeleton.

## Assumptions & Open Questions

None.
