# Intent Statement — Portal DDCL Otomatis

## Problem Statement

Saat ini DDCL (Deployment Document Check List) dibuat manual per rilis dengan cara mengetik ulang step dan object/parameter dari nol setiap kali, padahal banyak step yang pola prosedurnya berulang antar DDCL dengan object/parameter yang berbeda-beda [Q1]. Tidak ada tempat terpusat yang merekap DDCL apa saja yang sudah pernah dibuat, kapan dikirim, dan object apa saja yang dipakai di masing-masing DDCL [Q1][Q7].

## Target Customer

Pengguna adalah pembuat DDCL itu sendiri beserta beberapa rekan tim di perusahaan yang sama (bukan pengguna tunggal, dan belum mencakup banyak tim/departemen lintas organisasi) [Q2]. Jenis dokumen yang dikerjakan mengikuti pola template yang dirujuk langsung oleh pengguna, `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` [desc] — yaitu dokumen deployment checklist produksi (header rilis, checklist aktivitas/step, daftar object/parameter, dan log bukti eksekusi) [Q3][Q11].

## Success Metrics

- Pembuatan DDCL lebih cepat karena step yang pola prosedurnya sama tidak perlu diketik ulang dari nol; cukup object/parameternya yang diisi ulang untuk DDCL baru [Q1][Q12].
- Tersedia rekap: DDCL apa saja yang pernah dibuat, tanggal dibuat, tanggal dikirim, status, siapa pembuatnya, dan object/step apa saja yang dipakai di masing-masing DDCL [Q1][Q7].

## Initiative Trigger

Pemicu utama adalah beban kerja berulang dari proses manual yang sudah berjalan terus-menerus (bukan satu kejadian/insiden tertentu): setiap kali ada rilis produksi, DDCL harus dibuat ulang dari awal walau banyak bagiannya mengikuti pola yang sama dengan DDCL sebelumnya [Q1].

## Initial Scope Signal

- **Scope workflow yang dipilih (workflow-selected)**: `mvp` — membangun inti produk dulu tanpa fase operasional penuh [scope].
- **Batas produk versi pertama yang dikonfirmasi pengguna** mencakup hal-hal berikut [Q10]:
  - Termasuk di versi pertama: lebih dari satu pengguna bisa memakai portal di dalam satu perusahaan yang sama (bukan pengguna tunggal) [Q2][Q10]; pencatatan status "sudah dikirim" secara manual oleh pengguna (bukan pengiriman email otomatis) [Q8][Q10]; ketiga bagian template — header Release Document, checklist Step + Object (Deployment Check List + List Object & Parameter), dan Checklist Capture (bukti eksekusi) — semuanya termasuk, dengan Checklist Capture berprioritas lebih rendah karena jarang diisi di praktiknya [Q14].
  - Header Release Document (tab Release Objective) bisa diisi pengguna: Date, Start Date, Impacted System, Environment, Phase / Release #, Release Objective, dan Technical Change; judul/header pada tab Deployment Checklist mengikuti tanggal yang diisi di Release Document [Q15].
  - Step pada Deployment Checklist adalah template yang bisa dipakai ulang: step yang sama bisa dipakai lebih dari sekali dalam satu DDCL yang sama, dan pengguna sendiri yang menentukan urutan/susunan step saat menyusun satu DDCL; step baru dibuat kalau belum ada yang cocok [Q15].
  - Setiap kategori di List Object & Parameter yang ditawarkan ke pengguna mengikuti jenis step yang sedang disusun (mis. step terkait database menawarkan kategori object database, bukan seluruh kategori object tercampur) [Q15].
  - Deployment Checklist juga mencakup Rollback & Recovery Plan: setiap step forward yang reusable punya pasangan step rollback yang juga tercatat/reusable, sehingga saat menyusun DDCL pengguna tidak perlu menulis ulang prosedur rollback dari nol [Q15].
  - Ditunda ke versi berikutnya: pengiriman email otomatis saat DDCL "dikirim" [Q8][Q10].
  - Keluaran akhir satu DDCL yang sudah selesai: tersimpan di portal dan juga bisa diunduh sebagai file mengikuti format template `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` [Q9].

## Assumptions & Open Questions

- Decision-maker untuk prioritas/scope pekerjaan ini belum dikonfirmasi; diasumsikan pengguna utama sendiri, karena ini inisiatif internal skala kecil. [assumption]
- Kadensi/kebutuhan komunikasi pelaporan ke pihak lain di luar portal reporting ini belum didefinisikan. [assumption]
- Target metrik keberhasilan yang terukur (angka/ambang spesifik) belum ditentukan. [assumption]
