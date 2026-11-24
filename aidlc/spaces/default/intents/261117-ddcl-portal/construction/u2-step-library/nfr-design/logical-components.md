# NFR Design — u2-step-library — Logical Components

Sumber: U1 `logical-components.md`, `components.md` (StepLibrary), desain di folder ini. Menjembatani NFR Design dengan Infrastructure Design.

## Inventori Komponen Logis

| Komponen | Failure Domain | Shared Resource | Blast Radius jika Gagal |
|---|---|---|---|
| Backend — modul StepLibrary (rute `/steps`, `/bundles`, validasi, `withLibraryTx`, antrean tulis) | Backend | PostgreSQL | Library tidak tersedia; DDCL dan ekspor di proses yang sama ikut terdampak karena satu proses (modular monolith, sama seperti U1). |
| Pembatas tulis serentak di memori (maks 4, hook `onRequest`, tolak 503) | Backend (di dalam proses) | Memori proses | Penghitung hilang saat restart; tidak ada keadaan yang perlu dipulihkan. Permintaan ke-5 ditolak cepat sebelum body dibaca. |
| Frontend — layar Library (daftar, form kolom, popup perbandingan, bundle) dengan Tailwind hasil build | Frontend | Tidak ada | UI Library tidak tersedia; backend dan data tidak terpengaruh. |
| PostgreSQL — tabel Step, StepColumn, StepLine, StepAttachment, StepBundle, anggota bundle, indeks unik fungsional, indeks `ChecklistItem.stepId` | Database | Dipakai backend | Baca dan tulis gagal; backend menjawab error generik (BR1.5). |

## Pola NFR per Komponen

| Pola | Komponen | Dokumen |
|---|---|---|
| Ringkasan daftar, agregasi `usageCount` terindeks, escape `q` | StepLibrary | `performance-design.md` |
| `bodyLimit` 24 MiB, pembatas tulis 4 serentak (503), `connection_limit=10` | StepLibrary | `performance-design.md`, `security-design.md` |
| Penguncian `id` naik, retry deadlock, pemetaan galat | StepLibrary, PostgreSQL | `scalability-design.md`, `reliability-design.md` |
| Indeks unik fungsional lewat migrasi SQL mentah | PostgreSQL | `reliability-design.md` |

## Perubahan Infrastruktur untuk Infrastructure Design

Tidak ada layanan atau port baru. Yang berubah: migrasi Prisma (tabel baru; `ChecklistItem.stepId` dari wajib menjadi nullable tanpa `ON DELETE SET NULL`; kolom `ChecklistItem.stepSnapshot` wajib dengan backfill item U1 dari data Step yang ada; `Step.pairedRollbackStepId` sebagai foreign key diri tanpa `ON DELETE CASCADE` (dikosongkan eksplisit oleh kode hapus); dua indeks unik fungsional; indeks `ChecklistItem.stepId`; rincian di `reliability-design.md ## Migrasi U2`), kueri `$queryRaw` dengan parameter array di-cast (`ANY(${ids}::text[])`), `connection_limit=10` di `DATABASE_URL`, `bodyLimit` Fastify, dan paket frontend Tailwind (`package.json` dan `package-lock.json`, dibangun di image frontend lewat `npm ci`).

## Assumptions & Open Questions

None.
