# Units Generation — Questions

## Sources

- [memory] `components.md` (Domain Design): UserAccount, StepLibrary, DdclDocument, ExcelExportService.
- [memory] `decisions.md` (Domain Design): ADR-001–ADR-005.
- [memory] `requirements.md`, `stories.md`.
- [memory] `team.md` ## Walking Skeleton: kandidat skeleton yang sudah disepakati tim — "satu step reusable + satu object + satu DDCL minimal yang bisa diekspor ke file Excel sesuai template".

## Q1. [Arsitek] Apakah pembagian 6 Unit berikut (dan batasnya) sudah masuk akal?

Usulan pembagian — tiap Unit mencakup logika backend DAN layar frontend yang terkait (keduanya tetap dua app terpisah di monorepo, hanya dikerjakan/dirilis sebagai satu Unit):

1. **u1-walking-skeleton** — irisan tipis ujung-ke-ujung: satu step reusable (forward, satu kategori object) → disusun ke satu DDCL minimal → diekspor ke Excel sesuai template. Berjalan di balik sesi dev-mode sementara (login nyata menyusul di U4).
2. **u2-step-library** — fitur StepLibrary penuh: deteksi nama duplikat, form object/parameter per kategori, jumlah pemakaian step, hapus step tanpa mengubah DDCL lama, pasangan rollback di Library.
3. **u3-ddcl-composition** — fitur DdclDocument penuh: header lengkap, susun/urutkan/duplikasi step, rollback otomatis terpasang, Checklist Capture, status Draft→Sudah Dikirim (read-only), versi (vN), lock+auto-release.
4. **u4-user-accounts** — multi-akun pengguna dan autentikasi/sesi nyata menggantikan dev-mode stub di semua endpoint.
5. **u5-portal-reporting** — halaman rekap/dashboard: daftar, filter, pencarian.
6. **u6-excel-export-hardening** — pengerasan ekspor Excel: validasi sebelum ekspor, baris melebihi kapasitas template, teks yang berpotensi merusak sel (formula-like).

- A. Setuju dengan pembagian dan batas 6 Unit di atas
- B. Perlu digabung/dipecah/diganti batasnya (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Apakah u1-walking-skeleton sudah cocok sebagai Unit pertama (irisan skeleton) sesuai yang disepakati tim di `team.md`?

Unit ini sengaja sempit: satu step, satu kategori object, satu DDCL minimal, ekspor Excel — cukup untuk membuktikan alur step library → susun DDCL → ekspor benar-benar tersambung, sebelum fitur lain (rollback lengkap, multi-step, versi, reporting, dst.) dibangun di Unit berikutnya.

- A. Setuju, u1-walking-skeleton jadi Unit pertama seperti dideskripsikan
- B. Perlu diperluas/dipersempit cakupannya (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Pengiriman] Setelah u1-walking-skeleton selesai, apakah u2-step-library, u3-ddcl-composition, dan u4-user-accounts boleh dikerjakan paralel (dengan u3 menunggu u2 lebih dulu karena butuh pasangan rollback dari Library)?

Ini murni soal topologi dependensi (bisa dikerjakan bersamaan tanpa saling menunggu), bukan urutan ekonomis/prioritas pengiriman (itu keputusan Delivery Planning).

- A. Setuju — u2 dan u4 paralel setelah u1; u3 menunggu u2 selesai
- B. Urutan/dependensi lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek] Karena backend adalah satu app yang di-deploy sebagai satu proses (bukan microservices terpisah), apakah integrasi antar-Unit backend cukup lewat pemanggilan modul/fungsi internal dalam satu codebase yang sama (bukan API jaringan antar-Unit), dengan kontrak/API publik hanya dibutuhkan dari backend ke frontend?

- A. Setuju — integrasi antar-Unit backend lewat modul internal; API publik hanya backend<->frontend
- B. Sebagian Unit backend tetap perlu API jaringan sendiri (sebutkan yang mana dan kenapa)
- X. Other (please specify)

[Answer]: A

## Q5. [Delivery] Apakah model deployment tiap Unit sudah sesuai: seluruh Unit backend menjadi satu app backend (shared/monolith), dan seluruh layar frontend tiap Unit menjadi satu app frontend (shared), keduanya dijalankan via Docker Compose sesuai `team.md`?

- A. Setuju — satu app backend (shared), satu app frontend (shared), Docker Compose
- B. Sebagian Unit perlu deploy terpisah (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Q1: Setuju dengan 6 Unit — u1-walking-skeleton, u2-step-library, u3-ddcl-composition, u4-user-accounts, u5-portal-reporting, u6-excel-export-hardening.
- Q2: u1-walking-skeleton jadi Unit pertama (irisan skeleton) seperti dideskripsikan.
- Q3: u2-step-library dan u4-user-accounts boleh paralel setelah u1; u3-ddcl-composition menunggu u2.
- Q4: Integrasi antar-Unit backend lewat modul internal; API publik hanya backend<->frontend.
- Q5: Satu app backend (shared) dan satu app frontend (shared), keduanya via Docker Compose.

- Looks correct
- Request changes

[Answer]: Looks correct
