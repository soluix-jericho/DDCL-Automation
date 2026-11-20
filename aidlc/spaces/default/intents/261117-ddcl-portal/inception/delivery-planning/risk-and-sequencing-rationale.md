# Delivery Planning — Risk and Sequencing Rationale

Sumber: `unit-of-work-dependency.md` (DAG topologis), `team.md` (## Walking Skeleton), `requirements.md` (NFR6, Intent Analysis), jawaban `delivery-planning-questions.md` Q1, Q2, Q6.

## Pendekatan

Urutan Bolt memakai dua heuristik yang digabung (jawaban Q1), bukan satu model skor formal (jawaban Q2 — WSJF tidak dipakai; skala proyek `mvp` dengan satu pembangun AI tidak membutuhkan skor kuantitatif untuk memutuskan urutan enam Bolt):

1. **Walking-skeleton-first** (Cockburn) — Bolt pertama adalah irisan tipis ujung-ke-ujung (u1-walking-skeleton) yang membuktikan tiga komponen domain inti (StepLibrary, DdclDocument, ExcelExportService) benar-benar tersambung, sebelum fitur lain dibangun di atasnya. Ini sudah disepakati tim di `team.md` ## Walking Skeleton, konsisten dengan setting `skeleton: on` default scope `mvp`.
2. **Risk-first untuk sisa urutan** — setelah skeleton terbukti jalan, Bolt berikutnya diurutkan supaya risiko terbesar (area regresi yang bisa membesar, dan risiko teknis utama produk) ditangani lebih awal daripada menunggu sampai akhir.

## Mengapa u4 (akun pengguna) sebelum u3 (komposisi DDCL), bukan setelahnya

Ini satu-satunya titik di mana urutan Bolt menyimpang dari kemungkinan paralel yang diizinkan DAG (`unit-of-work-dependency.md` mencatat u2 & u4 bisa paralel setelah u1, begitu juga u5 & u6 setelah u3) — tapi karena Bolt dibangun serial oleh satu pembangun (jawaban Q4), tetap perlu satu urutan pasti, dan di sinilah penilaian ekonomi manusia berlaku (bukan sekadar urutan topologis):

- `unit-of-work.md` U4 mencatat eksplisit: begitu u4 selesai, stub sesi dev-mode dari u1 harus dicabut di **seluruh endpoint yang sudah ada** saat itu, dan ini perlu diuji ulang (regresi).
- Jika u4 dikerjakan setelah u3 (Unit terbesar, XL), area retrofit itu mencakup endpoint dari u1 **dan** u2 **dan** u3 — permukaan regresi jauh lebih besar.
- Mengerjakan u4 sedini mungkin setelah u1/u2 membuat area retrofit itu masih kecil (hanya endpoint u1 dan u2), sehingga risiko regresi tertangani sebelum u3 menambah lebih banyak endpoint di atasnya.
- Trade-off yang diterima: u3 (Unit bernilai terbesar — komposisi DDCL penuh) tertunda satu Bolt dibanding jika risk-first diabaikan. Ini diterima karena ukuran penundaan kecil (satu Bolt M, u4) dibanding biaya regresi yang dihindari (retrofit atas Unit XL).

## Risiko utama yang ditangani lebih awal (jawaban Q6)

| Risiko | Kapan ditangani | Bagaimana |
|---|---|---|
| Kecocokan ekspor Excel 1:1 dengan template (NFR6, risiko teknis utama di `feasibility-assessment.md`) | Bolt 1 (dasar), diperkeras di Bolt 5 | Skeleton (Bolt 1) membuktikan pendekatan ADR-005 (isi ulang template) bekerja pada kasus sederhana sebelum investasi lebih jauh; Bolt 5 menangani kasus tepi (baris melebihi kapasitas, karakter formula-like) setelah DDCL multi-step nyata tersedia dari Bolt 4 |
| Retrofit sesi dev-mode → sesi nyata (FR9, NFR2) | Bolt 3, ditempatkan sedini mungkin setelah u1/u2 | Lihat bagian di atas — mengecilkan area regresi |

## Deviasi dari urutan topologis murni

- DAG `unit-of-work-dependency.md` mengizinkan u2 dan u4 paralel, serta u5 dan u6 paralel. Karena eksekusi serial (jawaban Q4), kedua pasangan ini tetap harus diurutkan satu demi satu:
  - u2 sebelum u4: Library (tujuan utama produk #1 — reusability) diselesaikan lebih dulu karena u3 (yang jauh lebih besar) bergantung padanya; menunda u2 hanya akan menunda mulainya u3 lebih jauh.
  - u6 sebelum u5: risiko teknis utama (NFR6) diutamakan di atas fitur visibilitas (nilai lebih rendah, murni baca data, tidak berisiko).
- Tidak ada deviasi dari urutan topologis itu sendiri — u1 tetap pertama, u3 tetap menunggu u2, u5 dan u6 tetap menunggu u3.

## Assumptions & Open Questions

None.
