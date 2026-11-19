# Scope Document — Portal DDCL Otomatis

## Ringkasan

Dokumen ini menetapkan batas scope (in/out) untuk versi pertama (MVP) Portal DDCL Otomatis, berdasarkan `intent-statement.md` dan `feasibility-assessment.md`, dan dikonfirmasi ulang pada tahap Scope Definition (lihat `scope-definition-questions.md`).

## In Scope (MVP)

| # | Kapabilitas | Keterangan |
|---|---|---|
| 1 | Multi-pengguna dalam satu perusahaan | Lebih dari satu pengguna bisa memakai portal (bukan pengguna tunggal) [Q1] |
| 2 | Header Release Document | Pengguna mengisi Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, Technical Change [Q1] |
| 3 | Deployment Checklist dari step reusable | Step disimpan dan bisa dipakai ulang lintas DDCL maupun berulang dalam satu DDCL yang sama; urutan/susunan ditentukan pengguna saat menyusun DDCL; step baru dibuat kalau belum ada yang cocok [Q1][Q3] |
| 4 | List Object & Parameter kontekstual per step | Kategori object yang ditawarkan mengikuti jenis step yang sedang disusun (mis. step database → kategori object database) [Q1] |
| 5 | Rollback & Recovery Plan reusable | Setiap step forward yang reusable punya pasangan step rollback yang juga tercatat/reusable [Q1] |
| 6 | Pencatatan status pengiriman manual | Pengguna menandai status "sudah dikirim" secara manual (bukan pengiriman email otomatis) [Q1] |
| 7 | Ekspor ke format Excel template asli | Hasil akhir DDCL bisa diunduh mengikuti format `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` 1:1 [Q1] |
| 8 | Portal reporting | Rekap DDCL yang pernah dibuat: tanggal dibuat, tanggal dikirim, status, pembuat, dan object/step yang dipakai [Q1] |
| 9 | Checklist Capture (bukti eksekusi) — prioritas lebih rendah | Tetap termasuk di MVP tapi versi paling sederhana dulu, karena jarang diisi di praktiknya [Q2] |

## Out of Scope (ditunda ke versi berikutnya)

| # | Kapabilitas | Alasan |
|---|---|---|
| 1 | Integrasi otomatis ke sistem lain (mis. ambil data langsung dari registry/host) | Dikonfirmasi tidak dibutuhkan di v1; semua data diketik manual (feasibility Q1) |
| 2 | Pengiriman email otomatis saat DDCL "dikirim" | Dikonfirmasi ditunda ke versi berikutnya (`intent-statement.md`) |
| 3 | Masking/penyamaran data operasional saat ekspor | Dikonfirmasi tidak diperlukan karena file memang dikirim apa adanya ke klien (feasibility Q2) |
| 4 | Keputusan platform hosting produksi jangka panjang | Deployment awal cukup lokal via Docker; arah hosting belum ditentukan (feasibility Q4) |

## Value Stream Map

```
Step/Object Library  →  Susun Deployment Checklist (+ Rollback per step)  →  Lengkapi Release Document & Checklist Capture  →  Tandai status dikirim  →  Ekspor ke Excel template  →  Muncul di Portal Reporting
```

Step & object library harus ada lebih dulu, karena penyusunan DDCL penuh memakai isinya; reporting dan ekspor baru bermakna setelah ada DDCL yang tersusun lengkap (Q3).

## Urutan Pengerjaan

**Dependency-first** (Q4): step/object library terlebih dahulu, lalu penyusunan DDCL penuh (header + checklist + rollback), baru kemudian ekspor Excel dan portal reporting.

## Batasan Waktu

Tidak ada tenggat waktu keras yang terikat ke kapabilitas manapun (Q5); sejalan dengan `feasibility-assessment.md` yang menyatakan tidak ada batasan waktu/anggaran yang ketat.

## Sumber

- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/intent-capture/intent-statement.md`
- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/feasibility/feasibility-assessment.md`
- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/feasibility/constraint-register.md`
- `scope-definition-questions.md` (Q1–Q5, jawaban dikonfirmasi pengguna)
