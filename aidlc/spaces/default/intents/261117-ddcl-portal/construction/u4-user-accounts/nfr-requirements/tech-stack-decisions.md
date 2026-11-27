# NFR Requirements — u4-user-accounts — Tech Stack Decisions

Sumber: U1 dan U2 `tech-stack-decisions.md` (stack proyek tetap, tidak dipilih ulang), `team.md` ## Testing Posture, jawaban `nfr-requirements-questions.md` Q1, Q2, Q3, Q6, Q7.

| Lapisan | Pilihan | Rasional |
|---|---|---|
| Backend, ORM, database, testing, lint | Warisan U1: Fastify, Prisma, PostgreSQL, Vitest, ESLint + Prettier | Skema U4 memperluas skema U1 lewat migrasi Prisma; tidak ada pustaka backend baru. |
| Hash kata sandi | `scrypt` asinkron dari modul kripto bawaan Node (N=32768, r=8, p=1, `maxmem` 64 MiB), batas 2 hash berjalan bersamaan di dalam proses, `UV_THREADPOOL_SIZE=8` | Keputusan manusia Q2 (tanpa dependensi baru); batas bersamaan dan ukuran threadpool melindungi server dan operasi lain dari pembekuan (NFR1.24). |
| Token sesi | Byte acak 256 bit dari modul kripto bawaan Node; SHA-256 disimpan | Sesi bisa dicabut, kebocoran database tidak membocorkan sesi aktif. |
| Cookie dan header sesi | `@fastify/cookie` yang sudah ada (cookie httpOnly, SameSite=Lax) dan pembacaan header `Authorization: Bearer` | Q7 (B); tidak ada paket baru. |
| CORS dan Origin | `@fastify/cors` yang sudah ada dengan daftar `ALLOWED_ORIGINS` | Daftar satu sumber untuk CORS dan pemeriksaan Origin. |
| Pembersihan terjadwal | Penjadwal per jam di dalam proses backend (timer), penghapusan idempoten | Cukup untuk satu instance v1 lokal; tanpa layanan baru. |
| Skrip pemulihan | Skrip Node di image backend, dijalankan `docker compose run backend ...` | NFR3.22; memakai kode hash dan aturan yang sama dengan portal. |
| Konfigurasi | Variabel lingkungan `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `COOKIE_SECURE`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `UV_THREADPOOL_SIZE`, ditambahkan ke contoh env dan Compose | Kredensial tidak di kode (NFR2.3 U1). |
| Frontend | React 18 dan Tailwind v3 warisan U2, tanpa pustaka baru; layar Login, Akun, Audit, dan ganti kata sandi; frontend memakai cookie sesi dan tidak menyimpan token di penyimpanan browser | Cukup dengan komponen yang ada. |

## Persyaratan Pengujian

| ID | Requirement |
|---|---|
| NFR5.20 | Coverage baris minimal 80% (scope `mvp`, NFR5) untuk kode U4, test berjalan di CI. Test wajib: login berhasil dan gagal, email tak terdaftar dan akun nonaktif memberi jawaban generik yang sama, penguncian pada percobaan ke-5 termasuk jalur ganti kata sandi, sesi kedaluwarsa (diam 8 jam, mutlak 7 hari), logout, 401 pada semua rute tanpa sesi (termasuk cookie `dev-session` lama), 403 per role untuk setiap baris tabel NFR2.27, pemeriksaan Origin (cookie ditolak, Bearer lolos), preflight OPTIONS tidak butuh sesi, admin terakhir tidak bisa dinonaktifkan atau diturunkan (termasuk dua permintaan paralel), migrasi `createdByUserId`, tidak ada rahasia di respons, log, dan audit, serta seluruh suite U1–U3 dijalankan ulang dengan helper login sebagai regresi. |

## Alternatif yang Dipertimbangkan

| Lapisan | Alternatif | Mengapa tidak dipilih |
|---|---|---|
| Hash kata sandi | `argon2` | Menambah dependensi baru (Q2). |
| Sesi | JWT tanpa status | Sulit dicabut saat logout atau penonaktifan akun (BR4.7, BR4.13). |
| Sesi | Redis atau penyimpanan terpisah | Layanan baru yang tidak perlu untuk di bawah 20 pengguna. |
| Pembersihan | Cron di luar proses | Menambah komponen operasional; timer cukup untuk satu instance. |
| Audit | Hanya log stdout | Tidak bisa dilihat admin di portal (Q5 B). |

## Assumptions & Open Questions

None.
