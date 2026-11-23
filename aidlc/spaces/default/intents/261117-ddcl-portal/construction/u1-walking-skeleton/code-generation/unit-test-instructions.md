# Unit Test Instructions — u1-walking-skeleton

## Test framework

- Vitest di backend dan frontend (`team.md`, `tech-stack-decisions.md`). Frontend memakai Testing Library dan jsdom; backend memakai `fastify.inject` dan Prisma ke PostgreSQL uji.
- Strategi Standard: 5–8 test per komponen, ditambah integrasi di batas kunci. Metodologi test-after: tiap lapisan diimplementasikan dahulu, lalu test-nya ditulis dan dijalankan.

## Perintah yang dijalankan untuk Unit ini

Test file Unit ini berada di `backend/tests/u1/` dan `frontend/tests/u1/`.

Backend (butuh PostgreSQL; port database tidak dibuka ke host, jadi dijalankan di jaringan Compose):

```
docker compose run --rm backend npx vitest run tests/u1 --coverage.enabled=false
```

Frontend:

```
npm --prefix frontend exec vitest -- run tests/u1 --coverage.enabled=false
```

Test sanity runner (Step 2) memakai perintah yang sama dengan filter `tests/u1/sanity`.

## Expected coverage targets

- Lantai coverage baris 80% (`team.md` Testing Posture, scope `mvp`) berlaku per app. Lantai ini diukur Build and Test pada suite penuh proyek yang sudah dirakit, memakai `npm --prefix <app> run test:coverage` (ambang di `vitest.config.ts`, tidak diturunkan untuk meloloskan langkah). Perintah Unit di atas mematikan coverage agar tidak gagal hanya karena ambang pada Unit yang sedang diuji.
- Perintah `test:coverage` dijalankan sebagai perintah tersendiri tanpa langkah sesudahnya yang bisa terhenti oleh exit-code ambang.

## Mocking dan stubbing

- Database: tidak di-mock pada test integrasi (PostgreSQL uji sungguhan). Kegagalan koneksi disimulasikan dengan `DATABASE_URL` yang menuju host tidak terjangkau atau dengan memutus Prisma client pada test tersebut.
- Template Excel: workbook fixture sintetis dibuat di dalam test (struktur sheet dan kolom yang sama dengan yang dipetakan). Template asli tidak dipakai di test otomatis; kecocokan 1:1 diverifikasi manual (NFR6.1).
- Frontend: panggilan API di-mock pada level `fetch`; tidak ada jaringan nyata.

## Data uji

- Setiap test integrasi membersihkan tabel yang dipakainya (truncate) sebelum berjalan; tidak ada data bersama antar test.
- Kredensial database uji berasal dari `.env` lokal atau variabel CI, tidak pernah ditulis di kode.

## Tidak dijalankan dalam stage ini (dicatat jujur di `code-summary.md`)

- Test integrasi backend yang butuh Docker, bila runtime kontainer tidak tersedia di lingkungan pembangunan.
- Job CI GitHub Actions, karena hanya berjalan setelah push.
