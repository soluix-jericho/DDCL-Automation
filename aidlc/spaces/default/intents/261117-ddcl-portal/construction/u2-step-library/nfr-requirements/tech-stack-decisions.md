# NFR Requirements — u2-step-library — Tech Stack Decisions

Sumber: U1 `tech-stack-decisions.md` (stack proyek tetap, tidak dipilih ulang), jawaban `nfr-requirements-questions.md` Q3 dan Q4.

| Lapisan | Pilihan | Rasional |
|---|---|---|
| Backend, ORM, database, sesi, testing, lint | Warisan U1: Fastify, Prisma, PostgreSQL, cookie HTTP-only, Vitest, ESLint + Prettier | Skema U2 memperluas skema U1 lewat migrasi Prisma; tidak ada pustaka backend baru. |
| Cari nama | `ILIKE` PostgreSQL lewat Prisma (`contains` dengan `mode: insensitive`) | Cukup untuk 1.000 step (Q3); tanpa indeks atau ekstensi baru. |
| Keunikan nama | Indeks unik fungsional PostgreSQL lewat migrasi SQL mentah (NFR4.7), dipakai bersama skema Prisma | Prisma `@@unique` tidak bisa menyatakan `lower(trim(name))`. |
| Ukuran body | `bodyLimit` Fastify 16 MiB pada rute Library (NFR1.10) | Batas bawaan 1 MiB lebih kecil dari ukuran maksimum sah NFR1.8. |
| Penguncian | `SELECT ... FOR UPDATE` pada baris `Step` di transaksi tulis (via `prisma.$queryRaw`) | Mewujudkan "terakhir menang" tanpa bentrok posisi (Q5, scalability). |
| Validasi input | Skema JSON bawaan Fastify | Sudah dipakai U1; dipakai juga untuk batas ukuran NFR1.8 dan tata bahasa variabel BR2.4 (pemeriksaan kurung kurawal di fungsi validasi sendiri). |
| Styling frontend | **Tailwind CSS v3 lewat PostCSS di build Vite** (devDependency `tailwindcss`, `postcss`, `autoprefixer`) | Diminta pengguna; dibangun saat build tanpa CDN supaya jalan lokal tanpa internet (Q4). Menambah paket frontend memerlukan `npm install` yang dijalankan di Code Generation setelah izin pengguna. |
| Komponen UI | React 18 tanpa pustaka komponen tambahan | Form kolom langkah, popup perbandingan, dan daftar cukup dengan React dan kelas Tailwind. |

## Alternatif yang Dipertimbangkan

| Lapisan | Alternatif | Mengapa tidak dipilih |
|---|---|---|
| Styling | Tailwind lewat CDN | Butuh internet saat dijalankan dan tidak untuk produksi (Q4). |
| Cari | Indeks teks penuh (`pg_trgm`) | Belum perlu di skala v1; menjadi pemicu peningkatan di `scalability-requirements.md`. |
| Komponen UI | Pustaka komponen (mis. MUI) | Menambah dependensi besar dan gaya yang bersaing dengan Tailwind. |

## Assumptions & Open Questions

None.
