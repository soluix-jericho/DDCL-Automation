# NFR Design — u2-step-library — Security Design

Sumber: `nfr-requirements/security-requirements.md` (NFR2.6–NFR2.9; NFR2.3–NFR2.5 dari U1 tetap), U1 `nfr-design/security-design.md`, jawaban `nfr-design-questions.md` Q3 dan Q4.

## Sesi (NFR2.6)

Rute Library memakai hook `onRequest` yang sama dengan U1 (selalu lanjut di U1, diganti U4 dengan validasi sesi). Tidak ada perubahan bentuk kontrak saat U4 menegakkan sesi.

## Validasi Input (NFR2.7)

- Skema JSON Fastify per rute (body `POST`/`PATCH` step dan bundle, query `q` dan `category`) dengan batas NFR1.8; kategori dan jenis memakai `enum`.
- Fungsi validasi domain di awal handler untuk yang tidak bisa dinyatakan skema: hitung titik kode setelah trim, byte UTF-8 lampiran, nama file lampiran tanpa pemisah path atau `..`, tata bahasa variabel `{nama}` (BR2.4), jenis anggota bundle (forward untuk daftar forward, rollback untuk daftar rollback).
- Kesalahan validasi menjadi 400 dengan daftar field bermasalah; body lebih dari `bodyLimit` menjadi 413 (lihat `performance-design.md`).

## Lampiran dan Teks (NFR2.8)

Lampiran hanya disimpan dan dikirim sebagai teks; tidak ada jalur kode yang mengeksekusi, mengurai sebagai berkas, atau menulisnya ke disk. Frontend merender teks langkah dan isi lampiran sebagai node teks React (tanpa `dangerouslySetInnerHTML`). Tailwind dibangun saat build tanpa CDN, jadi tidak ada skrip pihak ketiga.

## Kueri Aman (NFR2.9)

- Semua akses database lewat Prisma (berparameter). Dua tempat memakai SQL mentah: `SELECT ... FOR UPDATE` dan agregasi `usageCount`; keduanya hanya menerima id sebagai parameter terikat (`$queryRaw` dengan template tag), tanpa string yang dirangkai.
- Parameter `q`: escape manual `\`, `%`, dan `_` dengan fungsi satu baris sebelum diberikan ke `contains` (Q4). Test wajib: `q` = `%` atau `_` hanya cocok dengan karakter literal; `q` dengan `\` tidak merusak kueri.

## Risiko Tanpa Sesi (NFR2.6)

Rute tulis menerima body sampai 24 MiB tanpa sesi. Mitigasi sementara: pembatas `onRequest` maksimal 4 permintaan tulis serentak per proses, yang menolak sisanya dengan 503 sebelum body dibaca (`performance-design.md`), membatasi memori terburuk menjadi sekitar 4 × 24 MiB dikali overhead parse (di bawah 400 MiB). Sisa risiko: satu klien masih bisa menghabiskan keempat slot tulis dan menolak pengguna lain (gangguan, bukan kebocoran data). Ini bukan pengganti sesi: **syarat untuk u4-user-accounts** — rute tulis Library wajib berada di balik validasi sesi sebelum diekspos di luar jaringan Docker Compose lokal. Syarat anti-formula Excel (`=`, `+`, `-`, `@` di awal sel) dicatat untuk u6-excel-export.

## Assumptions & Open Questions

None.
