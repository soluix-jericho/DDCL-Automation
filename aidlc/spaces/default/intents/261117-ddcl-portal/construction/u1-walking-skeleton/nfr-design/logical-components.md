# NFR Design — u1-walking-skeleton — Logical Components

Sumber: `components.md` (Domain Design), jawaban `nfr-design-questions.md` Q6. Menjembatani keputusan NFR Design dengan Infrastructure Design — pandangan tingkat komponen tentang di mana pola NFR berlaku.

## Inventori Komponen Logis

| Komponen | Failure Domain | Shared Resource | Blast Radius jika Gagal |
|---|---|---|---|
| Backend (proses Fastify — StepLibrary, DdclDocument, ExcelExportService) | Backend | PostgreSQL (satu database) | Seluruh fitur skeleton (buat step, buat DDCL, ekspor) tidak tersedia — ketiga komponen domain hidup di satu proses yang sama. |
| Frontend (proses React + Vite) | Frontend | Tidak ada — hanya memanggil API backend | Pengguna tidak bisa berinteraksi lewat UI, tapi backend dan datanya tidak terpengaruh. |
| PostgreSQL | Database | Dipakai bersama oleh backend (satu-satunya pemakai) | Backend gagal menulis/membaca; frontend menampilkan error generik (BR1.5) sampai database pulih. |

## Isolasi Komponen

Dua failure domain (backend, frontend) terpisah mengikuti struktur monorepo dua-app yang sudah diafirmasi tim (`team.md` ## Code Style) — kegagalan satu tidak langsung menjatuhkan yang lain (jawaban Q6). Tidak ada isolasi lebih halus di dalam proses backend untuk skeleton ini: StepLibrary, DdclDocument, dan ExcelExportService berbagi satu proses dan satu database, konsisten dengan keputusan Domain Design bahwa ini adalah modular monolith, bukan microservices (`unit-of-work-dependency.md`: integrasi antar-Unit backend lewat modul internal).

## Assumptions & Open Questions

None.
