# NFR Requirements — u4-user-accounts — Performance

Sumber: `requirements.md` NFR1, `functional-spec.md` (W2 login, W3 pemeriksaan sesi, W11 audit), `rules.md` BR4.2, BR4.6, BR4.20, jawaban `nfr-requirements-questions.md` Q1. Penomoran U4 memakai sub-nomor mulai dari .20 pada tiap NFR supaya tidak bentrok dengan U1 dan U2.

## Target

| ID | Target | Berlaku untuk | Kondisi |
|---|---|---|---|
| NFR1.20 | p95 < 1 detik | Login (`POST /api/v1/auth/login`) | Hash scrypt N=32768, r=8, p=1, `maxmem` 64 MiB (sekitar 122 ms terukur); skala di bawah 20 pengguna aktif; sampai 4 login serentak (2 berjalan, 2 antre, sehingga terburuk sekitar 250 ms) |
| NFR1.21 | Tambahan p95 ≤ 50 ms per permintaan | Pemeriksaan sesi dan role pada setiap endpoint `/api/v1/*` (BR4.6, BR4.8, BR4.9) | Satu pencarian `Session` dan `User` lewat indeks `tokenHash`; penulisan `lastSeenAt` paling cepat sekali per menit per sesi |
| NFR1.22 | p95 < 2 detik (NFR1 tetap berlaku) | Semua endpoint U1–U3 setelah sesi ditegakkan | Kondisi sama seperti target U1 dan U2; U4 hanya boleh menambah NFR1.21 |
| NFR1.23 | p95 < 2 detik | Daftar catatan audit (`GET /api/v1/audit-events`) | Sampai 500.000 `AuditEvent` (perkiraan batas atas satu tahun retensi); indeks pada `occurredAt` dan `type`; ukuran halaman bawaan 50, maksimum 100 |
| NFR1.24 | Batas ukuran dan jumlah | Hash kata sandi dan antrean | Paling banyak 2 hash scrypt berjalan bersamaan; sisanya antre; antrean yang menunggu lebih dari 5 detik dijawab 503 generik (`Retry-After`) agar server tidak membeku. Batas 2 (bukan 4) disengaja agar hash tidak memakai seluruh 4 thread bawaan libuv yang juga dipakai operasi berkas, kompresi, dan ekspor Excel; ukuran threadpool dinaikkan lewat `UV_THREADPOOL_SIZE=8` di konfigurasi backend sehingga operasi lain tetap mendapat thread |

## Verifikasi

NFR1.20 dan NFR1.21 diukur oleh test di Build and Test: 100 login (termasuk gelombang 4 login serentak) dan 200 permintaan terautentikasi, lalu mengukur p95 dari seluruh sampel. NFR1.23 diukur dengan seed 500.000 `AuditEvent` dan 50 permintaan daftar dengan filter jenis dan tanggal. Pembagian halaman audit memakai kursor atas `(occurredAt, id)` sehingga halaman dalam tetap cepat. Status 503 dari NFR1.24 ditambahkan ke Contract 1 saat Code Generation memperbarui kontrak.

## Resource Constraints

- Tidak ada batas CPU/memori eksplisit untuk v1 lokal. Biaya memori scrypt dibatasi oleh NFR1.24 (2 hash bersamaan, `maxmem` 64 MiB per hash, sehingga sekitar 128 MiB di puncak).

## Assumptions & Open Questions

None.
