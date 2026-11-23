# Code Generation Plan — u1-walking-skeleton

## Summary

- Builds: skeleton ujung-ke-ujung — buat step, susun satu DDCL dengan satu baris checklist, unduh Excel sesuai template
- Touches: `backend/` (Fastify + Prisma), `frontend/` (React + Vite), `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, dan tambahan di `.gitignore`
- Tests: sekitar 35 test Vitest (unit dan integrasi, backend dan frontend), coverage baris minimal 80% per app

## Sources

- [desc] Alur skeleton: `functional-design/functional-spec.md` (US1.1, US2.1, US2.2, US4.1).
- [desc] Entitas: `functional-design/entities.md` (Step, DdclDocument, ReleaseHeader, ChecklistItem); aturan: `functional-design/rules.md` (BR1.1–BR1.7).
- [desc] Kontrak: `contract-summary.md` Contract 2, 3, 4 (hanya bagian yang dipakai U1).
- [desc] NFR: `nfr-design/*.md` dan `infrastructure-design/infrastructure-specification.md`.
- [memory] `team.md`: TypeScript, Prettier, ESLint, test-after dengan urutan per lapisan, coverage 80%, struktur monorepo dua app.

## Konvensi

- Backend `backend/` dan frontend `frontend/` adalah dua app terpisah, masing-masing punya `package.json`, `tsconfig.json`, `vitest.config.ts`, dan ESLint/Prettier sendiri.
- Path API memakai prefix `/api/v1`. Id berupa string `cuid`.
- File yang sudah ada dan milik pengguna (`.gitignore`, `DDCL BCAS PROD 202611 - TEMPLATE.xlsx`) tidak diubah. Satu pengecualian: `.gitignore` ditambah entri `.env`, `template/`, `node_modules/`, `coverage/`, `dist/` (langkah 1), karena secrets dan template tidak boleh masuk git (NFR2.3, infrastructure-specification). Berkas template di root disalin (bukan dipindah) ke `template/` untuk dipakai Compose.

## Langkah

### Fondasi

- [x] **Step 1 — Struktur proyek dan konfigurasi produksi.** Buat `backend/` (Fastify, Prisma, ExcelJS, `@fastify/cookie`, `@fastify/cors`) dan `frontend/` (React, Vite) dengan TypeScript strict, ESLint, Prettier. Tambah entri di `.gitignore` seperti di Konvensi. Mengimplementasikan: NFR2.3 (secrets tidak di git), struktur dua app (`project.md` Corrections).
- [ ] **Step 2 — Bootstrap test runner dan catat perintah unit-scoped.** Pasang Vitest dan konfigurasi coverage (ambang baris 80%, tidak diturunkan) di kedua app; satu test sanity per app agar runner terbukti jalan. Perintah tepatnya ada di `unit-test-instructions.md`. Mengimplementasikan: Testing Contract (runner siap sebelum test pertama), lantai coverage `mvp`.

### Model data

- [x] **Step 3 — Skema Prisma dan migrasi awal (implement).** `backend/prisma/schema.prisma` dengan empat model dan satu migrasi awal:
  - `Step`: `id`, `name`, `category`, `kind` (enum `forward`/`rollback`, default `forward`), `pairedRollbackStepId` (nullable, relasi ke `Step`) — BR1.1, `entities.md` Step.
  - `DdclDocument`: `id`, `title`, `status` (enum `Draft`/`Sudah Dikirim`, default `Draft`), `createdBy`, `createdAt` — BR1.2, BR1.3, `entities.md` DdclDocument.
  - `ReleaseHeader`: `id`, `ddclId` (unik, relasi 1:1), `date`, `startDate`, `impactedSystem`, `environment`, `phaseRelease`, `releaseObjective`, `technicalChange` (semua nullable) — AC2.1.1, `entities.md` ReleaseHeader.
  - `ChecklistItem`: `id`, `ddclId`, `stepId`, `order` (default 1), `parameterValues` (Json, nullable) — AC2.2.1, `entities.md` ChecklistItem.
  Entrypoint backend menjalankan `prisma migrate deploy` sebelum server listen (infrastructure-specification).
- [ ] **Step 4 — Test model data.** Jalankan migrasi pada database uji dan uji: default `kind`/`status`, relasi ChecklistItem ke Step dan DdclDocument, ReleaseHeader 1:1, kolom nullable. Menjalankan test lapisan ini sebelum lapisan berikutnya (test-after).

### Repository / akses data

- [x] **Step 5 — Repository Step, DdclDocument, ChecklistItem (implement).** Fungsi `createStep`, `listSteps`, `createDdcl` (dengan header, dalam satu transaksi), `addChecklistItem`, `getDdclForExport`. Kegagalan koneksi database dibungkus menjadi error domain `DatabaseUnavailable` dengan detail asli dicatat (BR1.5, OBS1.2).
- [ ] **Step 6 — Test repository.** Cover: simpan dan baca kembali tiap entitas, transaksi `createDdcl` tidak meninggalkan data setengah jadi bila gagal, `DatabaseUnavailable` terlempar saat koneksi gagal.

### Logika bisnis

- [x] **Step 7 — Validasi dan aturan (implement).** Validasi step (nama dan kategori wajib, menyebut field yang kosong — BR1.1); `createdBy` konstan `"dev-user"` (BR1.3); status awal `Draft` (BR1.2); label tab = `ReleaseHeader.date` (BR1.7, fungsi murni yang dipakai frontend lewat respons API field `tabLabel`).
- [x] **Step 8 — ExcelExportService (implement).** Muat template dari `DDCL_TEMPLATE_PATH` memakai ExcelJS (ADR-005); gagal muat → error `TemplateUnavailable` dengan path yang diharapkan, tanpa file apa pun ditulis (BR1.4, NFR3.3); petakan header dan satu baris checklist ke sel template; nilai parameter ditulis apa adanya (BR1.6). Mapping sel ditentukan setelah memeriksa struktur sheet template asli dan didokumentasikan di `code-summary.md`. Mengimplementasikan: AC4.1.1, AC4.1.2, NFR6.1.
- [ ] **Step 9 — Test logika bisnis dan ExcelExportService.** Validasi step (kosong, hanya nama kosong, hanya kategori kosong), konstanta createdBy/status, label tab. Test ekspor memakai workbook fixture sintetis yang dibuat di dalam test: sel terisi sesuai mapping, template hilang → `TemplateUnavailable` dan tidak ada file, nilai berawalan `=` ditulis apa adanya. Kecocokan 1:1 dengan template asli diverifikasi manual pada checkpoint skeleton (NFR6.1).

### API / endpoint

- [x] **Step 10 — Endpoint dan middleware (implement).** `POST /api/v1/steps` (201, 400 untuk BR1.1), `GET /api/v1/steps` (dipakai frontend untuk memilih step; tanpa `usageCount`, itu U2), `POST /api/v1/ddcls` (201, status Draft, header), `POST /api/v1/ddcls/{id}/checklist-items` (201), `GET /api/v1/ddcls/{id}/export` (200 `.xlsx`, 404, 500 generik), `GET /health` (memeriksa koneksi DB). Hook `onRequest` yang menetapkan cookie sesi HTTP-only bernilai stub dan tidak pernah menolak request (NFR2.1, NFR2.2). CORS hanya untuk `FRONTEND_ORIGIN` dengan `credentials: true`. Logger Pino JSON ke stdout dengan `reqId`, `path`, `method`, dan `err`/`operation` pada error boundary (OBS1.1, OBS1.2). Handler error terpusat: `DatabaseUnavailable`/error tak terduga → 500 generik tanpa detail infrastruktur (BR1.5, NFR3.2). Mengimplementasikan: AC1.1.1, AC1.1.3, AC2.1.1, AC2.2.1, AC4.1.1, NFR1.1–NFR1.3.
- [ ] **Step 11 — Test endpoint.** Integrasi via `fastify.inject` ke database uji: buat step sukses dan 400, buat DDCL berstatus Draft dengan `createdBy` `dev-user`, tambah checklist item, ekspor 200 dan 404, ekspor dengan template hilang menghasilkan pesan jelas, 500 generik saat DB tidak terjangkau tanpa bocor detail, `/health` sehat dan gagal, cookie sesi HTTP-only ditetapkan.

### Frontend

- [x] **Step 12 — Layar frontend (implement).** Tiga layar dengan `data-testid` pada elemen interaktif: Library (form nama dan kategori, daftar step, pesan validasi per field — AC1.1.1, AC1.1.3), Susun DDCL (judul, field header, label tab mengikuti tanggal — AC2.1.1, BR1.7; pilih satu step dan isi nilai object/parameter — AC2.2.1), Unduh Excel (tombol yang memanggil endpoint ekspor — AC4.1.1). Klien API memakai `VITE_API_BASE_URL` dan `credentials: 'include'`; error 500 ditampilkan sebagai pesan generik (BR1.5). Tidak ada retry otomatis untuk POST.
- [ ] **Step 13 — Test frontend.** Vitest + Testing Library: validasi step kosong menampilkan field yang kosong, submit step berhasil memuat daftar, label tab berubah mengikuti tanggal header, menambah step ke checklist, tombol unduh memanggil endpoint ekspor, error 500 menampilkan pesan generik.

### Lingkungan dan dokumentasi

- [x] **Step 14 — Artefak deployment dan CI.** `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` (tiga service, jaringan internal, named volume PostgreSQL, port database tidak di-publish, bind mount read-only `./template/`, healthcheck backend/db/frontend, `depends_on` `service_healthy`), `.env.example` (variabel di infrastructure-specification), `.github/workflows/ci.yml` (job backend dan frontend: install, lint, type-check, migrate pada service container PostgreSQL, test dengan coverage 80%, build). Mengimplementasikan: NFR2.3, NFR2.4, NFR3.1, NFR4.1, infrastructure-specification, cicd-pipeline.
- [ ] **Step 15 — Dokumentasi dan traceability.** `README` singkat tidak dibuat karena README adalah berkas pengguna; catatan cara menjalankan, penyediaan template, dan variabel lingkungan masuk ke `code-summary.md`. Isi `traceability.json`, termasuk status `Deferred` untuk AC/NFR milik Unit lain dengan alasannya.

## Cakupan Test

Standard: 5–8 test per komponen (StepLibrary, DdclDocument, ExcelExportService, lapisan API, frontend) plus integrasi pada batas kunci (API ke database, API ke template), kira-kira 35 test. Area risiko tinggi (ekspor Excel) mendapat test tambahan di Step 9.

## Dependensi dan Prasyarat

- Node.js LTS, Docker dengan Compose, dan berkas template di `./template/` untuk uji manual end-to-end.
- Test integrasi backend butuh PostgreSQL; di Compose lewat container `db` (port tidak di-publish), di CI lewat service container.

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
