# Code Summary — u1-walking-skeleton

## Status build

Semua kode dan test sudah ditulis, tetapi **belum ada satu pun test, lint, type-check, atau build yang dijalankan**. Lingkungan pembangunan tidak punya `node`/`npm`, dan akses ke Docker daemon ditolak (permission denied pada `/var/run/docker.sock`). Kode belum pernah dikompilasi; tidak ada `package-lock.json`. Coverage tidak terukur.

## Files created/modified

- Root: `.gitignore` (diubah: `.env`, `template/`, `node_modules/`, `coverage/`, `dist/`, `backend/tests/.tmp/`), `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `template/DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (salinan, gitignored; berkas asli di root tidak disentuh).
- `backend/`: konfigurasi (package.json, tsconfig, ESLint, Prettier, Vitest, Dockerfile); `prisma/schema.prisma` dan migrasi awal `20261123000000_init` (ditulis tangan, belum divalidasi); `src/` (`config`, `errors`, `rules`, `repository`, `excel`, `app`, `server`); `tests/` (global-setup, helpers, dan enam berkas test di `tests/u1/`).
- `frontend/`: konfigurasi (package.json, tsconfig, Vite, Vitest, ESLint, Prettier, Dockerfile, index.html); `src/` (`api`, `App`, `main`, `tabLabel`, tiga layar di `screens/`); `tests/` (setup, sanity, `app.test.tsx`).

## Key implementation decisions

- Mapping sel Excel (dari inspeksi XML template asli): sheet "Release Document" `H8` impactedSystem, `C9`/`C10` tanggal, `C11` environment, `C12` phaseRelease, `A15` releaseObjective, `A21` technicalChange; sheet "Deployment Check List" `A1` judul, baris 13 (`A` urutan, `B` nama step, `C` tanggal); sheet "List Object & Parameter" `C1` judul dan baris 7–23 (`B` nomor, `C` nama parameter, `I` nilai apa adanya). Sheet "Checklist Capture" tidak dipetakan.
- Template hilang menghasilkan 500 dengan `error: "template_unavailable"` dan pesan berisi path yang diharapkan, mengikuti BR1.4. Ini berbeda dari wording "500 generik" di `infrastructure-specification.md`; error 500 lain tetap generik.
- Pengaman database uji: helper test menolak berjalan bila nama database tidak mengandung "test" sebelum `TRUNCATE`; `TEST_DATABASE_URL` ditambahkan di `.env.example` dan Compose.
- Compose: frontend tanpa `env_file` agar kredensial DB tidak masuk container itu. Healthcheck memakai `node -e fetch(...)`; catatan reviewer Infrastructure Design (CMD-SHELL `$$`, tanda kutip path template, CORS `credentials: true`, Vite `0.0.0.0`) diterapkan.

## Test coverage summary

Ditulis sekitar 71 test (backend 3 sanity, 7 data model, 8 repository, 13 rules, 9 excel, 16 API; frontend 2 sanity, 11 app), lebih banyak dari perkiraan plan (~35) karena risiko ekspor Excel dan batas database. Ambang `lines: 80` terpasang di kedua `vitest.config.ts` dan tidak diturunkan; `src/server.ts` dan `src/main.tsx` dikecualikan dari coverage (entrypoint tanpa logika).

## Tests written but not executed in this stage

Semua test (backend dan frontend), dengan alasan: `node`/`npm` tidak tersedia di lingkungan ini dan Docker daemon tidak dapat diakses. Job CI GitHub Actions juga belum berjalan karena hanya jalan setelah push. Kecocokan 1:1 ekspor dengan template asli (NFR6.1) belum diverifikasi; ExcelJS belum dipakai membaca template, dan sebagian elemen template (customXml, sebagian drawing/komentar) mungkin tidak dipertahankan.

## Deviations from the plan

- Dependensi di luar daftar plan: `tsx` (backend devDependency) dan `eslint-plugin-react-hooks` (frontend); versi belum diverifikasi lewat install.
- Aturan tambahan: `order` checklist item = jumlah item + 1; judul DDCL wajib; tanggal berformat `YYYY-MM-DD`; parameter harus teks dan maksimal 17 (sesuai baris template 7–23).
- `startDate` bertipe date (mengikuti `entities.md`); sel `C10` berlabel "Start Time" kini berisi tanggal, bukan jam. Usulan untuk u3-ddcl-composition.
- Baris sampel template di luar rentang yang dikosongkan (Deployment Check List baris 28–43 dan grup lain di sheet ketiga) tetap ada di hasil ekspor; perlu keputusan di U3/U6.
- Checkbox plan Step 2, 4, 6, 9, 11, 13 belum dicentang karena test belum dijalankan.

## Langkah pertama bagi yang punya Node dan Docker

1. `npm --prefix backend install` dan `npm --prefix frontend install`, lalu komit lockfile.
2. `build`, `typecheck`, `lint` di kedua app (titik rawan: tipe logger Fastify di `app.ts`, `Prisma.DbNull`, asersi `cell.type` ExcelJS di `excel.test.ts`).
3. Salin `.env.example` ke `.env`, lalu `docker compose up --build`.
4. Jalankan perintah test di `unit-test-instructions.md` dan `npm --prefix <app> run test:coverage`.
5. Unduh Excel dari alur ujung-ke-ujung dan bandingkan dengan template asli (NFR6.1).

## Assumptions & Open Questions

None.
