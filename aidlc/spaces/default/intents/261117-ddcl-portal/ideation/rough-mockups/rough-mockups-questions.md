# Rough Mockups & Concept Visualization — Questions

## Sources

- [desc] Initial description: "saya mau membuat pembuatan ddcl otomatis dengan template berikut \"C:\\\\Users\\\\solui\\\\OneDrive - PT. Soluix Finteknologi Indonesia\\\\Jericho\\\\ddcl-automation\\\\DDCL BCAS PROD 202611 - TEMPLATE.xlsx\" saya mau nanti jadi 1 monorepo saja, terkait ddclnya nanti dalam bentuk portal saya bisa mengisi semua aspek, mulai dari judul step dan objec2 intinya semuanya bisa saya isi, dan juga terkait stepnya bisa saya save juga, kalau ada stepyang sama saya tgl tambahkan dengan yang sudah ada, saya juga ingin nanti ada portal reportingnya misal saya membuat ddcl hari apa sudah dikirim hari apa isi objectnya apa saja gitu"
- [scope] Workflow-selected scope: `mvp`.
- [memory] `scope-document.md`, `intent-backlog.md` (tahap Scope Definition).

## Q1. [UX] Apa titik masuk utama dan layar kunci portal ini?

Berdasarkan `intent-backlog.md`, usulan layar utama: (1) Dashboard/Portal Reporting — rekap semua DDCL, (2) Editor DDCL — susun Release Document + Deployment Checklist + Rollback, (3) Library Step & Object — kelola step/object reusable yang bisa dipakai di editor.

- A. Setuju dengan 3 layar utama di atas
- B. Ada layar lain yang perlu ditambahkan (sebutkan)
- X. Other (please specify)

[Answer]: A, tapi nanti tunggu jadi dulu siapa tau ada perubahan pada UX nya tapi untuk sekarang gitu saja

## Q2. [UX] Bagaimana alur utama (happy path) pembuatan satu DDCL?

Usulan alur: Dashboard → klik "Buat DDCL Baru" → isi header Release Document → tambah step dari Library (atau buat step baru jika belum ada) → object/parameter per step terisi otomatis sesuai kategori step, pengguna isi nilainya → rollback plan terisi otomatis dari pasangan step → (opsional) isi Checklist Capture → tandai status "Sudah Dikirim" → unduh file Excel → DDCL muncul di Dashboard/Reporting.

- A. Setuju dengan alur di atas
- B. Ada langkah yang perlu diubah/ditambah (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [UX] Bagaimana hierarki informasi yang diinginkan di layar Editor DDCL?

- A. Satu halaman panjang dengan bagian berurutan: Header → Checklist (step+object+rollback) → Checklist Capture → Status, masing-masing bisa di-collapse
- B. Dipecah jadi beberapa tab/langkah (wizard) terpisah per bagian
- X. Other (please specify)

[Answer]: B

## Q4. [UX] Apakah ada panduan merek/desain sistem yang sudah ada untuk diikuti?

- A. Tidak ada — gunakan desain bersih dan sederhana yang umum dipakai (komponen standar, tanpa branding khusus)
- B. Ada panduan/desain sistem yang sudah ada (sebutkan)
- X. Other (please specify)

[Answer]: A, sederhana tapi elegant dan user friendly

## Q5. [Teknis] Perangkat/form factor apa saja yang perlu didukung?

Portal ini adalah alat kerja internal tim operasional/infrastruktur, dan deployment awal cukup lokal via Docker (feasibility Q4).

- A. Fokus desktop/laptop (web browser) — pengisian DDCL yang detail lebih nyaman di layar besar; tablet/mobile tidak perlu dioptimalkan khusus di versi ini
- B. Harus responsif penuh termasuk tablet dan mobile
- X. Other (please specify)

[Answer]: A

## Q6. [Aksesibilitas] Apakah ada kebutuhan aksesibilitas khusus (level WCAG, screen reader, navigasi keyboard)?

- A. Tidak ada kebutuhan khusus yang diketahui — tetap terapkan praktik baku (WCAG 2.1 AA, navigasi keyboard penuh) sebagai baseline wajar
- B. Ada kebutuhan aksesibilitas spesifik (sebutkan)
- X. Other (please specify)

[Answer]: A, WCAG 2.1 AA sebagai baseline

## Consolidated Summary Confirmation

- Tiga layar utama: Dashboard/Portal Reporting, Editor DDCL, dan Library Step & Object — tetap terbuka untuk perubahan UX ke depan seiring kebutuhan (Q1).
- Alur utama: Dashboard → Buat DDCL Baru → isi header Release Document → tambah step dari Library (atau buat baru) → object/parameter otomatis sesuai kategori step → rollback otomatis dari pasangan step → (opsional) Checklist Capture → tandai "Sudah Dikirim" → unduh Excel → muncul di Dashboard/Reporting (Q2).
- Editor DDCL menggunakan tab/langkah (wizard) terpisah per bagian, bukan satu halaman panjang (Q3).
- Tidak ada panduan merek/desain sistem yang sudah ada; desain sederhana, elegan, dan user-friendly dengan komponen standar (Q4).
- Fokus desktop/laptop (web browser); tablet/mobile tidak perlu dioptimalkan khusus di versi ini (Q5).
- Tidak ada kebutuhan aksesibilitas spesifik lain; WCAG 2.1 AA diterapkan sebagai baseline (Q6).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
