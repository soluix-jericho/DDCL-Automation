# NFR Requirements — u1-walking-skeleton — Tech Stack Decisions

Sumber: `team.md` ## Code Style (TypeScript sudah diafirmasi untuk backend & frontend), jawaban `nfr-requirements-questions.md` Q1–Q4. Keputusan ini berlaku untuk seluruh proyek (bukan hanya U1) karena ini stack pertama yang dipilih — U2–U6 memperluas kode yang sama, tidak memilih stack baru.

| Lapisan | Pilihan | Rasional |
|---|---|---|
| Bahasa backend | TypeScript (Node.js) | Sudah diafirmasi tim (`team.md` ## Code Style, wawancara Q5). |
| Framework backend | **Fastify** | Ringan, TypeScript-native, skema validasi bawaan (cocok memvalidasi field wajib BR1.1 tanpa pustaka tambahan), overhead minimal untuk skala <20 pengguna (NFR1). Jawaban Q1. |
| ORM / akses database | **Prisma** | Type-safe, migrasi skema bawaan — penting karena skema `Step`/`DdclDocument` yang dibuat U1 akan diperluas U2–U6 tanpa mengganti, dukungan PostgreSQL penuh. Jawaban Q2. |
| Database | PostgreSQL | Sudah diafirmasi tim (`team.md` ## Deployment, NFR3). |
| Pustaka pengisian Excel | **ExcelJS** | Satu-satunya kebutuhan keras dari ADR-005 (Contract Design): harus bisa memuat workbook `.xlsx` yang sudah ada dan mempertahankan styling/merge cell, bukan menulis dari nol. ExcelJS mendukung ini secara langsung. Jawaban Q3. |
| Bahasa & framework frontend | TypeScript + **React + Vite** | TypeScript sudah diafirmasi tim; React dipilih karena ekosistem matang dan satu pengembang (AI) mengerjakan backend+frontend sekaligus — Vite memberi build/dev-server cepat tanpa konfigurasi berat. Jawaban Q4. |
| Mekanisme sesi | Cookie HTTP-only sisi server | Dipilih sebagai fondasi yang bisa langsung diisi sesi nyata oleh U4 tanpa mengganti mekanisme (cookie tetap, hanya isi/validasinya berubah). Jawaban Q5. |
| Testing | Vitest | Terintegrasi native dengan Vite (frontend) dan cocok untuk TypeScript ESM di backend; dipakai sejak Code Generation U1 untuk memenuhi Testing Posture tim (test-after, lantai coverage 80% scope `mvp`). |
| Linter/Formatter | ESLint + Prettier | Sudah diafirmasi tim (`team.md` ## Code Style). |

## Alternatif yang Dipertimbangkan

| Lapisan | Alternatif | Mengapa tidak dipilih |
|---|---|---|
| Framework backend | Express | Lebih populer tapi tanpa validasi skema bawaan dan performa sedikit lebih rendah dari Fastify untuk kebutuhan sederhana ini; NestJS dipertimbangkan tapi overhead arsitektur (modul/decorator) tidak sepadan untuk skala proyek ini. |
| ORM | TypeORM | Migrasi dan type-safety Prisma dinilai lebih matang untuk kecepatan iterasi lintas-Unit. |
| Pustaka Excel | xlsx (SheetJS) | Dukungan preservasi styling/merge cell pada file yang sudah ada kurang konsisten dibanding ExcelJS untuk kasus "isi ulang template" (ADR-005). |
| Frontend | Next.js | Fitur SSR/routing server tidak dibutuhkan — aplikasi ini adalah SPA internal di belakang Docker Compose, bukan situs yang perlu SEO/SSR. |

## Assumptions & Open Questions

None.
