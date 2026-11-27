# NFR Design — u4-user-accounts — Logical Components

Sumber: semua artefak `nfr-design/` unit ini, `inception/domain-design/components.md` (komponen UserAccount), `tech-stack-decisions.md`. Tidak ada infrastruktur baru: semua komponen berjalan di proses backend dan frontend yang sudah ada serta PostgreSQL yang sudah ada.

## Inventaris Komponen Logis

| Komponen | Letak | Tanggung jawab | Pola NFR |
|---|---|---|---|
| SessionGate | Backend, pintu masuk `/api/v1/*` | Rantai Origin, token, sesi, role (urutan di `security-design.md`) | NFR2.21–NFR2.27, NFR1.21 |
| RoleRegistry | Backend, metadata rute | Role minimal per rute; bawaan admin | NFR2.27 |
| HashGate | Backend, dalam proses | 2 slot hash, antrean FIFO, batas tunggu 5 detik → 503; pembungkus `scrypt` | NFR1.24, NFR2.20 |
| PasswordService | Backend | Hash, verifikasi waktu-konstan, hash tiruan, aturan panjang | NFR2.20 |
| ThrottleService | Backend | Penghitung dan kunci per email dengan `FOR UPDATE` | NFR2.24 |
| SessionService | Backend | Terbit, cari, geser `lastSeenAt` (maksimal sekali per menit, galat ditangkap), cabut (termasuk sesi lama yang dibawa permintaan login) | NFR2.21, NFR1.21 |
| AccountService | Backend | Buat akun, ubah role/status (penjaga admin terakhir), atur ulang kata sandi, buka kunci | BR4.10–BR4.19 |
| AuditWriter | Backend | Tulis `AuditEvent` dalam transaksi atau upaya terbaik; filter dan kursor baca | NFR2.30, NFR3.23, NFR3.27 |
| StartupBootstrap | Backend, saat start | Admin pertama dan pengisian serta verifikasi `createdByUserId` di bawah kunci penasihat; tanpa DDL di luar Prisma | NFR3.21 |
| RetentionJob | Backend, timer per jam | Pembersihan `Session`, `LoginThrottle`, `AuditEvent` berkelompok | NFR4.20, NFR4.21 |
| RecoveryScript | Image backend, dijalankan manual | Atur ulang kata sandi, buka kunci, aktifkan kembali, jadikan admin | NFR3.22 |
| LogRedactor | Backend, konfigurasi logger | Menyamarkan field sensitif | NFR2.29, NFR3.25 |
| AuthContext + ApiClient | Frontend | Muat identitas dari `/auth/me`, tangani 401 (ke Login) dan 403 (pesan), sembunyikan tombol sesuai role | NFR2.27 (kenyamanan, bukan penegakan) |
| Layar Login, Akun, Audit, Ganti Kata Sandi | Frontend | Antarmuka W2, W5–W8, W10, W11 | BR4.x |

## Domain Kegagalan dan Radius Dampak

| Kegagalan | Dampak | Penahan |
|---|---|---|
| PostgreSQL tidak tersedia | Seluruh API 500 (gagal tertutup); tidak ada akses tanpa sesi | NFR3.20 |
| Antrean HashGate penuh | Login baru 503; permintaan terautentikasi lain tidak terdampak | NFR1.24 |
| AuditWriter gagal (mode transaksi) | Satu perubahan akun dibatalkan | NFR3.23 |
| AuditWriter gagal (upaya terbaik) | Satu baris audit login hilang; log tetap ada | NFR3.23 |
| RetentionJob gagal | Tabel tumbuh sementara; dicoba lagi jam berikutnya | NFR3.23 |
| StartupBootstrap gagal | Backend tidak start | NFR3.21 |

## Sumber Daya Bersama

| Sumber daya | Dipakai oleh | Catatan |
|---|---|---|
| PostgreSQL | Semua komponen backend | Satu-satunya penyimpan status |
| Threadpool libuv (`UV_THREADPOOL_SIZE=8`) | HashGate (maksimal 2) dan operasi berkas/kompresi/ekspor Excel | 6 thread tersisa untuk operasi lain |
| Memori proses | HashGate (sekitar 128 MiB di puncak) | `maxmem` 64 MiB per hash |

## Hubungan dengan Unit Lain

SessionGate dan RoleRegistry melindungi seluruh rute U1–U3 dan otomatis U5/U6; U3, U5, dan U6 mendeklarasikan role minimal tiap rute baru. DdclDocument membaca `User` hanya lewat `createdByUserId`.

## Assumptions & Open Questions

None.
