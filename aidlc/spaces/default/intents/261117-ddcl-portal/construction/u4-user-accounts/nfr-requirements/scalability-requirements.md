# NFR Requirements — u4-user-accounts — Scalability

Sumber: `requirements.md` NFR1 dan NFR4, `rules.md` BR4.4, BR4.6, BR4.20, jawaban `nfr-requirements-questions.md` Q2 dan Q5.

## Proyeksi Beban dan Data

| ID | Requirement |
|---|---|
| NFR1.25 | Skala yang didukung U4: di bawah 20 akun aktif; jumlah sesi aktif tidak dibatasi per akun tetapi dibatasi masa berlaku dan pembersihan (NFR4.20), dan diperkirakan di bawah 100 sesi aktif total; login bersamaan dibatasi 2 hash berjalan (NFR1.24). Di atas itu v1 tidak menjamin NFR1.20. |
| NFR4.20 | Pertumbuhan data akun dibatasi pembersihan terjadwal: baris `Session` yang kedaluwarsa atau dicabut lebih dari 7 hari dihapus, baris `LoginThrottle` dihapus bila `lockedUntil` kosong atau sudah lewat dan `updatedAt` lebih dari 24 jam (baris yang kuncinya sudah lewat ikut terhapus; baris yang sedang terkunci tidak pernah terhapus), dan `AuditEvent` lebih tua dari 1 tahun dihapus. Pembersihan berjalan saat backend start dan lalu tiap jam; tanpa batas jumlah baris tambahan (skala di bawah 20 pengguna). |

Perkiraan volume: `Session` dan `LoginThrottle` tetap di ratusan baris karena pembersihan; `AuditEvent` sekitar 20 pengguna × 50 peristiwa per hari × 365 hari, kurang dari 500.000 baris per tahun (dasar NFR1.23), jauh di bawah kapasitas PostgreSQL lokal.

## Pemicu Peningkatan Skala

- Jika `AuditEvent` melewati 500.000 baris atau daftar audit melewati 1 detik, tambahkan indeks komposit atau pembagian tabel lewat migrasi Prisma.
- Bila backend dijalankan lebih dari satu instance, pembersihan terjadwal tetap aman (penghapusan idempoten), tetapi batas 4 hash bersamaan berlaku per instance; tinjau ulang bila hosting berubah (di luar v1).

## Konkurensi

- Penghitung `LoginThrottle` ditulis dalam transaksi dengan pengecekan (BR4.4); permintaan login paralel untuk satu email tidak bisa melewati batas 5.
- Penonaktifan atau penurunan admin memakai transaksi yang mengunci baris admin aktif (BR4.13, BR4.14), sehingga dua admin tidak bisa saling menghabiskan admin.
- Pembuatan admin pertama memakai transaksi dengan pengecekan tabel kosong (BR4.11), aman terhadap dua instance yang start bersamaan.

## Assumptions & Open Questions

None.
