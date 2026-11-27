# NFR Requirements — u4-user-accounts — Reliability

Sumber: `requirements.md` NFR3 dan NFR4, U1 `reliability-requirements.md` (NFR3.1–NFR3.4) dan U2, `rules.md` BR4.11, BR4.16, BR4.18, BR4.20, jawaban `nfr-requirements-questions.md` Q3 dan Q6.

## Ketersediaan dan Toleransi Kegagalan

| ID | Requirement |
|---|---|
| NFR3.20 | Tidak ada SLA/SLO uptime formal untuk v1 (alat internal lokal, NFR3.1 U1). Saat database tidak bisa dijangkau, pemeriksaan sesi gagal tertutup: permintaan dijawab 500 generik dan tidak pernah dilewatkan tanpa sesi; detail dicatat di log server. |
| NFR3.21 | Migrasi U4 berjalan dalam dua tahap berurutan karena admin pertama dibuat oleh kode aplikasi (hash scrypt), bukan oleh SQL. Cadangan database otomatis (mekanisme pra-migrasi yang sama dengan U2) diambil sebelum tahap 1. Tahap 1 (migrasi skema, satu transaksi): membuat tabel `User`, `Session`, `LoginThrottle`, `AuditEvent` dan menambah kolom `createdByUserId` yang masih boleh kosong; gagal berarti dibatalkan semua. Antara dua tahap: bila tabel `User` kosong, admin pertama dibuat dari `ADMIN_EMAIL`/`ADMIN_PASSWORD` (BR4.11); gagal membuatnya menghentikan start. Tahap 2 (pengisian data, satu transaksi): mengisi `createdByUserId` semua DDCL lama dengan admin pertama (admin dengan `createdAt` paling awal, id sebagai pemutus seri), lalu menjadikan kolom wajib dengan foreign key; gagal berarti tahap 2 dibatalkan dan backend tidak start, sementara tahap 1 dan admin yang sudah dibuat tetap ada karena aman dijalankan ulang (pengisian idempoten: hanya baris `createdByUserId` kosong yang diisi). Pemulihan penuh dari cadangan hanya dilakukan manual bila diperlukan. |
| NFR3.22 | Jalur pemulihan akses di luar portal: skrip perintah di server (`docker compose run backend ...`) untuk mengatur ulang kata sandi akun, membuka kunci login satu email, mengaktifkan kembali akun nonaktif, dan menjadikan akun sebagai admin. Skrip memakai aturan yang sama dengan portal (kata sandi 10–128 karakter, hash scrypt), mencabut semua sesi akun saat kata sandi diatur ulang, membaca kata sandi hanya dari prompt tersembunyi di terminal (`docker compose run` dengan terminal interaktif) atau dari standar input (`--password-stdin`); argumen baris perintah dan `-e VAR=nilai` tidak diterima karena masuk riwayat shell. Setiap pemakaian ditulis sebagai `AuditEvent` dengan pelaku kosong dan keterangan `recovery-script` (jenis `password_reset_by_admin`, `lockout_cleared_by_admin`, `account_reactivated`, atau `role_changed`), dan juga di log, tanpa kata sandi; dengan demikian jalur ini terlihat di layar Audit. Admin lewat layar Akun (BR4.18) adalah jalur utama; skrip adalah jalur terakhir bila tidak ada admin yang bisa login. |
| NFR3.23 | Kegagalan mencatat `AuditEvent` pada perubahan akun membatalkan perubahan itu; kegagalan mencatat login gagal tidak mengubah jawaban 401 ke klien (BR4.20). Kegagalan pembersihan terjadwal (NFR4.20) dicatat sebagai peringatan dan tidak menghentikan backend; percobaan berikutnya jam berikutnya. |

## Backup dan Pemulihan

Data ada di volume PostgreSQL Docker Compose; selain cadangan pra-migrasi (NFR3.21), backup berkala di luar cakupan v1 sebagaimana U1 dan U2. Pemulihan dari cadangan pra-migrasi adalah prosedur manual yang dicatat di instruksi Build and Test.

## Ketahanan Data

| ID | Requirement |
|---|---|
| NFR4.21 | Baris `User` tidak pernah dihapus (akun hanya dinonaktifkan), sehingga `createdByUserId` pada DDCL selalu valid (NFR4). Data operasional yang dibersihkan otomatis hanya `Session`, `LoginThrottle` (NFR4.20), dan `AuditEvent`: `AuditEvent` lebih tua dari 1 tahun dihapus otomatis (keputusan manusia Q13). Ini pengecualian tercatat terhadap "tanpa penghapusan otomatis"; NFR4 inception hanya mencakup data DDCL dan Library, yang tidak pernah dihapus otomatis. |

## Assumptions & Open Questions

None.
