# Intent Backlog — Portal DDCL Otomatis

Backlog proto-Unit, diprioritaskan dengan MoSCoW (sesuai `product-guide.md`, metode yang disarankan untuk definisi MVP) dan diurutkan dependency-first sesuai `scope-document.md`.

| ID | Proto-Unit | Prioritas (MoSCoW) | Deskripsi | Dependensi |
|---|---|---|---|---|
| IB1 | Step & Object Library | Must | Penyimpanan step reusable beserta kategori object/parameter kontekstual per jenis step; step bisa dipakai berulang lintas DDCL | — |
| IB2 | Rollback & Recovery Library | Must | Pasangan step rollback reusable untuk setiap step forward di IB1 | IB1 |
| IB3 | Release Document (header) | Must | Form header Release Document: Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, Technical Change | — |
| IB4 | Penyusunan Deployment Checklist | Must | Pengguna menyusun DDCL dari step di IB1 (urutan bebas, boleh berulang), termasuk rollback dari IB2 | IB1, IB2, IB3 |
| IB5 | Checklist Capture (bukti eksekusi) | Must (prioritas lebih rendah, versi sederhana) | Pencatatan bukti eksekusi per step; versi awal cukup sederhana | IB4 |
| IB6 | Pencatatan status pengiriman manual | Must | Pengguna menandai status DDCL (draft/sudah dikirim) secara manual | IB4 |
| IB7 | Ekspor ke Excel template asli | Must | Hasil DDCL diunduh mengikuti format `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` 1:1 | IB4, IB5, IB6 |
| IB8 | Portal Reporting | Must | Rekap semua DDCL: tanggal dibuat, tanggal dikirim, status, pembuat, object/step yang dipakai | IB6 |
| IB9 | Integrasi otomatis ke sistem lain | Won't (versi ini) | Ambil data operasional otomatis dari sistem lain | — |
| IB10 | Pengiriman email otomatis | Won't (versi ini) | Notifikasi email otomatis saat status "dikirim" | IB6 |

## Urutan Pengerjaan yang Disarankan

1. IB1 — Step & Object Library
2. IB2 — Rollback & Recovery Library
3. IB3 — Release Document (header)
4. IB4 — Penyusunan Deployment Checklist
5. IB5 — Checklist Capture
6. IB6 — Pencatatan status pengiriman
7. IB7 — Ekspor ke Excel template
8. IB8 — Portal Reporting

Urutan ini dependency-first (Q4 pada `scope-definition-questions.md`): komponen yang jadi prasyarat (library step/object, rollback) dikerjakan lebih dulu sebelum fitur yang memakainya.

## Sumber

- `scope-document.md`
- `scope-definition-questions.md` (Q1–Q5)
