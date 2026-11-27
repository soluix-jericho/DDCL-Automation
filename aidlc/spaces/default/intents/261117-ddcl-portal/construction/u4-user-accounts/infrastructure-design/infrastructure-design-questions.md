# Infrastructure Design — u4-user-accounts — Questions

## Sources

- [memory] `nfr-design/logical-components.md` dan `reliability-design.md`: tidak ada layanan, port, atau komponen infrastruktur baru; berubah hanya konfigurasi lingkungan (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `COOKIE_SECURE`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `UV_THREADPOOL_SIZE`), skrip pemulihan di image backend, urutan start (cadangan, migrasi, admin pertama, pengisian `createdByUserId`), dan pembersihan terjadwal di proses backend.
- [memory] U1 dan U2 `infrastructure-design/`: tiga container Compose (`backend`, `frontend`, `db`), `start-prod.sh` (cadangan bersyarat lalu `prisma migrate deploy` lalu server), volume `ddcl_backups`, CI GitHub Actions (`ci.yml`, `load-test.yml`), tanpa CD, rollback lewat `git revert` dan pemulihan dari dump.
- [memory] `.env.example` dan `docker-compose.yml` saat ini: `FRONTEND_ORIGIN` dipakai untuk CORS; tidak ada variabel admin.
- [assumption] Frontend (`localhost:5173`) dan backend (`localhost:3000`) adalah situs yang sama (hanya beda port), sehingga cookie SameSite=Lax terkirim di fetch dengan kredensial. Belum dikonfirmasi untuk hosting di luar lokal.

## Q1. [Arsitek] Konfigurasi dan rahasia baru

`ADMIN_PASSWORD` adalah rahasia; `FRONTEND_ORIGIN` kini dipakai bersama CORS dan pemeriksaan Origin (`ALLOWED_ORIGINS`).

- A. Variabel baru diteruskan di `docker-compose.yml` dan ditulis di `.env.example` dengan placeholder (`ADMIN_PASSWORD=change-me-at-least-10-chars`; tanpa nilai bawaan di Compose, jadi backend gagal start bila tabel pengguna kosong dan variabel kosong). `ALLOWED_ORIGINS` (daftar dipisah koma, bawaan `http://localhost:5173`) menggantikan `FRONTEND_ORIGIN`, yang tetap dibaca sebagai cadangan selama satu rilis. `COOKIE_SECURE=false`, `TRUST_PROXY=false`, `UV_THREADPOOL_SIZE=8` ditulis dengan nilai bawaan lokal. `.env` tetap di luar git
- B. Seperti A, tetapi `FRONTEND_ORIGIN` dihapus langsung (tanpa cadangan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek/DevOps] Menjalankan skrip pemulihan

NFR3.22: kata sandi hanya dari prompt tersembunyi atau stdin, tidak lewat argumen atau `-e`.

- A. Skrip dibangun ke `dist/scripts/recovery.js` di image backend dan dijalankan `docker compose run --rm backend node dist/scripts/recovery.js <perintah>` (terminal interaktif untuk prompt, atau `--password-stdin` dengan `docker compose run --rm -T`); perintah: `reset-password`, `unlock`, `reactivate`, `make-admin`; langkah lengkap dan contoh dicatat di README
- B. Skrip dijalankan lewat `npm run recovery -- <perintah>` di dalam container
- X. Other (please specify)

[Answer]: A

## Q3. [DevOps] Pipeline CI

Test U4 butuh akun dan sesi; seluruh suite U1–U3 harus dijalankan ulang dengan helper login (NFR5.20).

- A. Workflow `ci.yml` tetap; menambah variabel uji di langkah test (nilai sekali pakai, bukan rahasia nyata: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`) dan satu test yang mendaftar semua rute terdaftar dan menegaskan tiap rute punya deklarasi role (gagal bila ada rute tanpa deklarasi); test beban mingguan `load-test.yml` ditambah skenario login serentak dan audit 500.000 baris (NFR1.20, NFR1.23)
- B. Seperti A, tetapi tanpa penambahan skenario di test beban
- X. Other (please specify)

[Answer]: B

## Q4. [Operasi] Pemantauan dan peringatan

Observability U4: log JSON, tabel audit, tanpa metrik atau alerting (NFR3.24–NFR3.27).

- A. Tidak ada alat pemantauan baru; README mencatat resep memeriksa log lewat `docker compose logs backend` (mis. mencari `login_locked`, `login_failed`, 5xx) dan layar Audit untuk lonjakan; tidak ada peringatan otomatis di v1
- B. Tambah pemeriksaan sederhana terjadwal di CI (workflow mingguan) yang membaca health endpoint
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Hosting di luar lokal dan cookie

Cookie SameSite=Lax hanya dikirim bila frontend dan backend satu situs (domain terdaftar sama). Di hosting nanti dengan domain berbeda, cookie tidak terkirim.

- A. Dicatat sebagai batasan: untuk hosting di luar lokal, frontend dan backend wajib satu situs (mis. `app.contoh.com` dan `api.contoh.com`, atau satu domain dengan proxy), dan `COOKIE_SECURE=true` dengan HTTPS; dicatat di README dan di `infrastructure-specification.md`; tidak ada pekerjaan tambahan di U4
- B. Frontend juga mendukung pembawa Bearer (token disimpan di memori, bukan penyimpanan browser) supaya domain berbeda bisa dipakai nanti; menambah pekerjaan frontend dan risiko pencurian token
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
