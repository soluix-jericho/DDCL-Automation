# Infrastructure Design — u1-walking-skeleton — Questions

## Sources

- [memory] `team.md` ## Deployment: v1 sepenuhnya lokal via Docker Compose (backend, frontend, PostgreSQL); belum ada staging/production nyata; arah hosting jangka panjang (AWS/Kubernetes/lainnya) sengaja belum dikunci.
- [memory] `nfr-design/*.md` (U1): tanpa TLS, tanpa caching, tanpa load balancer, logging JSON ke stdout, satu instance backend+frontend.
- [memory] `team.md` ## Testing Posture: lantai coverage 80% + eksekusi CI sebelum merge (scope `mvp`).

## Q1. [Ops] Model deployment

Karena `team.md` ## Deployment eksplisit menetapkan v1 sepenuhnya lokal via Docker Compose dan arah hosting cloud jangka panjang belum diputuskan, apakah Infrastructure Design untuk Unit ini dirancang murni untuk Docker Compose lokal (tanpa layanan cloud/AWS apa pun), menunda keputusan platform cloud ke saat arah hosting benar-benar diputuskan?

- A. Ya — seluruhnya Docker Compose lokal (container backend, container frontend, container PostgreSQL di satu jaringan Docker internal); tidak ada layanan AWS/cloud yang dirancang di sini
- B. Perlu rancangan cloud sebagian (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Ops] Topologi jaringan & penyimpanan

- A. Satu jaringan Docker Compose internal (default bridge network) menghubungkan ketiga container; PostgreSQL memakai named volume Docker untuk persistensi data (NFR4.1); tidak ada port database yang di-publish ke host (NFR2.4); backend mem-publish satu port ke host untuk diakses frontend dev-server/browser
- B. Topologi lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Ops] Manajemen secrets

- A. Kredensial database (dan secrets lain di masa depan) lewat file `.env` yang dibaca Docker Compose (`env_file`), tidak pernah dikomit ke version control (`.env` masuk `.gitignore`); sebuah `.env.example` dikomit sebagai template
- B. Cara lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Ops] Pipeline CI/CD untuk v1

Tidak ada deployment otomatis ke lingkungan nyata untuk v1 (hanya lokal), tapi `team.md` mewajibkan CI jalan sebelum merge.

- A. Pipeline CI (bukan CD): install dependencies → lint (ESLint) → type-check (tsc) → test (Vitest, lantai coverage 80%) → build — berjalan di setiap push/PR ke `main`; tidak ada tahap deploy otomatis karena "deployment" untuk v1 adalah menjalankan `docker compose up --build` secara manual di lingkungan developer/operasional; rollback adalah `git revert` lalu rebuild, bukan prosedur rollback lingkungan terkelola
- B. Pipeline berbeda (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q5. [Ops] Monitoring untuk v1

Mengikuti `observability-design.md` (tidak ada stack monitoring eksternal untuk v1):

- A. Satu health check Docker Compose (`healthcheck` pada container backend, memeriksa `GET /health`) yang dipakai Compose untuk menandai container sehat/tidak — tidak ada dashboard, metrik, atau alerting terkelola untuk v1; log diakses lewat `docker compose logs`
- B. Monitoring lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
