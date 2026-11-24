# Code Generation Plan — u2-step-library

## Summary

- Builds: Library Step lengkap (step berkolom dan bernomor, variabel `{nama}`, lampiran teks, kategori label, popup duplikat, edit/hapus tanpa mengubah DDCL lama lewat snapshot, bundle forward→rollback, cari dan filter) di backend, database, dan frontend Tailwind, plus pengaman migrasi (backup bersyarat) dan test beban.
- Touches: `backend/prisma/` (skema + satu migrasi), `backend/src/` (modul step, bundle, pembatas tulis, rute), `backend/scripts/start-prod.sh`, `backend/Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `frontend/src/` (layar Library baru, Tailwind), `frontend/package.json` + lockfile, `README.md`, test U1 yang disesuaikan.
- Tests: sekitar 110 test (unit, integrasi PostgreSQL nyata, API lewat `app.inject`, konkurensi, komponen React) ditambah 1 suite beban terpisah; test U1 yang terdampak disesuaikan, bukan dilonggarkan.
- Adds: 3 indeks pendukung yang tidak diminta langsung oleh requirement (`Step.pairedRollbackStepId`, `BundleForwardMember.stepId`, `BundleRollbackMember.stepId`); see Assumptions

## Sumber dan keputusan yang dipakai

Semua dari artefak Unit ini: `functional-design/{functional-spec,rules,entities}.md` (BR2.1–BR2.14, Alur 1–5), `nfr-design/*` (batas NFR1.8, `bodyLimit` 24 MiB, pembatas tulis 4 serentak, protokol kunci dua fase, pemetaan galat), `infrastructure-design/*` (backup bersyarat, `ddcl_backups`, PGDG klien 16, test beban), `contract-design/contract-summary.md` (Contract 2), dan story US1.1, US1.2, US1.3 (`unit-of-work-story-map.md`).

Urutan mengikuti Testing Contract: **test-after, per lapisan** (implementasikan lapisan, lalu tulis dan jalankan test lapisan itu sebelum lanjut).

## Steps

### Fase A — Kerangka dan konfigurasi

- [x] **Step 1 — Struktur dan konfigurasi produksi backend.** `backend/package.json`: `start:prod` menjadi `./scripts/start-prod.sh`; tambah skrip `test:load` (`vitest run -c vitest.load.config.ts`). `backend/vitest.config.ts`: tambah `exclude: ['tests/load/**']` (ambang coverage 80% tidak diubah). `.gitattributes` baru: `*.sh text eol=lf`. Memenuhi: infrastructure-specification (IaC approach), cicd-pipeline (Test beban). Tidak ada ambang yang diturunkan.
- [x] **Step 2 — Runner test.** Runner Vitest U1 dipakai ulang (sudah ada). Perintah unit-scoped dicatat di `unit-test-instructions.md`; folder test baru `backend/tests/u2/` dan `frontend/tests/u2/`. `backend/tests/helpers/db.ts`: `truncateAll` diperluas dengan tabel baru (`StepColumn`, `StepLine`, `StepAttachment`, `StepBundle`, `BundleForwardMember`, `BundleRollbackMember`). `frontend/vitest.config.ts` tidak berubah.

### Fase B — Model data / database (NFR4.3, NFR4.4, NFR4.7; BR2.3, BR2.7, BR2.8, BR2.11)

- [x] **Step 3 — Skema Prisma.** `backend/prisma/schema.prisma`:
  - `Step`: tambah `createdAt` (`@default(now())`) dan `updatedAt` (`@updatedAt`) (entities.md Step); relasi `columns`, `attachments`, `forwardMemberships`, `rollbackMemberships`; `@@index([pairedRollbackStepId])` (lihat Assumptions).
  - `StepColumn`: `id`, `stepId` (FK Step, cascade), `position` (min 1), `label` String? ; `@@unique([stepId, position])` (BR2.2).
  - `StepLine`: `id`, `columnId` (FK StepColumn, cascade), `position`, `text` (`@db.Text`); `@@unique([columnId, position])`.
  - `StepAttachment`: `id`, `stepId` (FK Step, cascade), `filename`, `content` (`@db.Text`), `position`; `@@unique([stepId, filename])` (BR2.5).
  - `StepBundle`: `id`, `name`, `category` String? , `createdAt`, `updatedAt` (BR2.11, BR2.12).
  - `BundleForwardMember` dan `BundleRollbackMember`: `bundleId` (FK StepBundle, cascade), `stepId` (FK Step, cascade), `position`; `@@id([bundleId, stepId])`, `@@unique([bundleId, position])`, `@@index([stepId])` (BR2.11, BR2.7).
  - `ChecklistItem`: `stepId` menjadi `String?` dengan relasi opsional `onDelete: Restrict` (pengosongan dilakukan kode hapus, BR2.7); tambah `stepSnapshot Json` (wajib, BR2.8); `@@index([stepId])` (NFR1.5, Q2).
- [x] **Step 4 — Migrasi SQL `20261124000000_u2_step_library`** (ditulis tangan, setara `--create-only`, ditinjau manual): tabel dan indeks di atas; `ChecklistItem.stepId DROP NOT NULL`; `stepSnapshot` ditambah nullable, **di-backfill dari `Step`** untuk item U1 (`jsonb_build_object(name, category, kind, columns [], attachments [], pairedRollback null)`), lalu `SET NOT NULL` (BR2.8); `Step.createdAt/updatedAt` ditambah dengan default sementara untuk baris lama; nama kembar lama (pembanding `lower(btrim(name))`, `category`, `kind`) diberi sufiks ` (n)` sebelum indeks dibuat agar migrasi tidak gagal pada data U1; dua indeks unik fungsional `step_name_unique` (`lower(btrim(name)), category, kind`) dan `bundle_name_unique` (`lower(btrim(name))`) lewat SQL mentah (NFR4.7, BR2.3, BR2.11).
- [x] **Step 5 — Test model data dan migrasi** (`tests/u2/data-model.test.ts`, `tests/u2/migration.test.ts`): default kolom, unik `(stepId, position)`, cascade hapus kolom/langkah/lampiran, `stepId` item boleh null, `stepSnapshot` wajib, indeks fungsional ada di `pg_indexes` (`step_name_unique`, `bundle_name_unique`, indeks `ChecklistItem.stepId`), nama beda huruf besar/spasi ujung ditolak, backfill snapshot pada baris U1 (migrasi diuji dengan menerapkan SQL backfill ke tabel berisi), bentuk nyata `meta.target` P2002 dicatat. Sesuaikan `tests/u1/data-model.test.ts` (`stepSnapshot` wajib pada pembuatan item). Jalankan.

### Fase C — Logika bisnis (BR2.1, BR2.2, BR2.4, BR2.5, BR2.9, BR2.11, BR2.12, BR2.13; NFR1.8, NFR2.7–NFR2.9)

- [x] **Step 6 — Teks dan validasi.** `backend/src/stepText.ts` baru: pemindai satu token (`{{`, `}}`, `{nama}`, galat dengan kolom/baris/posisi), `extractVariables`, `renderText` (fungsi render bersama BR2.4), `escapeLike` (escape `\`, `%`, `_`), `CATEGORIES` tetap. `backend/src/stepRules.ts` baru: `validateStepBody`, `validateBundleBody`, `validateListQuery` (semua batas NFR1.8 dihitung dalam titik kode/byte UTF-8; struktur diperiksa di awal agar array raksasa ditolak murah; membuang langkah kosong dan kolom kosong sebelum simpan; menolak hapus kolom terakhir; nama file tanpa `/`, `\`, `..`, unik tanpa beda huruf; `kind` tidak bisa diubah pada PATCH, lihat Assumptions). `backend/src/rules.ts`: `validateStepInput` U1 diganti oleh yang baru.
- [x] **Step 7 — Test logika bisnis** (`tests/u2/stepText.test.ts`, `tests/u2/stepRules.test.ts`): `{{{x}}}`, `{}`, `{ a }`, `{a.b}`, JSON ditolak dengan posisi; variabel peka huruf besar/kecil; render literal; batas tiap NFR1.8; pembuangan langkah/kolom kosong; kategori/kind tidak sah; pasangan rollback tidak sah (BR2.9); anggota bundle salah jenis atau ganda (BR2.11); `escapeLike`. Jalankan.

### Fase D — Repository / akses data (BR2.3, BR2.6–BR2.9, BR2.11, BR2.14; NFR1.5–1.7, NFR4.3–4.6)

- [x] **Step 8 — Protokol kunci dan galat.** `backend/src/errors.ts`: tambah `ConflictError` (409, memuat `existing` dan `conflictOn`), `ServiceBusyError` (503 + `Retry-After`), `RetryExhausted` (409 "coba lagi"). `backend/src/libraryTx.ts` baru: `withLibraryTx` (transaksi interaktif timeout 10 s/maxWait 5 s; baca kandidat → `SELECT ... FOR UPDATE ... ANY(${ids}::text[])` untuk `StepBundle` lalu `Step` urut id lewat `tx.$queryRaw` → baca ulang dan verifikasi subset → ulang maksimal 2 kali untuk `40P01`/`P2034`/kandidat berubah; `P2024` → `ServiceBusyError`).
- [x] **Step 9 — Repository step.** `backend/src/stepRepository.ts` baru (digabung ke `createRepository`): `listSteps({q,category})` (ringkasan saja + `usageCount` lewat satu agregasi `count(DISTINCT "ddclId")` per halaman id, BR2.6; penanda Belum ada rollback), `getStep`, `listCategories`, `createStep` (+ `rollbackStep` inline atomik), `updateStep` (ganti total kolom/langkah/lampiran dengan `createMany`, pasangan baru/kosong), `getDeleteImpact`, `deleteStep` (kosongkan `pairedRollbackStepId` yang menunjuknya, keluarkan dari bundle + rapatkan posisi, hapus bundle yang kehilangan anggota forward terakhir, `UPDATE ChecklistItem SET stepId = NULL` tanpa menyentuh `stepSnapshot`), pemetaan P2002 → requery `lower(btrim(name))` → `ConflictError` dengan isi penuh step dan `conflictOn`.
- [x] **Step 10 — Repository bundle dan snapshot.** `backend/src/bundleRepository.ts` baru: `listBundles({q,category})` (ringkasan + jumlah anggota), `getBundle` (anggota forward dan rollback berurutan dengan isi penuh step, BR2.14), `createBundle`, `updateBundle`, `deleteBundle` (step tidak ikut terhapus). `backend/src/repository.ts`: `addChecklistItem` membuat `stepSnapshot` (salinan penuh step + salinan pasangan rollback) dalam satu transaksi dengan item, 404 bila `stepId` hilang (BR2.8); `toDdcl` dan `ChecklistItemRecord.stepId` menerima null dan mengisi `step` dari snapshot; `backend/src/excel.ts` memakai nama dari snapshot (DDCL lama tetap utuh meski step dihapus).
- [x] **Step 11 — Test repository** (`tests/u2/stepRepository.test.ts`, `tests/u2/bundleRepository.test.ts`, `tests/u2/snapshot.test.ts`, `tests/u2/concurrency.test.ts`): buat/edit/hapus dengan kolom dan lampiran; duplikat → konflik dengan isi lama dan `conflictOn` untuk `step` dan `rollbackStep` (tak ada yang tersimpan); `usageCount` distinct; pencarian `%` dan `_` hanya cocok literal, `\` tidak merusak kueri; hapus step: dampak lengkap, snapshot sama persis byte demi byte, pasangan dikosongkan, bundle kehilangan anggota terakhir ikut terhapus, posisi dirapatkan; bundle: jumlah rollback beda dari forward, anggota salah jenis ditolak; empat test konkurensi wajib NFR Design (transaksi bersilang, dua PATCH bersamaan, hapus step vs simpan bundle, ganti pasangan vs hapus pasangan lama) tanpa 500 dan tanpa posisi ganda; `P2024` → 503; deadlock habis pengulangan → 409. Sesuaikan `tests/u1/repository.test.ts` dan `tests/u1/excel.test.ts`. Jalankan.

### Fase E — API / endpoint (Contract 2; BR2.6, BR2.10, BR2.12, BR2.13, NFR1.10, NFR2.6–NFR2.9)

- [x] **Step 12 — Pembatas tulis, rute, dan pemetaan HTTP.** `backend/src/writeLimiter.ts` baru: hook `onRequest` pada rute tulis Library, maksimal 4 serentak, ke-5 langsung 503 + `Retry-After: 2` sebelum body dibaca; slot dilepas pada `onResponse` dan `onRequestAbort` (idempoten; tahan 413 dan error handler). `backend/src/libraryRoutes.ts` baru dan didaftarkan di `backend/src/app.ts`: `GET/POST /steps`, `GET /steps/categories` (`[{name}]`), `GET/PATCH/DELETE /steps/:id`, `GET /steps/:id/impact`, `GET/POST /bundles`, `GET/PATCH/DELETE /bundles/:id`; `bodyLimit` 24 MiB pada rute tulis Library saja (rute U1 tetap bawaan); error handler diperluas: 409 (+isi step/bundle), 503, 413 generik, 404 untuk FK hilang (`P2003`), 500 generik. Pemakai `GET /steps` U1 (`listSteps` di frontend) disesuaikan di Step 15.
- [x] **Step 13 — Test API** (`tests/u2/stepsApi.test.ts`, `tests/u2/bundlesApi.test.ts`, `tests/u2/writeLimiter.test.ts`): status 201/200/400/404/409/413/503 tiap rute, body 400 menyebut field bermasalah, 409 membawa isi step dan `conflictOn`, daftar hanya ringkasan (tanpa teks langkah), `q` dan `category` di server, kategori tidak sah → 400, payload di batas NFR1.8 termasuk `rollbackStep` inline dan varian non-ASCII tidak kena 413, payload di atas 24 MiB → 413, pembatas: slot ke-5 → 503 dan slot dilepas setelah 413/abort/error, sesi stub tetap berlaku. Sesuaikan `tests/u1/api.test.ts` (POST step kini memakai body baru). Jalankan.

### Fase F — Frontend (US1.1 AC1.1.2/AC1.1.3, US1.2 AC1.2.1/AC1.2.2, US1.3 AC1.3.1–AC1.3.3; NFR2.8)

- [x] **Step 14 — Tailwind.** `frontend/package.json`: devDependencies `tailwindcss` 3.4.17, `postcss` 8.4.49, `autoprefixer` 10.4.20 (versi pasti, tanpa CDN); `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css` (direktif Tailwind), `frontend/src/main.tsx` mengimpor `index.css`. `frontend/package-lock.json` diperbarui **sekali** lewat `docker run ... npm install --package-lock-only` (**butuh izin pengguna sebelum dijalankan**; lihat Step 21).
- [x] **Step 15 — Klien API dan layar Library.** `frontend/src/api.ts`: tipe dan fungsi untuk step penuh, daftar ringkas dengan `q`/`category`, kategori, impact, bundle; `ApiError` membawa isi 409 (`existing`, `conflictOn`); 503 menampilkan pesan "server sibuk" **tanpa mengulang otomatis** (konsisten dengan Contract Q5; koreksi atas catatan NFR Design). `frontend/src/screens/LibraryScreen.tsx` ditulis ulang: daftar step (nama, kategori, jenis, `usageCount`, penanda Belum ada rollback), kolom cari + filter kategori, bagian Bundle terpisah. Komponen baru di `frontend/src/screens/library/`: `StepForm.tsx` (judul, kategori, jenis, 3 kolom awal, tombol tambah/hapus kolom dan langkah dengan konfirmasi bila kolom berisi, nomor dari posisi, variabel terdeteksi, lampiran, pasangan rollback: pilih/buat inline/lewati, catatan "DDCL lama tidak berubah", draft tetap bila gagal), `DuplicateDialog.tsx` (perbandingan step lama vs baru; Pakai step yang ada / Ubah nama), `DeleteStepDialog.tsx` (jumlah pemakaian, bundle ikut terhapus, step kehilangan pasangan, DDCL lama utuh), `BundleForm.tsx` (nama, kategori opsional, urutan forward, urutan rollback), `stepText.ts` (deteksi variabel di klien; server tetap penentu). Teks dirender sebagai node teks React, tanpa `dangerouslySetInnerHTML` (NFR2.8); `data-testid` pada semua elemen interaktif. `frontend/src/App.tsx` menyesuaikan pemuatan step untuk layar Susun.
- [x] **Step 16 — Test frontend** (`tests/u2/library.test.tsx`, `tests/u2/stepForm.test.tsx`, `tests/u2/dialogs.test.tsx`, `tests/u2/bundleForm.test.tsx`, `tests/u2/api.test.ts`): form baru punya 3 kolom, tambah kolom, hapus kolom berisi meminta konfirmasi, variabel terdeteksi tampil, lampiran, simpan 400 menandai field, popup duplikat membandingkan lama vs baru dan "Ubah nama" mempertahankan isian, hapus menampilkan dampak, 503 tidak diulang otomatis, cari/filter memanggil server, bundle dengan jumlah forward ≠ rollback. Sesuaikan `tests/u1/app.test.tsx` (layar Library lama diganti). Jalankan.

### Fase G — Lingkungan, infrastruktur, dan build

- [x] **Step 17 — Backup bersyarat sebelum migrasi.** `backend/scripts/start-prod.sh` baru (`set -eu`; deteksi migrasi tertunda dengan menghitung folder `prisma/migrations` vs baris `finished_at IS NOT NULL` di `_prisma_migrations`; `pg_dump -Fc` ke `/backups/pre-migrate-<UTC>.dump.partial` lalu `mv`; pangkas `*.partial` dan simpan `BACKUP_KEEP` (default 10) terbaru; `prisma migrate deploy`; `exec node dist/server.js`; gagal backup menghentikan start). `backend/Dockerfile`: `postgresql-client-16` dari repo PGDG (kunci GPG), `chmod +x scripts/start-prod.sh`. `docker-compose.yml`: volume bernama `ddcl_backups` di-mount ke `/backups` pada `backend`, `start_period` backend 300 s, variabel libpq (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) dari `.env`. `.env.example`: `connection_limit=10` pada `DATABASE_URL` dan `BACKUP_KEEP` opsional.
- [x] **Step 18 — Test skrip backup.** Test integrasi shell (`tests/u2/startProd.test.ts`) yang menjalankan logika deteksi dan pangkas terhadap folder sementara dengan `pg_dump` palsu (skrip stub di PATH uji) untuk: tanpa migrasi tertunda → tidak ada dump; basis kosong → tidak ada dump; tertunda → dump `.dump` muncul dan `.partial` tidak tersisa; `pg_dump` gagal → skrip berhenti non-nol tanpa `.dump`; pangkas menyisakan `BACKUP_KEEP`. Pengujian `pg_dump` nyata dan pemulihan dicatat sebagai pemeriksaan manual di README (butuh Docker Compose utuh).
- [x] **Step 19 — CI.** `.github/workflows/ci.yml`: tidak perlu langkah baru (migrate deploy + test `pg_indexes` sudah masuk suite biasa); `.github/workflows/load-test.yml` baru (`schedule` mingguan + `workflow_dispatch`, service PostgreSQL, `npm ci`, `prisma migrate deploy`, `npm run test:load`, `timeout-minutes: 30`; bukan status check wajib PR).
- [x] **Step 20 — Test beban** (`backend/tests/load/library.load.test.ts`, `backend/vitest.load.config.ts`): seed SQL massal (1.000 step, 100 bundle, 100.000 `ChecklistItem` dengan snapshot 5 KB di CI; `LOAD_SNAPSHOT_KB=20` untuk lokal); p95 < 2 detik dari 100 permintaan per rute (daftar, cari, simpan di batas maksimum dengan `rollbackStep`, hapus, simpan/hapus bundle) dan skenario 20 permintaan bersamaan; varian non-ASCII tanpa 413. Dijalankan manual/terjadwal, **bukan** di suite biasa.
- [x] **Step 21 — Lockfile frontend.** Setelah `frontend/package.json` diubah (Step 14), tanya izin lalu jalankan satu kali `docker run --rm --user "$(id -u):$(id -g)" -v "<path mutlak frontend>:/app" -w /app node:20-bookworm-slim npm install --package-lock-only`; periksa `package-lock.json` berubah dan tidak ada `node_modules` di komputer.

### Fase H — Dokumentasi dan keterlacakan

- [x] **Step 22 — Dokumentasi.** `README.md` baru (cara menjalankan, menjalankan test per unit, folder `ddcl_backups`, **prosedur pemulihan** dari dump dengan perintah lengkap `--entrypoint sh`, peringatan `docker compose down -v`). `aidlc/.../contract-design/contract-summary.md` Contract 2 diperbarui (bentuk `categories`, body kolom/lampiran/`rollbackStep`, 409 dengan `conflictOn`, `GET /steps/{id}`, `GET /steps/{id}/impact`, bundle, `DELETE` memakai 200 + dampak, `q`/`category`).
- [x] **Step 23 — Ringkasan dan keterlacakan.** `code-summary.md`, `source-manifest.json`, `traceability.json` (lewat `aidlc engine sensor-traceability`), dengan catatan test yang ditulis tetapi tidak dijalankan di tahap ini.

## Story ke langkah

| Story / AC | Langkah |
|---|---|
| US1.1 AC1.1.2 (duplikat per kategori → pakai yang ada) | 4, 9, 12, 15 (`DuplicateDialog`) |
| US1.1 AC1.1.3 (isian mengikuti variabel; deviasi Q10) | 6, 15 (`StepForm` variabel terdeteksi) |
| US1.2 AC1.2.1 (daftar, usageCount, cari, filter) | 9, 12, 15 |
| US1.2 AC1.2.2 (hapus tanpa mengubah DDCL) | 3, 4, 9, 10, 15 (`DeleteStepDialog`) |
| US1.3 AC1.3.1 (pasangan rollback, inline atomik) | 6, 9, 15 |
| US1.3 AC1.3.2 (penanda Belum ada rollback) | 9, 15 |
| US1.3 AC1.3.3 (edit tidak mengubah DDCL lama) | 9, 10, 15 |
| Bundle (Q11, BR2.11, BR2.14, reverse) | 3, 4, 6, 10, 12, 15 |
| NFR1.5–1.11, NFR2.6–2.9, NFR3.5–3.6, NFR4.3–4.7 | 4, 6, 8, 9, 12, 17, 19, 20 |

## Assumptions

- Tiga indeks pendukung ditambahkan di Step 3: `Step.pairedRollbackStepId`, `BundleForwardMember.stepId`, `BundleRollbackMember.stepId`. Tidak ada requirement yang menyebutnya langsung; tanpa indeks, pencarian "step yang menunjuk step ini" dan "bundle yang memuat step ini" (dasar hapus step BR2.7 dan protokol kunci) menjadi pemindaian tabel penuh pada 1.000 step dan 100 bundle.
- `GET /api/v1/steps/{id}/impact` (hanya baca) ditambahkan karena Alur 4 langkah 1 meminta layar menampilkan dampak **sebelum** konfirmasi hapus, sedangkan kontrak hanya melaporkan dampak sesudah `DELETE`. `DELETE` mengembalikan 200 dengan laporan dampak (bukan 204 seperti kontrak awal), sesuai Functional Design "respons melaporkan dampaknya".
- Aturan yang belum ditetapkan Functional Design (temuan reviewer): `kind` sebuah step tidak dapat diubah lewat `PATCH` (ditolak 400, field `kind`) karena step sudah bisa menjadi pasangan rollback atau anggota bundle; kategori bundle hanya label dan tidak dibandingkan dengan kategori anggotanya.
- Validasi struktur dilakukan di fungsi validasi domain (pola U1), bukan skema JSON Fastify, karena koersi tipe bawaan Ajv bisa mengubah nilai non-teks menjadi teks sebelum validasi; kontrak 400 dan batas NFR1.8 tidak berubah.
- Migrasi ditulis tangan (setara `--create-only`) karena membuatnya lewat Prisma butuh menjalankan perintah baru; hasilnya dibandingkan dengan `prisma migrate diff` terhadap skema saat build dijalankan.

## Risiko yang dibawa

- Pemulihan dari dump, `pg_dump` nyata, dan deteksi migrasi tertunda baru bisa dicoba penuh dengan Docker Compose utuh; test Step 18 memakai `pg_dump` palsu.
- Test beban penuh (snapshot 20 KB, sekitar 2 GB) hanya untuk jalan manual lokal.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "implementasikan tiap lapisan yang bisa diuji (model data, endpoint API, komponen UI, fungsi generate-Excel) terlebih dahulu, lalu tulis dan jalankan test untuk lapisan tersebut sebelum lanjut ke lapisan berikutnya.",
  "scope": "mvp",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Methodology evidence**: Diafirmasi manusia pada wawancara (Q3, jawaban\n  A) — test-after untuk semua bagian, bukan opsi campuran TDD. Alasan yang\n  dipertimbangkan: domain MVP ini relatif CRUD + generate-Excel tanpa logika\n  bercabang yang sangat kompleks, sehingga menulis implementasi lebih dulu\n  lalu test per lapisan dianggap cukup, termasuk untuk bagian reusable\n  step/object/rollback yang berisiko (lihat `feasibility-assessment.md` Risk\n  Analysis) — risiko itu ditangani dengan cakupan test ekstra pada lapisan\n  tersebut, bukan dengan mengubah metodologi menjadi TDD.\n- **Ordering**: implementasikan tiap lapisan yang bisa diuji (model data,\n  endpoint API, komponen UI, fungsi generate-Excel) terlebih dahulu, lalu\n  tulis dan jalankan test untuk lapisan tersebut sebelum lanjut ke lapisan\n  berikutnya.\n- Scope `mvp` menambahkan lantai coverage baris 80% dan eksekusi test di CI\n  sebelum merge.\n- Area berisiko tinggi yang perlu perhatian test ekstra: kecocokan 1:1\n  hasil ekspor Excel terhadap `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (lihat\n  `feasibility-assessment.md` Risk Analysis), dan ketepatan logika reusable\n  step/object/rollback."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:6250e2e9be99892eb3fcef532875ae0eb995e2214a9a0cb8cdde83802014d4e1",
  "contract_sha256": "sha256:c8ceaaa187c7bc5187aa748299acc44c08accde3813e1f0f928ea7aa0229c3e7"
}
```
