# Requirements — Portal DDCL Otomatis

## Intent Analysis

Tujuan pengguna bukan sekadar "membuat form isian DDCL", melainkan menghilangkan kerja berulang: saat ini setiap DDCL (Deployment Document Check List) diketik ulang dari nol padahal banyak step-nya mengikuti pola yang sama antar rilis. Tujuan sebenarnya adalah:

1. **Mempercepat pembuatan DDCL** dengan membuat step, object/parameter, dan rollback menjadi aset reusable — sekali dibuat, dipakai ulang di DDCL berikutnya dengan object/parameter yang berbeda.
2. **Memberi visibilitas historis** lewat portal reporting: DDCL apa saja yang pernah dibuat, kapan, dikirim kapan, isi object apa saja, dan statusnya.
3. **Menjaga hasil akhir tetap kompatibel** dengan proses kerja yang sudah ada — DDCL tetap bisa diunduh sebagai file Excel mengikuti format `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` karena file itu yang dikirim ke klien.

Sumber: `intent-statement.md`, `scope-document.md`.

## Functional Requirements

### Release Document (header)

- **FR1**: Sistem HARUS menyediakan form untuk mengisi header Release Document pada setiap DDCL, dengan field: Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, dan Technical Change. [scope-document.md]
  - **FR1.1**: Judul pada tab Deployment Checklist HARUS mengikuti tanggal yang diisi di Release Document.

### Step & Object Library

- **FR2**: Sistem HARUS menyediakan Library tempat step disimpan sebagai aset reusable, masing-masing dengan nama dan kategori object/parameter.
  - **FR2.1**: Setiap kategori object/parameter yang ditawarkan ke pengguna HARUS mengikuti jenis step yang sedang disusun (mis. step terkait database menawarkan kategori object database, bukan seluruh kategori tercampur).
  - **FR2.2**: Pengguna HARUS bisa membuat step baru langsung dari layar penyusunan DDCL (tanpa keluar dari alur), dan step baru tersebut otomatis tersimpan di Library untuk dipakai ulang.
  - **FR2.3**: Library HARUS menampilkan jumlah DDCL yang memakai setiap step, agar pengguna tahu dampak sebelum mengubah/menghapus step itu. [Requirements Analysis Q3]
  - **FR2.4**: Sebuah step di Library TETAP BISA dihapus meski masih dipakai di satu atau lebih DDCL yang sudah ada; DDCL yang sudah memakainya menyimpan datanya sendiri (snapshot), tidak terpengaruh oleh penghapusan step dari Library — hanya DDCL baru yang tidak lagi melihat step tersebut sebagai pilihan. [Requirements Analysis Q5]

### Penyusunan Deployment Checklist

- **FR3**: Sistem HARUS memungkinkan pengguna menyusun Deployment Checklist suatu DDCL dengan menambahkan step dari Library.
  - **FR3.1**: Step yang sama HARUS bisa dipakai lebih dari sekali dalam satu DDCL yang sama (baris terpisah, merujuk ke step Library yang sama).
  - **FR3.2**: Pengguna HARUS bisa menentukan sendiri urutan/susunan step dalam satu DDCL (dapat diurutkan ulang).
  - **FR3.3**: Untuk setiap step yang ditambahkan, pengguna HARUS mengisi nilai object/parameter sesuai kategori step tersebut.

### Rollback & Recovery Plan

- **FR4**: Setiap step forward yang reusable HARUS punya pasangan step rollback yang juga reusable dan tercatat di Library.
  - **FR4.1**: Saat sebuah step forward ditambahkan ke DDCL, rollback pasangannya HARUS otomatis ikut terpasang di bagian Rollback & Recovery Plan DDCL tersebut, sehingga pengguna tidak menulis ulang prosedur rollback dari nol.

### Checklist Capture

- **FR5**: Sistem HARUS menyediakan bagian Checklist Capture untuk mencatat bukti eksekusi per step, dengan prioritas lebih rendah dari bagian lain (boleh versi paling sederhana di MVP, karena jarang diisi di praktiknya). [intent-statement.md Q14]

### Status, Versi, dan Pengiriman

- **FR6**: Pengguna HARUS bisa menandai status DDCL secara manual (mis. Draft → Sudah Dikirim). Tidak ada pengiriman email otomatis.
  - **FR6.1**: Setelah berstatus "Sudah Dikirim", DDCL tersebut HARUS menjadi read-only (tidak bisa diedit langsung). [Requirements Analysis Q1]
  - **FR6.2**: Dari sebuah DDCL yang sudah "Sudah Dikirim", pengguna HARUS bisa membuat versi baru (v2, v3, dst.) dengan nama otomatis "<nama DDCL asli> vN", yang terhubung/mereferensikan ke DDCL asal dan dimulai dari status Draft (editable), mengikuti siklus status yang sama. [Requirements Analysis Q1]
  - **FR6.3**: Setiap DDCL HARUS menyimpan: tanggal dibuat, tanggal dikirim (jika ada), status, dan pembuat.

### Ekspor ke Excel

- **FR7**: Sistem HARUS bisa menghasilkan file Excel dari sebuah DDCL yang mengikuti format `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` secara 1:1 (tata letak, pengelompokan baris per fase, format sel), mencakup header Release Document, Deployment Checklist (step + object + rollback), dan Checklist Capture.
  - **FR7.1**: Data operasional (host, database, image, dsb.) HARUS ditampilkan apa adanya di file hasil ekspor, tanpa masking, karena file ini dikirim ke klien. [feasibility-assessment.md]

### Portal Reporting

- **FR8**: Sistem HARUS menyediakan halaman rekap (Dashboard/Reporting) yang menampilkan semua DDCL yang pernah dibuat: judul, pembuat, tanggal dibuat, tanggal dikirim, status, dan object/step yang dipakai.
  - **FR8.1**: Rekap HARUS bisa difilter berdasarkan status dan tanggal, dan dicari berdasarkan judul.

### Konkurensi & Multi-Pengguna

- **FR9**: Portal HARUS mendukung lebih dari satu akun pengguna dalam satu perusahaan (meski untuk v1 hanya satu pengguna yang benar-benar memakainya). [intent-statement.md Q2][Requirements Analysis Q4]
- **FR10**: Saat sebuah DDCL sedang diedit oleh satu pengguna, sistem HARUS mengunci (lock) DDCL tersebut dari pengguna lain; pengguna lain hanya bisa melihat (read-only) sampai lock dilepas. [Requirements Analysis Q2]
  - **FR10.1**: Lock HARUS otomatis dilepas setelah jangka waktu tidak aktif tertentu atau saat pengguna yang mengunci keluar dari sesi edit, supaya DDCL tidak terkunci permanen akibat sesi yang ditinggalkan.

## Non-Functional Requirements

- **NFR1** (Performance): Sistem HARUS tetap responsif untuk skala kecil — di bawah 20 pengguna aktif dan ratusan DDCL per tahun — dengan interaksi UI umum (simpan, buka DDCL, filter rekap) selesai di bawah 2 detik pada kondisi jaringan lokal normal. [Requirements Analysis Q6]
- **NFR2** (Security): Semua endpoint API HARUS mewajibkan sesi login yang valid (tidak ada endpoint yang bisa diakses tanpa autentikasi); database PostgreSQL HARUS hanya dapat diakses dari jaringan internal Docker Compose, tidak diekspos ke jaringan publik; kredensial database HARUS disimpan sebagai environment variable, tidak pernah di-hardcode di kode sumber. Data operasional produksi tidak memerlukan masking saat ditampilkan/diekspor (sudah dikonfirmasi dikirim apa adanya ke klien), tapi tetap tunduk pada ketiga kontrol akses di atas. [feasibility-assessment.md][review R-01]
- **NFR3** (Reliability): Untuk v1, sistem HARUS bisa dijalankan sepenuhnya secara lokal via Docker Compose (termasuk database), tanpa bergantung pada layanan eksternal yang belum ditentukan. [team-practices.md]
- **NFR4** (Data Durability): Data DDCL dan Library HARUS disimpan permanen; tidak ada penghapusan otomatis di v1. Kebutuhan housekeeping/retensi data dipertimbangkan ulang di versi mendatang. [Requirements Analysis Q7]
- **NFR5** (Maintainability): Kode HARUS memenuhi lantai coverage test baris 80% dan lolos CI sebelum merge, sesuai `team-practices.md` (scope `mvp`).
- **NFR6** (Correctness — Export Fidelity): Hasil ekspor Excel HARUS cocok 1:1 dengan tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` — ini adalah risiko teknis utama yang diidentifikasi di `feasibility-assessment.md` dan perlu test regresi khusus di Construction.

## Constraints

- Monorepo tunggal berisi app backend (Node.js/TypeScript) dan app frontend (TypeScript) sebagai dua app terpisah, bukan digabung — afirmasi tim, lihat `aidlc/spaces/default/memory/project.md` ## Corrections.
- Database PostgreSQL, dijalankan via Docker Compose untuk v1 (`team-practices.md`).
- Tidak ada integrasi otomatis ke sistem lain di v1 (`feasibility-assessment.md`).
- Tidak ada pengiriman email otomatis di v1 (`intent-statement.md`).
- Tidak ada batasan waktu/anggaran yang ketat (`feasibility-assessment.md`).

## Assumptions

- Lock pada FR10 dianggap cukup sebagai mekanisme pencegahan konflik edit untuk skala tim kecil (<20 pengguna); belum memerlukan resolusi konflik yang lebih canggih (merge otomatis, dsb). Alasan: jawaban Requirements Analysis Q2 memilih lock sederhana, bukan strategi concurrency yang lebih kompleks.
- Model otorisasi "siapa boleh edit DDCL siapa" belum dirancang detail di v1 karena hanya ada satu pengguna aktif sekarang (Requirements Analysis Q4); FR9 tetap mencatat portal harus mendukung banyak akun secara teknis, tapi aturan kepemilikan/izin antar-pengguna akan diputuskan saat benar-benar ada pengguna kedua.
- Durasi timeout lock pada FR10.1 belum ditentukan angka pastinya; nilai konkret (mis. 15-30 menit tidak aktif) akan ditentukan di tahap Functional Design.

## Out of Scope

- Integrasi otomatis ke sistem lain (mis. ambil data langsung dari registry/host produksi).
- Pengiriman email otomatis saat DDCL "dikirim".
- Masking/penyamaran data operasional saat ekspor.
- Keputusan platform hosting produksi jangka panjang (Kubernetes/AWS atau lainnya).
- Model otorisasi multi-pengguna yang detail (role, kepemilikan DDCL per-pengguna) — portal mendukung banyak akun secara teknis (FR9), tapi aturan izin antar-pengguna ditunda.
- Retensi/penghapusan data otomatis.

## Open Questions

- Durasi timeout lock otomatis (FR10.1) — nilai pasti ditentukan di Functional Design.
- Apakah versi DDCL (v2, v3, dst. dari FR6.2) ditampilkan sebagai entri terpisah atau dikelompokkan di bawah DDCL induknya di Portal Reporting (FR8) — perlu diputuskan di Domain Design/Functional Design agar tidak membingungkan saat daftar DDCL makin panjang.
- Pustaka dan kerangka kerja spesifik untuk pengisian Excel-template (FR7) — keputusan arsitektur untuk ADR di tahap Domain Design, bukan tahap ini.
