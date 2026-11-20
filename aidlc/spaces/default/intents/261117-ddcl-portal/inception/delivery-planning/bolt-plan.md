# Delivery Planning — Bolt Plan

Sumber: `unit-of-work.md`, `unit-of-work-dependency.md` (Units Generation), `components.md` (Domain Design), `contract-summary.md` (Contract Design), `requirements.md`, `stories.md`, jawaban `delivery-planning-questions.md` (Q1–Q12).

Setiap Bolt di bawah memetakan ke tepat satu komponen domain dari `components.md`: Bolt 1 menyentuh ketiganya sekaligus (StepLibrary, DdclDocument, ExcelExportService — irisan skeleton); Bolt 2 memperluas StepLibrary; Bolt 3 memperluas UserAccount; Bolt 4 memperluas DdclDocument; Bolt 5 memperluas ExcelExportService; Bolt 6 membaca DdclDocument secara read-only.

Sebuah **Bolt** adalah satu bagian pekerjaan Construction — satu Unit yang dibangun lalu dibuktikan jalan nyata sebelum lanjut ke bagian berikutnya. Setiap Bolt di bawah membungkus tepat satu Unit (jawaban Q3), dibangun satu demi satu (serial, jawaban Q4) oleh satu pembangun AI (`aidlc-developer-agent` — lihat `team-allocation.md`).

## Urutan Bolt

| # | Bolt | Unit | Walking Skeleton | Kompleksitas |
|---|---|---|---|---|
| 1 | u1-walking-skeleton | u1-walking-skeleton | Ya — Bolt pertama yang terverifikasi, Unit lain menunggu checkpoint ini | L |
| 2 | u2-step-library | u2-step-library | Tidak | M |
| 3 | u4-user-accounts | u4-user-accounts | Tidak | M |
| 4 | u3-ddcl-composition | u3-ddcl-composition | Tidak | XL |
| 5 | u6-excel-export-hardening | u6-excel-export-hardening | Tidak | M |
| 6 | u5-portal-reporting | u5-portal-reporting | Tidak | S |

Urutan ini mengikuti DAG topologis dari `unit-of-work-dependency.md` (u1 → {u2, u4} → u3 → {u5, u6}) dengan satu pilihan ekonomi di dalamnya: u4 ditempatkan sebelum u3, bukan setelahnya atau paralel dengannya, meski DAG mengizinkan keduanya — alasannya ada di `risk-and-sequencing-rationale.md`.

## Bolt 1 — u1-walking-skeleton (irisan skeleton)

- **Unit(s)**: u1-walking-skeleton
- **Walking skeleton**: Ya — irisan tipis ujung-ke-ujung yang membuktikan arsitektur jalan sebelum fitur lain ditambahkan. Seluruh stage per-Unit yang berlaku (termasuk Code Generation) selesai untuk Unit ini sebelum Bolt 2 dimulai.
- **Definition of Done**: Satu step reusable dibuat di Library, disusun jadi satu `DdclDocument` minimal, diekspor sebagai file Excel yang bisa dibuka dan cocok tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx`, dibuktikan dengan Construction Verification Command yang menunjukkan hasil ujung-ke-ujung nyata, lalu disetujui manusia di checkpoint skeleton.
- **Confidence hypothesis**: Tiga komponen domain (StepLibrary, DdclDocument, ExcelExportService) benar-benar tersambung dan pendekatan ADR-005 (isi ulang file template, bukan bangun dari nol) bekerja secara nyata.
- **Expected demo**: Buat satu step → susun satu DDCL → unduh file Excel hasil ekspor dan buka untuk dibandingkan dengan template.

## Bolt 2 — u2-step-library

- **Unit(s)**: u2-step-library
- **Walking skeleton**: Tidak
- **Definition of Done**: CRUD step (forward & rollback) penuh, deteksi nama duplikat (AC1.1.2), form kategori object/parameter penuh per kategori (AC1.1.3), jumlah pemakaian step ditampilkan di layar Library (FR2.3, digabung di lapisan API per ADR-002 — lihat Contract 2 di `contract-summary.md`), penghapusan step tidak memengaruhi DDCL lama (FR2.4), penetapan/pengeditan pasangan rollback (US1.3) — seluruhnya lolos test sesuai Testing Posture tim.
- **Confidence hypothesis**: Library sebagai aset reusable lintas-DDCL berdiri sendiri dari data DDCL yang memakainya, sebelum DDCL Composition (Bolt 4) dibangun di atasnya.
- **Expected demo**: Buat beberapa step dengan kategori berbeda, tetapkan pasangan rollback, hapus satu step yang sudah dipakai sebuah DDCL dan tunjukkan DDCL lama tidak berubah.

## Bolt 3 — u4-user-accounts

- **Unit(s)**: u4-user-accounts
- **Walking skeleton**: Tidak
- **Definition of Done**: Entitas User penuh, alur login/logout, middleware penegakan sesi di seluruh endpoint yang sudah ada (Bolt 1–2), layar login dan manajemen akun dasar, stub sesi dev-mode dari Bolt 1 dicabut, regresi terhadap endpoint Bolt 1–2 dijalankan ulang dan lolos.
- **Confidence hypothesis**: Autentikasi nyata bisa menggantikan stub dev-mode tanpa merusak fitur yang sudah berjalan — area retrofit masih kecil di titik ini.
- **Expected demo**: Dua akun berbeda login terpisah, akses ditolak tanpa sesi valid, endpoint Library dan skeleton dari Bolt 1–2 tetap berfungsi setelah retrofit.

## Bolt 4 — u3-ddcl-composition

- **Unit(s)**: u3-ddcl-composition
- **Walking skeleton**: Tidak
- **Prasyarat**: Functional Design harus menetapkan durasi timeout auto-release lock (FR10.1 — open question di `contract-summary.md`) sebelum Bolt ini mulai Code Generation.
- **Definition of Done**: Header Release Document lengkap + validasi (US2.1), susun/urutkan ulang/duplikasi baris step (US2.2), rollback otomatis terpasang (US2.3), Checklist Capture opsional (US2.4), siklus status Draft → Sudah Dikirim read-only (US3.1), versi baru (vN) terhubung ke DDCL induk (US3.2), lock saat diedit dengan pelepasan otomatis (US6.1).
- **Confidence hypothesis**: Seluruh alur inti produk (komposisi DDCL lengkap) benar-benar bisa menggantikan proses ketik-ulang manual yang jadi masalah awal.
- **Expected demo**: Susun satu DDCL dengan banyak step, urutkan ulang, lihat rollback otomatis terpasang, kirim DDCL (jadi read-only), buat versi v2 darinya.

## Bolt 5 — u6-excel-export-hardening

- **Unit(s)**: u6-excel-export-hardening
- **Walking skeleton**: Tidak
- **Definition of Done**: Validasi kelengkapan DDCL sebelum ekspor dengan pesan jelas (AC4.1.3), step melebihi baris per fase tetap menghasilkan file valid (AC4.1.4), nilai object/parameter yang berpotensi merusak format sel ditulis sebagai teks biasa (AC4.1.5) — diuji dengan DDCL hasil Bolt 4 yang benar-benar punya banyak step.
- **Confidence hypothesis**: Risiko teknis utama produk ini (NFR6 — kecocokan ekspor 1:1 dengan template) bertahan juga pada kasus tepi nyata, bukan hanya kasus sederhana yang dibuktikan skeleton.
- **Expected demo**: Ekspor satu DDCL dengan step melebihi kapasitas baris template untuk satu fase, dan satu DDCL dengan nilai parameter yang diawali `=`; keduanya tetap menghasilkan file Excel valid dan aman.

## Bolt 6 — u5-portal-reporting

- **Unit(s)**: u5-portal-reporting
- **Walking skeleton**: Tidak
- **Definition of Done**: Daftar semua DDCL dengan judul/pembuat/tanggal/status (US5.1), filter status/tanggal dan pencarian judul (US5.2) — tampilan versi DDCL mengikuti keputusan Functional Design yang sama dengan Bolt 4.
- **Confidence hypothesis**: Visibilitas historis tercapai tanpa memodifikasi data DDCL yang sudah ada (query read-only murni terhadap hasil Bolt 4).
- **Expected demo**: Buka halaman rekap, filter berdasarkan status dan rentang tanggal, cari berdasarkan judul, lihat hasil yang sesuai dengan DDCL yang dibuat di Bolt sebelumnya.

## Assumptions & Open Questions

None.
