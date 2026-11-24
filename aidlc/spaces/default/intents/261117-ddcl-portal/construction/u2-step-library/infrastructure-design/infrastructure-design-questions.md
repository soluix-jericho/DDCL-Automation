# Infrastructure Design — u2-step-library — Questions

## Sources

- [memory] `nfr-design/logical-components.md ## Perubahan Infrastruktur`: tidak ada layanan atau port baru; yang berubah hanya migrasi Prisma, `bodyLimit`, `connection_limit=10`, dan paket Tailwind di frontend.
- [memory] U1 `infrastructure-design/` (Docker Compose lokal tiga container, CI GitHub Actions saja tanpa CD, secrets lewat `.env`, rollback lewat `git revert`): tetap berlaku, tidak ditanyakan ulang.
- [memory] `performance-design.md ## Verifikasi`: test beban memakai 1.000 step, 100 bundle, 100.000 item checklist; `reliability-design.md ## Keunikan Nama`: test CI memeriksa indeks di `pg_indexes`.

## Q1. [Platform] Di mana test beban NFR1.5–NFR1.7 dijalankan

Seed 100.000 item membuat test berat; menjalankannya di setiap push memperlambat CI.

- A. **Test beban terpisah dari suite biasa (`tests/load`), dijalankan manual lewat Docker (`docker compose run`) dan di workflow CI terjadwal mingguan atau manual (`workflow_dispatch`), bukan di setiap push.** Test indeks `pg_indexes` dan test konkurensi kecil tetap jalan di setiap push
- B. Test beban di setiap push CI
- X. Other (please specify)

[Answer]: A

## Q2. [Platform] Pengaman sebelum menjalankan migrasi U2

Migrasi U2 mengubah tabel U1 (`ChecklistItem.stepId` jadi nullable, kolom `stepSnapshot` dengan backfill) dan tidak bisa dibatalkan hanya dengan `git revert` (U1 cicd-pipeline).

- A. **Catatan langkah manual di runbook: operator menjalankan `pg_dump` sebelum `docker compose up --build` pertama setelah U2; tidak ada otomatisasi backup.** Cocok untuk v1 lokal tanpa data produksi nyata yang kritis
- B. Skrip backup otomatis sebelum migrasi
- X. Other (please specify)

[Answer]: B

## Q3. [Platform] Cara membuat `package-lock.json` setelah menambah Tailwind

`docker-compose.yml` tidak me-mount folder `frontend`, jadi lockfile tidak bisa ditulis keluar lewat `docker compose run` biasa.

- A. **Satu kali jalan `docker run --rm -v "<folder frontend>:/app" -w /app node:20-bookworm-slim npm install --package-lock-only` (image Node yang sama dengan Dockerfile), tanpa mengubah `docker-compose.yml`.** Hanya `package-lock.json` yang berubah; tidak ada `node_modules` di komputermu. Saya minta izin sebelum menjalankannya di Code Generation
- B. Tambah mount `./frontend` di `docker-compose.yml` untuk pengembangan (mengubah Compose)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
