# NFR Requirements — u2-step-library — Performance

Sumber: `requirements.md` NFR1, `functional-spec.md` (Alur 1–5: buat, lihat/cari, edit, hapus step, dan kelola bundle; tiap target di bawah mengukur salah satunya), `rules.md` BR2.13, jawaban `nfr-requirements-questions.md` Q2 dan Q3. Penomoran melanjutkan U1 (NFR1.1–NFR1.4) supaya ID tidak bentrok.

## Target

| ID | Target | Berlaku untuk | Kondisi |
|---|---|---|---|
| NFR1.5 | p95 < 2 detik | Daftar dan cari Library (`GET /api/v1/steps` dengan `q` dan `category`; `GET /api/v1/bundles`) | Sampai 1.000 step, 100 bundle, dan 100.000 item checklist (dasar kueri `usageCount`); cari nama dengan `ILIKE`; respons daftar berupa ringkasan (lihat bawah) |
| NFR1.6 | p95 < 2 detik | Simpan step (`POST`/`PATCH /api/v1/steps`) termasuk kolom, langkah, lampiran, dan pasangan rollback inline | Step di batas maksimum NFR1.8 (satu transaksi), termasuk `rollbackStep` inline di batas yang sama |
| NFR1.7 | p95 < 2 detik | Hapus step beserta laporan dampaknya (`DELETE /api/v1/steps/{id}`) dan simpan/hapus bundle | Skala NFR1.5; bundle di batas anggota NFR1.8 |
| NFR1.8 | Batas input (ditolak 400 yang menyebut field, sebelum menyentuh database): step maks 10 kolom, 50 langkah per kolom, 2.000 karakter per langkah, nama step 200 karakter, label kolom 200 karakter; maks 10 lampiran per step, nama file lampiran 255 karakter, isi lampiran 102.400 byte (100 KiB, UTF-8); nama bundle 200 karakter; maks 50 anggota forward dan 50 anggota rollback per bundle; parameter `q` 200 karakter | Validasi di backend (BR2.1, BR2.5, BR2.11, BR2.13) | Q1, Q2. "Karakter" dihitung sebagai titik kode Unicode setelah trim; "byte" dihitung pada UTF-8 |
| NFR1.10 | `bodyLimit` Fastify untuk rute Library dinaikkan eksplisit menjadi 16 MiB; permintaan yang lebih besar dijawab 413 dengan error generik | Semua rute tulis Library | Ukuran maksimum sah dihitung: teks langkah 10 × 50 × 2.000 = 1.000.000 titik kode (sampai 4 MB UTF-8) + lampiran 1 MB = sekitar 5 MB per step, sekitar 10 MB dengan `rollbackStep` inline, belum termasuk overhead JSON. Test NFR1.6 memakai payload di batas maksimum ini |
| NFR1.11 | `GET /api/v1/steps` mengembalikan ringkasan saja (id, nama, kategori, jenis, `usageCount`, penanda Belum ada rollback, jumlah kolom dan lampiran), tanpa teks langkah dan isi lampiran; isi penuh lewat `GET /api/v1/steps/{id}` | Daftar Library | Membuat NFR1.5 dapat dicapai walau satu step bisa besar |

`usageCount` (BR2.6) dihitung di lapisan endpoint dengan satu kueri teragregasi untuk seluruh daftar, bukan satu kueri per baris.

## Verifikasi

NFR1.5 sampai NFR1.7 dibuktikan oleh satu test beban di Build and Test: seed 1.000 step, 100 bundle, dan 100.000 item checklist, lalu mengukur p95 dari 20 permintaan berurutan per rute. Test NFR1.6 juga membuktikan permintaan di batas NFR1.8 tidak ditolak 413 dan permintaan di atas `bodyLimit` dijawab 413.

## Resource Constraints

- Tidak ada batas CPU/memori eksplisit untuk v1 lokal (sama seperti U1). Ukuran permintaan maksimum dibatasi `bodyLimit` NFR1.10.

## Assumptions & Open Questions

None.
