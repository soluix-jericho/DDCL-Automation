# Code Summary — u4-user-accounts

## Status build

Kode dan test ditulis lalu dijalankan lewat Docker Compose (image dibangun ulang lewat `docker compose build backend frontend`).

- Backend `tests/u4`: 21 file, 231 test lulus. Frontend `tests/u4`: 6 file, 42 test lulus.
- Regresi U1+U2 yang disesuaikan agar login: backend 18 file, 234 test lulus; frontend 7 file, 69 test lulus.
- Suite penuh dengan coverage: backend 39 file, 465 test, 97,96% baris; frontend 13 file, 111 test, 98,67% baris. Lantai 80% (`thresholds.lines`) tidak diubah.
- `tsc --noEmit` dan `eslint .` bersih di kedua app. `prisma migrate diff` migrasi lawan skema kosong.
- Test beban `auth.load.test.ts`: 4 test lulus. p95 100 login 614 ms (batas < 1000); gerbang sesi menambah 14 vs 15 ms (batas ≤ 50); daftar audit pada 500.000 baris 11 ms (batas < 2000); 150 login serentak menghasilkan 103 jawaban 503 dengan `Retry-After: 5`.
- Smoke test `node dist/server.js` pada database uji: tanpa `ADMIN_*` atau dengan nilai placeholder backend gagal start dengan pesan jelas; dengan `ADMIN_*` sah admin pertama terbentuk dan login lewat HTTP berhasil (cookie `HttpOnly; SameSite=Lax; Path=/`); `/auth/me` dan `/audit-events` 200, tanpa sesi 401.

## Files created/modified

- Konfigurasi dan dokumen: `docker-compose.yml`, `.env.example`, `README.md`, dan `contract-summary.md` (Contract 1 diperluas, catatan 401/403/429 untuk Contract 2–5). `.github/workflows/ci.yml` tidak berubah.
- Backend baru (`src/`): `passwordService`, `hashGate`, `accountRules`, `roles`, `sessionToken`, `auditRepository`, `throttleService`, `sessionRepository`, `accountRepository`, `bootstrap`, `retention`, `sessionGate`, `authRoutes`, `userRoutes`, `auditRoutes`, `scripts/recovery`; migrasi `20261127000000_u4_user_accounts`.
- Backend diubah: `prisma/schema.prisma`, `app.ts` (hook stub dev dihapus, SessionGate, CORS, redaksi log), `config.ts`, `errors.ts`, `libraryTx.ts` (hanya ekspor `isDeadlock`), `repository.ts`, `rules.ts`, `server.ts`.
- Frontend baru: `auth/AuthContext`, layar Login, Akun, Audit, dialog Ganti Kata Sandi. Diubah: `App.tsx`, `api.ts`, `ComposeScreen`, `LibraryScreen`.
- Test baru: `backend/tests/u4/` (21 file), `backend/tests/load/auth.load.test.ts`, `frontend/tests/u4/` (7 berkas). Test U1/U2 disesuaikan agar login (bukan dilonggarkan): `createdBy` stub menjadi `createdByUserId`, `makeApp` U2 memakai `authApp`/`as(role)`, tes cookie stub menjadi tes 401.

## Key decisions

- Penegakan satu pintu (SessionGate): Origin → token (Bearer lalu cookie) → SHA-256 → Session+User → role dari RoleRegistry; rute tak terdaftar bernilai admin (rute U3 tinggal mendeklarasikan role).
- Protokol login A–hash–B dengan jam database, HashGate 2 slot (503 setelah 5 detik).
- Kolom `DdclDocument.createdBy` dihapus; respons `createdBy` diturunkan dari nama pembuat; `createdByUserId` nullable di DB dan ditegakkan kode.
- Dua tambahan yang tercatat di Assumptions plan: indeks `Session.userId` dan nilai enum `account_reactivated`.

## Deviasi dari rencana (kecil)

1. Seam uji `onRoute` di `BuildAppOptions` agar test "setiap rute punya deklarasi role" (NFR5.20) bisa mendaftar rute.
2. `createRepository(prisma, { passwords? })` menerima layanan hash lewat injeksi; test memakai scrypt N=1024, parameter bawaan diuji tersendiri.
3. `LibraryScreen`/`ComposeScreen` menerima prop opsional `canWrite`/`canDelete` (bawaan `true`); backend tetap penegak.
4. Kata sandi dinormalisasi NFKC sebelum scrypt.
5. Detail audit `make-admin` pada skrip pemulihan: `recovery-script: <role lama> -> admin`.
6. Retensi sesi: dicabut > 7 hari, idle > 7 hari 8 jam, atau umur > 14 hari (tafsiran atas "dicabut atau kedaluwarsa > 7 hari").
7. `role` tidak mengikuti tabel `functional-spec.md` untuk rute U3 (belum ada), sesuai catatan NFR2.27. Pembaruan `requirements.md`, `unit-of-work.md`, `stories.md` untuk deviasi role di luar rencana dan butuh persetujuan orang.

## Tests written but not executed

- `docker compose up` utuh pada database dev: tidak dijalankan karena akan menerapkan migrasi U4 ke data dev. Alur start-prod lengkap (cadangan, migrasi, admin pertama, backfill) belum dicoba di Compose utuh; dicakup smoke test di atas.
- Prompt kata sandi tersembunyi di TTY nyata (`/* v8 ignore */`): dicek manual; logika inti dan `--password-stdin` diuji otomatis.

## Open issues

- `stepsApi.test.ts` U2 ("step made of 4-byte characters") memakan ~10 detik, dekat batas transaksi 10 detik; satu run gagal 500 pada gabungan dengan `writeLimiter`, lulus saat sendiri dan di semua run penuh. Kemungkinan flaky di WSL, bukan akibat U4; perlu dipantau.
- `prettier --check src` melaporkan 22 file (termasuk U1/U2 yang sudah begitu); CI hanya menjalankan lint dan typecheck.
- `.env` yang ada belum memiliki `ADMIN_EMAIL`/`ADMIN_PASSWORD`; backend sengaja gagal start sampai diisi. `FRONTEND_ORIGIN` lama tetap terbaca sebagai cadangan.
- Developer agent mengaku beberapa edit lewat shell, bukan file tool; hasil sudah dikompilasi dan diuji.
