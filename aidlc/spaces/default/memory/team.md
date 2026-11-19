# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- **Integration branch**: main
- Kerangka kerja: trunk-based development. Semua orang kerja dari `main`;
  tiap Bolt Construction memakai branch kerja sendiri yang di-squash-merge
  ke `main` sebagai satu commit bernama slug Bolt tersebut.
- Branch ditandai per-app: karena backend dan frontend adalah dua app
  terpisah dalam satu monorepo, branch memakai penandaan prefix per-app
  (mis. `feature/backend-...` untuk backend, `feature/frontend-...` untuk
  frontend) alih-alih satu skema penamaan yang sama untuk keduanya. Ini
  murni konvensi penamaan branch — integration branch-nya tetap satu, yaitu
  `main`, untuk kedua app.
- Commit yang diminta pengguna langsung ke branch yang sedang aktif; AI-DLC
  hanya membuat branch baru saat diminta atau saat Construction worktree
  memang memerlukannya.

## Walking Skeleton

Tim membangun walking skeleton (irisan tipis yang jalan ujung ke ujung)
lebih dulu, sebelum fitur sesungguhnya dibangun penuh. Kandidat skeleton
yang disepakati: satu step reusable + satu object + satu DDCL minimal yang
bisa diekspor ke file Excel sesuai template — ini membuktikan alur inti
(step library → susun DDCL → ekspor) sudah tersambung sebelum fitur lain
(rollback lengkap, reporting, manajemen multi-pengguna, dst.) dibangun.

Ini konsisten dengan setting `skeleton: on` default scope `mvp`: Unit
pertama dari DAG Construction harus menjadi irisan kandidat di atas,
dijalankan melalui seluruh stage per-unit yang berlaku (termasuk Code
Generation) sebelum Unit lain berjalan, dan diverifikasi dengan Construction
Verification Command yang menunjukkan hasil ujung-ke-ujung nyata sebelum
checkpoint skeleton disetujui manusia.

## Testing Posture

- **Methodology**: test-after
- **Methodology evidence**: Diafirmasi manusia pada wawancara (Q3, jawaban
  A) — test-after untuk semua bagian, bukan opsi campuran TDD. Alasan yang
  dipertimbangkan: domain MVP ini relatif CRUD + generate-Excel tanpa logika
  bercabang yang sangat kompleks, sehingga menulis implementasi lebih dulu
  lalu test per lapisan dianggap cukup, termasuk untuk bagian reusable
  step/object/rollback yang berisiko (lihat `feasibility-assessment.md` Risk
  Analysis) — risiko itu ditangani dengan cakupan test ekstra pada lapisan
  tersebut, bukan dengan mengubah metodologi menjadi TDD.
- **Ordering**: implementasikan tiap lapisan yang bisa diuji (model data,
  endpoint API, komponen UI, fungsi generate-Excel) terlebih dahulu, lalu
  tulis dan jalankan test untuk lapisan tersebut sebelum lanjut ke lapisan
  berikutnya.
- Scope `mvp` menambahkan lantai coverage baris 80% dan eksekusi test di CI
  sebelum merge.
- Area berisiko tinggi yang perlu perhatian test ekstra: kecocokan 1:1
  hasil ekspor Excel terhadap `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (lihat
  `feasibility-assessment.md` Risk Analysis), dan ketepatan logika reusable
  step/object/rollback.

## Guard Policy

<!-- Affirmed by the team. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless project.md or the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- Untuk v1, deployment cukup lokal via Docker Compose (PostgreSQL + kedua
  app backend dan frontend), diafirmasi manusia pada wawancara (Q4, jawaban
  A). Belum ada lingkungan staging/production nyata di luar lokal untuk v1
  ini.
- Arah hosting jangka panjang (mis. Kubernetes/AWS atau lainnya) dan skema
  staging/deploy-on-merge ke server sungguhan baru relevan dan akan
  ditentukan setelah arah hosting diputuskan — sengaja tidak dikunci di
  tahap ini.

## Code Style

- **Struktur monorepo**: backend dan frontend adalah dua app terpisah
  (folder/package berbeda) dalam satu repository Git — koreksi tercatat di
  `project.md` (## Corrections), tidak berubah.
- **Bahasa**: TypeScript untuk backend (Node.js) dan frontend, diafirmasi
  manusia pada wawancara (Q5, jawaban A — setuju dengan semua usulan).
- **Formatter**: Prettier.
- **Linter**: ESLint, dijalankan di CI sebelum merge; kegagalan memblokir PR.
- **Naming conventions**: idiomatik TypeScript (camelCase untuk variabel/
  fungsi, PascalCase untuk tipe/komponen).
- Pilihan framework spesifik (mis. framework backend, state management
  frontend) adalah keputusan arsitektur untuk tahap Domain Design, bukan
  tahap ini.
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
