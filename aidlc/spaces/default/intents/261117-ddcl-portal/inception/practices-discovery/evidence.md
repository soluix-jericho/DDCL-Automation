# Bukti — Practices Discovery — Portal DDCL Otomatis

## Apa yang diperiksa

Proyek ini **greenfield** — belum ada kode, belum ada riwayat git, belum
ada konfigurasi CI/CD yang bisa diinspeksi. Karena itu tidak ada bukti
kode/konfigurasi untuk dibaca; sumber utama adalah artefak hasil Ideation
dan default framework:

- `aidlc/spaces/default/memory/org.md` — lima bagian default (Way of
  Working, Walking Skeleton, Testing Posture, Deployment, Code Style),
  dibaca sebagai **saran default**, bukan fakta tim yang sudah ditetapkan.
- `aidlc/spaces/default/memory/project.md` — koreksi yang sudah tercatat:
  backend dan frontend harus dua app terpisah dalam satu monorepo.
- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/intent-capture/intent-statement.md`
  — konteks produk: portal multi-pengguna, step/object/rollback reusable,
  ekspor Excel 1:1 ke template, pencatatan status kirim manual.
- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/feasibility/feasibility-assessment.md`
  — rekomendasi stack (Node.js/TypeScript backend, TypeScript frontend,
  PostgreSQL via Docker, dua app terpisah dalam satu monorepo), risiko
  utama (kecocokan ekspor Excel, desain data model reusable), dan arah
  hosting yang sengaja belum dikunci.
- `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/scope-definition/scope-document.md`
  — urutan pengerjaan dependency-first (library step/object → DDCL penuh →
  ekspor & reporting), tidak ada tenggat waktu keras.
- Collaborators off untuk run ini (lihat Step 1 directive); Step 3 (Blind
  Support Review) dilewati seluruhnya — lead bekerja sendiri, tidak ada
  file kontribusi `aidlc-quality-agent`/`aidlc-developer-agent`/
  `aidlc-devsecops-agent` yang perlu digabung.

## Apa yang disimpulkan (inferensi, draf awal)

- Karena tidak ada kode/CI untuk diinspeksi, kelima bagian draf awal
  `team-practices.md` disimpulkan dari default `org.md`, dispesialisasi
  memakai informasi stack dan risiko dari `feasibility-assessment.md`
  (mis. area test berisiko tinggi pada ekspor Excel dan logika reusable;
  deployment lokal via Docker untuk v1).
- Koreksi "dua app terpisah dalam satu monorepo" dari `project.md` dipakai
  sebagai batasan yang sudah tetap, tidak ditanyakan ulang ke manusia.
- Tidak ditemukan batasan keras (hard constraint) baru dari artefak yang
  dibaca di luar yang sudah tercatat.

## Keputusan wawancara

Wawancara (Step 4) menyelesaikan kelima area terbuka draf awal. Lihat
`practices-discovery-questions.md` untuk teks lengkap pertanyaan dan
jawaban.

1. **Q1 — Way of Working**: Jawaban **B**. Trunk-based ke `main` tetap
   dipakai sebagai integration branch untuk kedua app, tetapi branch kerja
   ditandai per-app (mis. `feature/backend-...` vs `feature/frontend-...`)
   alih-alih satu skema penamaan bersama. Ini menutup open question #4
   draf awal.
2. **Q2 — Walking Skeleton**: Jawaban **A**. Tim membangun walking skeleton
   lebih dulu, memakai kandidat yang diusulkan (satu step reusable + satu
   object + satu DDCL minimal yang bisa diekspor ke Excel template) sebagai
   target Unit pertama, konsisten dengan setting `skeleton: on` scope `mvp`.
   Ini menutup open question #1 draf awal.
3. **Q3 — Testing Posture**: Jawaban **A**. Test-after untuk semua bagian
   (bukan opsi campuran TDD-untuk-reusable-logic/B, atau TDD-untuk-semua/C).
   Field `Methodology` tetap bernilai tunggal `test-after`, bukan `custom`,
   karena tidak ada percampuran cadence. Risiko pada logika reusable dan
   ekspor Excel ditangani lewat cakupan test ekstra, bukan metodologi
   berbeda.
4. **Q4 — Deployment**: Jawaban **A**. Deployment v1 cukup lokal via Docker
   Compose; tidak ada lingkungan staging nyata di luar lokal untuk v1 ini.
   Skema staging/production menyusul setelah arah hosting ditentukan. Ini
   menutup open question #3 draf awal — bagian deploy-on-merge-ke-staging
   dari default `org.md` disederhanakan sesuai usulan, bukan dipertahankan.
5. **Q5 — Code Style**: Jawaban **A**. Setuju dengan semua konvensi yang
   diusulkan (TypeScript kedua app, Prettier, ESLint di CI, penamaan
   idiomatik, struktur monorepo dua-app) — tidak ada perubahan dari draf
   awal.

## Ketidakpastian yang belum terselesaikan

Tidak ada. Kelima area (Way of Working, Walking Skeleton, Testing Posture,
Deployment, Code Style) sudah diselesaikan lewat wawancara di atas; tidak
ada open question tersisa untuk stage ini.
