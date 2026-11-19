# Refined Mockups & UX Design — Questions

## Sources

- [memory] `wireframes.md`, `user-flow.md` (Rough Mockups).
- [memory] `stories.md`, `personas.md` (User Stories) — 13 story, termasuk US1.3 (rollback pairing), US3.2 (versi DDCL), US6.1 (lock edit bersamaan), US4.1 (ekspor Excel dengan kasus tepi).
- [memory] `requirements.md` (Requirements Analysis).

## Q1. [UX] Bagaimana setiap story baru sejak Rough Mockups sebaiknya direpresentasikan di UI?

Tiga story ditambahkan/diperjelas setelah Rough Mockups: US1.3 (menetapkan pasangan rollback saat membuat step di Library), US3.2 (membuat versi v2/v3 dari DDCL terkirim), US6.1 (indikator lock saat DDCL sedang diedit pengguna lain).

- A. Setuju dengan usulan representasi berikut: (1) saat membuat step forward baru di Library, ada field "Pasangan Rollback" (pilih yang sudah ada / buat baru) tepat di form yang sama; (2) DDCL terkirim punya tombol "Buat Revisi" yang langsung membuat & membuka v2; (3) badge kecil "Sedang diedit oleh..." muncul di Dashboard dan di Editor saat DDCL sedang dikunci pengguna lain.
- B. Ada representasi yang perlu diubah (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [UX] Pola interaksi apa yang dipakai untuk kasus gagal/tepi ekspor Excel (AC4.1.3–AC4.1.5)?

- A. Modal konfirmasi/peringatan sebelum unduhan dimulai jika ada masalah (field kosong → blokir dengan pesan; jumlah step banyak → peringatan tapi tetap lanjut)
- B. Pola lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Teknis] Apakah ada design system/pustaka komponen yang sudah ditentukan untuk frontend TypeScript ini?

Di Rough Mockups sudah disepakati: tidak ada branding khusus, gaya sederhana-elegan-user-friendly, komponen standar.

- A. Belum ada pustaka spesifik — gunakan pustaka komponen UI open-source yang umum dan mudah dirawat (mis. komponen headless + styling utility), keputusan pustaka persis didokumentasikan sebagai ADR di Domain Design
- B. Sudah ada preferensi pustaka tertentu (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Aksesibilitas/Responsif] Apakah breakpoint dan level aksesibilitas yang sudah disepakati (desktop-only, WCAG 2.1 AA) masih berlaku untuk mockup yang lebih detail ini?

- A. Ya, tetap sama — fokus desktop/laptop, WCAG 2.1 AA sebagai baseline
- B. Ada perubahan (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Representasi story baru: field "Pasangan Rollback" di form step Library; tombol "Buat Revisi" di DDCL terkirim yang langsung membuat & membuka versi baru; badge "Sedang diedit oleh..." saat DDCL terkunci (Q1).
- Kasus gagal/tepi ekspor Excel ditangani lewat modal konfirmasi/peringatan sebelum unduhan dimulai (Q2).
- Belum ada pustaka komponen spesifik; pakai pustaka UI open-source umum yang mudah dirawat, didokumentasikan sebagai ADR di Domain Design (Q3).
- Breakpoint dan aksesibilitas tetap sama seperti Rough Mockups: fokus desktop/laptop, WCAG 2.1 AA sebagai baseline (Q4).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
