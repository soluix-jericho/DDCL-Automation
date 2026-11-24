# NFR Design — u2-step-library — Reliability Design

Sumber: `nfr-requirements/reliability-requirements.md` (NFR3.4, NFR4.3–NFR4.7), `rules.md` BR2.3, BR2.7, BR2.8, BR2.9, BR2.11, U1 `reliability-design.md`, jawaban `nfr-design-questions.md` Q1.

## Pola Resiliensi

Tanpa circuit breaker atau bulkhead (satu dependensi lokal, seperti U1). Pola yang dipakai: transaksi atomik, penguncian berurutan, dan retry transaksi internal untuk deadlock (NFR4.3). Retry hanya di dalam server atas transaksi yang sudah dibatalkan; tidak ada retry otomatis POST oleh klien (`contract-summary.md` Q5).

## Transaksi Atomik (NFR4.3)

Pembungkus tunggal `withLibraryTx(ids, fn)`: buka transaksi interaktif Prisma (timeout 10 detik, maxWait 5 detik), kunci baris dengan protokol dua fase di `scalability-design.md` (baca kandidat, kunci `StepBundle` lalu `Step`, baca ulang dan verifikasi), jalankan `fn`, dan ulang (total maksimal 2 kali) pada `40P01`/`P2034` atau perubahan himpunan kandidat. Setiap aksi tulis memakainya: simpan step (termasuk `rollbackStep` inline), hapus step (dampak lengkap), simpan dan hapus bundle. Gagal di tengah membatalkan semuanya.

## Snapshot Tidak Tersentuh (NFR4.4)

Kode Library tidak memiliki jalur tulis ke `ChecklistItem.stepSnapshot`. Hapus step hanya menjalankan `UPDATE ChecklistItem SET stepId = NULL WHERE stepId = $id`. Test: membuat item dengan snapshot, mengubah lalu menghapus step, dan memastikan snapshot sama persis byte demi byte.

## Pemetaan Galat (NFR4.5, NFR4.6)

| Kejadian | Respons |
|---|---|
| `P2002` pada penyisipan atau pembaruan Step | Di dalam transaksi yang sama (transaksi dibatalkan, jadi di transaksi baru yang singkat) kueri ulang baris yang bentrok lewat `lower(btrim(name))`, `category`, `kind` (untuk step utama dan, bila ada, `rollbackStep`). Bila ditemukan: 409 dengan isi step itu dan `conflictOn` (`step` atau `rollbackStep`, sesuai mana yang cocok). Bila tidak ditemukan: perlakukan sebagai 500 (pelanggaran lain). Pemetaan tidak bergantung pada `meta.target` |
| `P2002` pada penyisipan atau pembaruan bundle | Kueri ulang lewat `lower(btrim(name))`; ditemukan: 409 dengan isi bundle itu; tidak: 500 |
| Pool koneksi habis (`P2024`) atau pembatas tulis penuh | 503 dengan `Retry-After: 2` dan pesan generik |
| Foreign key ke step yang baru dihapus (`P2003`) | 404 menyebut step yang hilang |
| Step yang dihapus atau diubah sudah tidak ada | 404 |
| Deadlock atau serialisasi setelah 2 pengulangan | 409 "coba lagi" |
| Pelanggaran batasan posisi | Tidak boleh terjadi (kunci); bila terjadi: 500 generik dan log error, itu bug |
| Validasi gagal | 400 dengan daftar field |
| Selain itu | 500 generik, detail hanya di log (BR1.5) |

Bentuk `meta.target` Prisma untuk indeks ekspresi buatan SQL mentah belum diverifikasi, jadi pemetaan 409 tidak memakainya: kueri ulang baris yang bentrok (yang memang dibutuhkan untuk isi 409 dan `conflictOn`) menjadi penentu, dan tidak ditemukan berarti bukan konflik nama. Test wajib di Code Generation menangkap bentuk nyata `meta.target` sebagai catatan, tanpa menjadi syarat pemetaan.

## Keunikan Nama (NFR4.7)

Migrasi SQL mentah menambahkan `CREATE UNIQUE INDEX step_name_unique ON "Step" (lower(btrim(name)), category, kind)` dan `bundle_name_unique ON "StepBundle" (lower(btrim(name)))`. Pengaman agar `prisma migrate dev` tidak menjatuhkannya sebagai drift: (1) semua migrasi dibuat dengan `--create-only` lalu ditinjau sebelum diterapkan; (2) test CI memeriksa keberadaan kedua indeks di `pg_indexes` setelah semua migrasi diterapkan. Test: dua nama beda huruf besar atau spasi ujung ditolak.

## Migrasi U2 (ringkasan)

Tabel baru (Step diperluas, StepColumn, StepLine, StepAttachment, StepBundle, anggota bundle); `ChecklistItem.stepId` dibuat nullable tanpa `ON DELETE SET NULL` (pengosongan dilakukan eksplisit oleh kode hapus, agar jumlahnya masuk laporan dampak); kolom `ChecklistItem.stepSnapshot` (json, wajib; item U1 diisi saat migrasi dari data Step yang ada); indeks `ChecklistItem.stepId`; dua indeks unik fungsional di atas.

## Health Check dan Degradasi

`GET /health` U1 tetap dipakai. Frontend menampilkan pesan gagal dengan tombol coba lagi dan mempertahankan isi form yang sedang diketik (draft tetap di state komponen sampai simpan berhasil).

## Backup dan Durabilitas

Volume PostgreSQL persisten (NFR4); tanpa backup formal di v1.

## Assumptions & Open Questions

None.
