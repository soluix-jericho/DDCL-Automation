# Constraint Register — Portal DDCL Otomatis

| ID | Tipe | Batasan | Sumber |
|---|---|---|---|
| C1 | Teknis | Tidak ada integrasi otomatis ke sistem lain di versi pertama; semua data step/object diketik manual | [Q1] |
| C2 | Teknis | Satu monorepo untuk portal + reporting (bukan beberapa repo terpisah) | [Q1 intent-capture] |
| C3 | Teknis | Hasil akhir DDCL harus bisa diunduh sebagai file yang mengikuti format `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` secara 1:1 | `intent-statement.md` |
| C4 | Teknis | Deployment awal cukup lokal via Docker; tidak ada platform hosting produksi yang ditetapkan untuk v1 | [Q4] |
| C5 | Keamanan | Data operasional (host, database, image, dsb.) tidak perlu disamarkan/masking saat diekspor ke Excel karena file dikirim ke klien apa adanya; penyimpanan di database tetap memakai praktik akses standar | [Q2] |
| C6 | Organisasi | Tidak ada batasan waktu/anggaran yang ketat | [Q5] |
| C7 | Organisasi | Tidak ada hambatan organisasi yang diketahui saat ini | [Q6] |

## Catatan

Tidak ada batasan regulasi/kepatuhan formal (PCI/HIPAA/SOC2/data residency) yang diidentifikasi pada tahap ini; pengguna menyatakan data boleh disimpan apa adanya dengan praktik akses standar [Q2]. Jika kebijakan kepatuhan internal perusahaan berubah, Constraint Register ini perlu ditinjau ulang.
