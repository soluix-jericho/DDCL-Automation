# NFR Design — u4-user-accounts — Reliability

Sumber: `nfr-requirements/reliability-requirements.md` (NFR3.20–NFR3.23, NFR4.21), `rules.md` BR4.11, BR4.16, BR4.18, BR4.20, jawaban `nfr-design-questions.md` Q4 dan Q5.

## Kegagalan Tertutup (NFR3.20)

Saat database tidak bisa dijangkau, rantai penegakan tidak bisa memvalidasi sesi. Permintaan dijawab 500 generik dan tidak pernah diteruskan tanpa sesi; detail ada di log. Tidak ada retry otomatis atau fallback (sesuai U1), kecuali pintu hash yang menjawab 503 saat antrean penuh.

## Urutan Start Backend dan Migrasi (NFR3.21, Q5 A)

| Langkah | Isi | Bila gagal |
|---|---|---|
| 0 | Cadangan database otomatis dengan mekanisme pra-migrasi yang sama dengan U2 (dijalankan dari urutan `start-prod.sh` sebelum migrasi) | Start dihentikan |
| 1 | `prisma migrate deploy`: membuat tabel `User`, `Session`, `LoginThrottle`, `AuditEvent` dan kolom `createdByUserId` pada `DdclDocument` sebagai **kolom yang boleh kosong dengan foreign key ke `User`**; semua DDL ada di riwayat migrasi Prisma sehingga `schema.prisma` selalu sama dengan database (instalasi baru maupun lama), dan tidak ada DDL di luar migrasi | Dibatalkan semua (satu transaksi per migrasi); start dihentikan |
| 2 | Kode backend, dengan kunci penasihat database (`pg_advisory_xact_lock`) agar hanya satu instance yang bekerja pada satu waktu: bila tabel `User` kosong, buat admin pertama dari `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` (BR4.11) dalam transaksi dengan pengecekan kosong | Start dihentikan dengan pesan yang menyebut variabel yang kurang atau tidak sah (tanpa nilai kata sandi); tahap 1 tetap ada |
| 3 | Kode backend, di bawah kunci penasihat yang sama, satu transaksi data saja (tanpa DDL): isi `createdByUserId` baris yang masih kosong dengan admin pertama (admin ber-`createdAt` paling awal, id sebagai pemutus seri), lalu verifikasi tidak ada baris `DdclDocument` dengan `createdByUserId` kosong | Dibatalkan; start dihentikan; langkah 1 dan admin dari langkah 2 tetap ada |
| 4 | Mulai menerima permintaan; pembersihan pertama dijalankan di latar belakang setelah server mendengarkan (tidak menahan start) | Kegagalan pembersihan hanya peringatan |

- **Kolom wajib ditegakkan aplikasi:** `createdByUserId` tetap nullable di tingkat database (agar tidak ada DDL di luar Prisma); BR4.16 ditegakkan oleh kode (pembuatan DDCL selalu mengisinya dari sesi), oleh verifikasi langkah 3 setiap start, dan oleh test wajib (NFR5.20). Menambah `NOT NULL` lewat migrasi Prisma tersendiri ditunda sampai semua instalasi sudah terisi (tinjau di U5, yang membaca kolom ini).
- **Hak DDL:** satu-satunya DDL dijalankan `prisma migrate deploy` dengan akun database yang sudah dipakai U1 dan U2; kode backend memakai akun yang sama hanya untuk DML dan tidak butuh hak tambahan.
- **Dua instance start bersamaan:** langkah 2 dan 3 diserialkan oleh kunci penasihat; instance kedua melihat hasil instance pertama dan melewati pekerjaan yang sudah selesai.
- **Aman dijalankan ulang:** langkah 2 tidak membuat admin kedua bila tabel `User` sudah berisi; langkah 3 hanya mengisi baris kosong. Menjalankan ulang setelah kegagalan di langkah mana pun menyelesaikan sisanya tanpa duplikasi.
- **Instalasi baru** (tanpa DDCL lama): langkah 3 berjalan tanpa baris yang diisi; `ADMIN_*` tetap wajib di langkah 2 bila tabel `User` kosong, tanpa itu backend gagal start (BR4.11).
- **Instalasi yang sudah punya admin:** `ADMIN_*` diabaikan sepenuhnya.
- Pemulihan penuh dari cadangan pra-migrasi adalah prosedur manual yang dicatat di instruksi Build and Test.

## Semantik Penulisan Audit (NFR3.23, Q4 A)

| Peristiwa | Cara tulis | Bila gagal |
|---|---|---|
| Akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti atau diatur ulang, kunci dibuka | Dalam transaksi yang sama dengan perubahannya | Perubahan ikut dibatalkan; klien menerima 500 |
| Login berhasil, login gagal, penguncian, logout | Setelah keputusan, upaya terbaik | Kegagalan dicatat di log; jawaban ke klien tidak berubah |
| Pemakaian skrip pemulihan | Dalam transaksi yang sama dengan perubahannya | Skrip gagal dan melaporkan galat |

## Skrip Pemulihan (NFR3.22)

- Skrip Node di image backend: atur ulang kata sandi, buka kunci email, aktifkan kembali akun, jadikan akun admin.
- Kata sandi hanya dari prompt tersembunyi di terminal interaktif atau stdin; argumen baris perintah dan `-e VAR=nilai` ditolak.
- Mengatur ulang kata sandi mencabut semua sesi akun itu dan membuka kunci emailnya. Setiap aksi menulis `AuditEvent` (pelaku kosong, keterangan `recovery-script`) dan baris log.
- Jalur utama tetap layar Akun (BR4.18); skrip adalah jalur terakhir bila tidak ada admin yang bisa login.

## Pembersihan Terjadwal dan Ketahanan Data (NFR3.23, NFR4.21)

- Kegagalan pembersihan tidak menghentikan backend; dicoba lagi jam berikutnya.
- `User` tidak pernah dihapus, sehingga `createdByUserId` selalu valid. `Session`, `LoginThrottle`, dan `AuditEvent` dibersihkan otomatis (NFR4.20); `AuditEvent` 1 tahun adalah pengecualian tercatat terhadap NFR4.

## Backup

Selain cadangan pra-migrasi, backup berkala di luar cakupan v1 (sama seperti U1 dan U2).

## Assumptions & Open Questions

None.
