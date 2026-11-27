# Unit Test Instructions — u4-user-accounts

Metodologi: **test-after** per lapisan (Testing Contract). Strategi: Standard (5–8 test per komponen, plus test integrasi untuk batas penting). Lantai scope `mvp`: coverage baris 80% per app dan eksekusi di CI sebelum merge.

## Kerangka dan konfigurasi

- Backend dan frontend: Vitest 2.1.8 (sudah ada dari U1; tidak ada runner atau dependensi baru). Backend memakai PostgreSQL nyata (database uji `*_test`, dibuat dan dimigrasi oleh `tests/global-setup.ts`, sehingga migrasi U4 ikut diuji); frontend memakai jsdom dan Testing Library.
- Test U4 ada di `backend/tests/u4/` dan `frontend/tests/u4/`. Test beban terpisah di `backend/tests/load/` (dikecualikan dari suite biasa; konfigurasi `vitest.load.config.ts`).
- Prasyarat (satu kali): `.env` berisi `TEST_DATABASE_URL` (contoh di `.env.example`) dan layanan `db` berjalan: `docker compose up -d db`.

## Perintah yang dapat dijalankan (dibatasi pada Unit ini)

Setelah kode berubah, image dibangun ulang lebih dulu karena kode disalin ke image:

```bash
docker compose build backend frontend
```

Backend, hanya test U4 (jalan sebelum test pertama setelah runner siap):

```bash
docker compose run --rm backend npx vitest run tests/u4
```

Frontend, hanya test U4:

```bash
docker compose run --rm --no-deps frontend npx vitest run tests/u4
```

Per lapisan (dipakai selama pembangunan, tiap lapisan diuji sebelum lanjut):

```bash
docker compose run --rm backend npx vitest run tests/u4/data-model.test.ts tests/u4/migration.test.ts
docker compose run --rm backend npx vitest run tests/u4/passwordService.test.ts tests/u4/hashGate.test.ts tests/u4/accountRules.test.ts tests/u4/roles.test.ts tests/u4/sessionToken.test.ts
docker compose run --rm backend npx vitest run tests/u4/auditRepository.test.ts tests/u4/throttleService.test.ts tests/u4/sessionRepository.test.ts tests/u4/accountRepository.test.ts tests/u4/bootstrap.test.ts tests/u4/retention.test.ts tests/u4/recovery.test.ts tests/u4/concurrency.test.ts
docker compose run --rm backend npx vitest run tests/u4/authApi.test.ts tests/u4/usersApi.test.ts tests/u4/auditApi.test.ts tests/u4/sessionGate.test.ts tests/u4/routeRoles.test.ts tests/u4/logging.test.ts
```

Regresi U1 dan U2 yang disesuaikan agar login (harus tetap hijau; ini titik integrasi yang dicatat di `unit-of-work.md`, W9):

```bash
docker compose run --rm backend npx vitest run tests/u1 tests/u2
docker compose run --rm --no-deps frontend npx vitest run tests/u1 tests/u2
```

Test beban (manual atau mingguan di CI, bukan di suite biasa; perintah terpisah tanpa langkah lain sesudahnya):

```bash
docker compose run --rm backend npx vitest run -c vitest.load.config.ts tests/load/auth.load.test.ts
```

## Target coverage

- Lantai proyek: 80% baris per app (`backend/vitest.config.ts` dan `frontend/vitest.config.ts` memuat `thresholds.lines: 80`; tidak diubah). **Lantai ini diukur Build and Test pada suite penuh** dengan `npx vitest run --coverage` per app; satu run Unit-scoped tidak menjadi hakim lantai itu, dan ambangnya tidak boleh diturunkan agar run lolos.
- Target Unit ini: semua modul baru (`passwordService`, `hashGate`, `accountRules`, `roles`, `sessionToken`, `throttleService`, `sessionRepository`, `accountRepository`, `auditRepository`, `bootstrap`, `retention`, `sessionGate`, `authRoutes`, `userRoutes`, `auditRoutes`, `scripts/recovery`, `auth/AuthContext`, layar Login/Akun/Audit/Ganti Kata Sandi) mendekati 90% baris. Cabang galat (401, 403, 409, 429, 503, kegagalan audit, deadlock diulang) wajib tersentuh.
- Target kualitas terukur dari NFR (NFR1.20–NFR1.24, p95 login, sesi, audit, 503) diperiksa oleh test beban `auth.load.test.ts`; ambang tidak boleh dilonggarkan agar lolos.

## Mocking dan stub

- Database: **tidak di-mock**. Test repository dan API memakai PostgreSQL uji nyata, karena kunci baris (`FOR UPDATE`), kunci penasihat, indeks, dan jam `now()` database hanya terbukti pada database sungguhan.
- Jam: kedaluwarsa sesi (diam 8 jam, umur 7 hari), kunci 15 menit, dan retensi diuji dengan mengubah kolom waktu baris ke masa lalu lewat SQL; tidak ada penggeser jam proses karena logika memakai jam database.
- Hash: test yang tidak menguji hash memakai `makeSession` yang menulis hash tetap murah agar suite tidak lambat; test kata sandi dan login memakai `PasswordService` nyata. HashGate diuji dengan batas dan fungsi tertunda yang dapat disuntik.
- Konkurensi: beberapa permintaan dibuat dengan `Promise.all` dan gerbang `Promise` agar urutan bersilang terjadi deterministik; hasil dinilai dari keadaan akhir database (jumlah kegagalan, admin tersisa, tanpa 500).
- Frontend: `fetch` di-stub dengan router `"METHOD path"` (`tests/u4/mock.ts`, memakai pola U2); tidak ada panggilan jaringan nyata.
- Skrip pemulihan: fungsi inti diuji langsung dan lewat `--password-stdin`; prompt TTY tersembunyi diperiksa manual.

## Data uji

- Setiap test backend memulai dari `truncateAll` (diperluas dengan `AuditEvent`, `LoginThrottle`, `Session`, `User`); akun dibuat lewat `makeUser(prisma, {role, status})`. Kata sandi uji ada di kode test (bukan kredensial nyata) dan tidak dipakai di luar database uji.
- Seed 500.000 `AuditEvent` untuk test beban dibangkitkan dengan `INSERT ... SELECT generate_series(...)`; tidak ada data operasional nyata dan tidak ada kredensial di berkas.

## Pemeriksaan manual (tidak otomatis)

- Start pertama dengan Docker Compose utuh: tanpa `ADMIN_*` backend gagal start dengan pesan jelas; dengan `ADMIN_*` sah admin pertama terbentuk, DDCL lama diisi pembuatnya, dan login lewat frontend berhasil.
- Skrip pemulihan dengan terminal interaktif: `docker compose run --rm backend node dist/scripts/recovery.js reset-password <email>` meminta kata sandi tanpa gema (README, bagian Pemulihan akses).
