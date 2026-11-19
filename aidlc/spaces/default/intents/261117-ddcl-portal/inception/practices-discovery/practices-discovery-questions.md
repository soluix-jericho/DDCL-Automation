# Practices Discovery — Interview Questions

## Sources

- [memory] `aidlc/spaces/default/memory/org.md` (default framework, dipakai sebagai saran karena proyek ini greenfield)
- [memory] `aidlc/spaces/default/intents/261117-ddcl-portal/inception/practices-discovery/team-practices.md` (draf lead)
- [memory] `aidlc/spaces/default/intents/261117-ddcl-portal/inception/practices-discovery/evidence.md` (draf lead)

## Q1. [Way of Working] Bagaimana cara tim bekerja dengan branch dan commit?

Usulan: trunk-based — semua orang kerja dari `main`, tiap Bolt Construction pakai branch sendiri yang di-squash-merge ke `main` sebagai satu commit. Karena backend dan frontend adalah dua app terpisah dalam satu monorepo, apakah keduanya pakai satu skema penamaan branch yang sama, atau ditandai per-app?

- A. Trunk-based ke `main`, satu skema penamaan branch yang sama untuk backend dan frontend
- B. Trunk-based ke `main`, tapi branch ditandai per-app (mis. `feature/backend-...` vs `feature/frontend-...`)
- X. Other (please specify)

[Answer]: B

## Q2. [Walking Skeleton] Mau membangun walking skeleton dulu? Walking skeleton adalah versi minimal yang jalan dari ujung ke ujung, dibangun lebih dulu untuk membuktikan semua bagian tersambung, sebelum fitur sesungguhnya dibangun penuh.

Usulan kandidat skeleton: satu step reusable + satu object + satu DDCL minimal yang bisa diekspor ke file Excel sesuai template — ini membuktikan alur inti (step library → susun DDCL → ekspor) sudah tersambung sebelum fitur lain (rollback lengkap, reporting, dst.) dibangun.

- A. Ya, bangun walking skeleton dengan kandidat di atas lebih dulu
- B. Tidak perlu, langsung bangun fitur sesuai urutan dependency-first yang sudah disepakati di Scope Definition
- X. Other (please specify)

[Answer]: A

## Q3. [Testing Posture] Bagaimana pendekatan testing yang diinginkan?

Usulan: test-after (tulis kode dulu, lalu tulis & jalankan test untuk tiap lapisan) sebagai default, dengan lantai coverage 80% dan test wajib hijau di CI sebelum merge (otomatis karena scope `mvp`). Berdasarkan `feasibility-assessment.md`, bagian paling berisiko adalah kecocokan 1:1 hasil ekspor Excel dan logika reusable step/object/rollback.

- A. Test-after untuk semua bagian (sesuai usulan)
- B. TDD (test dulu, baru kode) khusus untuk logika reusable step/object/rollback dan fungsi ekspor Excel; test-after untuk bagian lain
- C. TDD untuk semua bagian
- X. Other (please specify)

[Answer]: A

## Q4. [Deployment] Bagaimana alur deployment yang diinginkan?

Sudah dikonfirmasi di Feasibility: v1 cukup lokal via Docker, arah hosting jangka panjang belum ditentukan. Usulan: untuk sekarang cukup "deploy lokal via Docker Compose"; skema staging/deploy-on-merge ke server sungguhan baru relevan setelah arah hosting ditentukan.

- A. Setuju — cukup "deploy lokal via Docker Compose" untuk v1, staging/production menyusul nanti
- B. Ada kebutuhan lingkungan staging nyata (bukan lokal) sudah di versi ini (jelaskan)
- X. Other (please specify)

[Answer]: A

## Q5. [Code Style] Apakah konvensi kode berikut sudah sesuai?

Usulan: TypeScript untuk backend (Node.js) dan frontend; Prettier sebagai formatter; ESLint sebagai linter (dijalankan di CI, kegagalan memblokir PR); penamaan idiomatik TypeScript (camelCase untuk variabel/fungsi, PascalCase untuk tipe/komponen). Struktur monorepo dengan backend & frontend sebagai app terpisah sudah tercatat sebelumnya dan tidak berubah.

- A. Setuju dengan semua di atas
- B. Ada yang perlu diubah (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Way of Working: trunk-based ke `main` sebagai integration branch; branch kerja ditandai per-app (`feature/backend-...` vs `feature/frontend-...`) (Q1).
- Walking Skeleton: tim membangun walking skeleton lebih dulu — satu step reusable + satu object + satu DDCL minimal yang bisa diekspor ke Excel template, sebelum fitur lain dibangun penuh (Q2).
- Testing Posture: test-after untuk semua bagian, dengan lantai coverage 80% dan test wajib hijau di CI sebelum merge (dari scope `mvp`) (Q3).
- Deployment: cukup lokal via Docker Compose untuk v1; staging/production menyusul setelah arah hosting jangka panjang ditentukan (Q4).
- Code Style: TypeScript untuk backend dan frontend (dua app terpisah dalam satu monorepo), Prettier, ESLint di CI, penamaan idiomatik TypeScript — tidak ada perubahan dari usulan (Q5).
- Tidak ada batasan keras (Mandated/Forbidden) baru yang ditemukan di tahap ini.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
