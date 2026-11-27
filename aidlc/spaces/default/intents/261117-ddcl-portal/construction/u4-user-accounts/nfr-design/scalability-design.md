# NFR Design — u4-user-accounts — Scalability

Sumber: `nfr-requirements/scalability-requirements.md` (NFR1.25, NFR4.20), `reliability-requirements.md` NFR4.21, jawaban `nfr-design-questions.md` Q1, Q2.

## Arsitektur

Backend tanpa status di memori yang menentukan kebenaran: sesi, penghitung penguncian, dan audit seluruhnya di PostgreSQL. Satu-satunya status dalam proses adalah pintu hash (penghitung 2 slot) dan penjadwal pembersihan. Untuk v1 backend berjalan sebagai satu instance (asumsi); bila nanti lebih dari satu, kebenaran tetap terjaga karena kunci baris di database, hanya batas 2 hash yang berlaku per instance.

## Kapasitas (NFR1.25)

- Di bawah 20 akun aktif dan diperkirakan di bawah 100 sesi aktif total; jumlah sesi per akun tidak dibatasi tetapi dibatasi masa berlaku dan pembersihan.
- Login serentak dibatasi 2 hash berjalan dengan antrean; di atas itu target NFR1.20 tidak dijamin.

## Pembersihan Terjadwal (NFR4.20)

| Data | Dihapus bila | Cara |
|---|---|---|
| `Session` | `COALESCE(revokedAt, LEAST(lastSeenAt + 8 jam, createdAt + 7 hari))` lebih tua dari 7 hari (yaitu sudah dicabut atau sudah kedaluwarsa lebih dari 7 hari) | Hapus per kelompok 1.000 baris sampai habis |
| `LoginThrottle` | `lockedUntil` kosong atau sudah lewat, dan `updatedAt` lebih dari 24 jam (baris yang sedang terkunci tidak pernah dihapus) | Sama |
| `AuditEvent` | `occurredAt` lebih dari 1 tahun | Sama, memakai indeks `occurredAt` |

- Penjadwal berupa timer dalam proses backend: satu putaran di latar belakang setelah server mendengarkan (tidak menahan start) dan lalu tiap jam. Setiap putaran memakai penghapusan berkelompok dengan jeda singkat antar kelompok supaya tidak menahan kueri lain.
- Tiap kelompok dipilih dengan `FOR UPDATE SKIP LOCKED` sehingga dua instance yang berjalan bersamaan tidak saling menunggu atau menghapus baris yang sama; penghapusan idempoten (kondisi `WHERE` sama, tidak ada status bersama).
- Hasil (jumlah baris terhapus per jenis) dicatat di log; kegagalan dicatat sebagai peringatan dan dicoba lagi jam berikutnya (NFR3.23).

## Pertumbuhan (dasar NFR1.23)

`AuditEvent` sekitar 20 pengguna × 50 peristiwa per hari × 365 hari, di bawah 500.000 baris. Pemicu peningkatan: bila daftar audit melewati 1 detik atau baris melewati 500.000, tambahkan indeks komposit atau pembagian tabel lewat migrasi Prisma.

## Konkurensi

| Kasus | Mekanisme |
|---|---|
| Penghitung login paralel untuk satu email | Transaksi dengan `SELECT ... FOR UPDATE` pada baris `LoginThrottle` email itu (Q2 A) |
| Dua admin saling menonaktifkan atau menurunkan | Transaksi yang mengunci seluruh baris admin aktif; yang kedua melihat keadaan setelah yang pertama |
| Pembuatan admin pertama oleh dua instance | Transaksi dengan pengecekan tabel `User` kosong; yang kedua melihat admin sudah ada |
| Pengisian `createdByUserId` | Transaksi data tunggal di bawah kunci penasihat yang sama dengan pembuatan admin, hanya baris yang masih kosong, idempoten |

## Assumptions & Open Questions

None.
