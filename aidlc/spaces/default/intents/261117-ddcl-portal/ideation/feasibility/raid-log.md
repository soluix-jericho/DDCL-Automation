# RAID Log — Portal DDCL Otomatis

## Risks

| ID | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Hasil ekspor Excel tidak 1:1 dengan tata letak template asli | Tinggi | Pilih pustaka Excel berbasis template; uji sejak Construction awal terhadap `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` |
| R2 | Model data step/object/rollback reusable salah desain di awal | Sedang | Rancang eksplisit di tahap Domain Design sebelum Code Generation |

## Assumptions

| ID | Asumsi | Sumber |
|---|---|---|
| A1 | Tidak ada integrasi sistem eksternal yang dibutuhkan di v1 | [Q1] |
| A2 | Tidak perlu masking data sensitif di ekspor Excel karena file memang dikirim apa adanya ke klien | [Q2] |

## Issues

Tidak ada isu terbuka pada tahap ini.

## Dependencies

| ID | Dependensi | Keterangan |
|---|---|---|
| D1 | `intent-statement.md` (Intent Capture & Framing) | Sumber masalah, pengguna, dan batas scope mvp yang jadi dasar penilaian kelayakan ini |
