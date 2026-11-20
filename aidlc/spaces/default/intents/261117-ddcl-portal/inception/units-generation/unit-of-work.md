# Units Generation — Unit of Work

Sumber: `components.md` dan `decisions.md` (Domain Design), `requirements.md`, `stories.md`, jawaban `units-generation-questions.md` (Q1–Q5).

Setiap Unit mencakup logika backend DAN layar frontend terkait. Backend dan frontend tetap dua app terpisah di monorepo (konvensi branch `feature/backend-<unit>` / `feature/frontend-<unit>`, `team.md` ## Way of Working); keduanya dikerjakan dan dirilis sebagai satu Unit yang sama.

## Unit Directory Index

| Unit ID | Directory |
|---|---|
| U1 | u1-walking-skeleton |
| U2 | u2-step-library |
| U3 | u3-ddcl-composition |
| U4 | u4-user-accounts |
| U5 | u5-portal-reporting |
| U6 | u6-excel-export-hardening |

## U1 — u1-walking-skeleton

- **Description**: Irisan tipis ujung-ke-ujung yang membuktikan alur inti produk tersambung: satu step reusable (forward, satu kategori object/parameter) dari StepLibrary → disusun menjadi satu DdclDocument minimal (header dasar + satu ChecklistItem) → diekspor sebagai file Excel yang mengikuti tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx`. Mencakup backend minimal untuk ketiga komponen tersebut plus layar frontend minimal untuk membuat step, menyusun DDCL, dan mengunduh hasil ekspornya secara manual.
- **Boundaries**: Tidak mencakup: rollback (pasangan/auto-attach), multi-step/reorder/duplikasi baris, Checklist Capture, status/versi DDCL, lock, multi-akun/autentikasi nyata, reporting, maupun pengerasan ekspor (overflow baris, sanitasi formula). Berjalan di balik sesi dev-mode satu pengguna tetap (bukan login nyata) — digantikan autentikasi nyata di U4.
- **Responsibilities**: Skema data awal StepLibrary.Step (field minimal), DdclDocument + ReleaseHeader + ChecklistItem (field minimal), ExcelExportService (muat file template, isi sel sesuai mapping minimal). Layar: buat step, susun DDCL dengan satu step, unduh Excel.
- **Deployment model**: Shared — bagian dari satu app backend dan satu app frontend yang sama (Docker Compose), sesuai `team.md`.
- **Complexity**: L (menyambungkan 3 komponen domain + infrastruktur baru: skema database awal, wiring Docker Compose, mekanisme muat file template Excel — kompleksitas datang dari pondasi baru, bukan dari lebarnya fitur).
- **Kind**: service
- **Implementation notes and constraints**: Ini adalah Unit pertama sesuai kandidat walking skeleton yang disepakati tim (`team.md` ## Walking Skeleton); dijalankan lebih dulu melalui seluruh stage per-Unit (termasuk Code Generation) sebelum Unit lain, dan diverifikasi dengan Construction Verification Command yang menunjukkan hasil ujung-ke-ujung nyata (buat step → susun DDCL → unduh Excel yang bisa dibuka dan cocok dengan tata letak template) sebelum checkpoint skeleton disetujui. Mapping sel Excel mengikuti pendekatan ADR-005 (isi ulang file template yang sudah ada, bukan bangun dari nol).

## U2 — u2-step-library

- **Description**: Fitur StepLibrary lengkap, melampaui yang dibangun di U1.
- **Boundaries**: Mencakup seluruh FR2/FR4 sisi Library: deteksi nama duplikat saat membuat step (AC1.1.2), form object/parameter khusus per kategori untuk semua kategori yang dibutuhkan (AC1.1.3), jumlah DDCL yang memakai sebuah step ditampilkan di layar Library (US1.2, FR2.3 — agregasi dihitung di lapisan API/endpoint sesuai ADR-002, bukan oleh StepLibrary memanggil DdclDocument), penghapusan step yang tetap mengizinkan DDCL lama memakai snapshotnya sendiri (US1.2, FR2.4), dan penetapan/pengeditan pasangan rollback untuk step forward di Library (US1.3). Tidak mencakup pemasangan otomatis rollback ke dalam sebuah DDCL saat disusun (itu di U3).
- **Responsibilities**: CRUD Step penuh (forward & rollback), validasi nama duplikat, skema kategori object/parameter penuh, pasangan rollback, layar Library (daftar step + jumlah pemakaian + hapus + kelola pasangan rollback).
- **Deployment model**: Shared — bagian dari app backend dan frontend yang sama dengan U1.
- **Complexity**: M
- **Kind**: service
- **Implementation notes and constraints**: Bergantung pada skema Step dari U1 (diperluas, bukan diganti). Penggabungan jumlah pemakaian (lapisan API) harus didokumentasikan eksplisit di Contract Design agar jelas tidak dimiliki StepLibrary maupun DdclDocument (tindak lanjut temuan review R-02 pada Domain Design).

## U3 — u3-ddcl-composition

- **Description**: Fitur DdclDocument lengkap, melampaui yang dibangun di U1.
- **Boundaries**: Mencakup seluruh FR1/FR3/FR4/FR5/FR6/FR10 sisi DdclDocument: header Release Document lengkap dan validasi field wajib (US2.1), susun/urutkan ulang/duplikasi baris step yang sama (US2.2), rollback otomatis terpasang mengikuti pasangan step forward dari Library (US2.3), Checklist Capture opsional (US2.4), siklus status Draft → Sudah Dikirim dengan read-only setelah terkirim (US3.1), pembuatan versi baru (vN) yang terhubung ke DDCL induk (US3.2), lock saat diedit dengan pelepasan otomatis setelah waktu tidak aktif (US6.1). Tidak mencakup rekap/listing lintas-DDCL (itu di U5) maupun pengerasan ekspor Excel (itu di U6).
- **Responsibilities**: Model data ReleaseHeader/ChecklistItem/RollbackItem/CaptureNote penuh, mesin status & versi, mesin lock+timeout, layar komposisi DDCL penuh (header, daftar step dengan reorder/duplikasi, rollback plan otomatis, capture, tombol kirim/buat revisi).
- **Deployment model**: Shared — bagian dari app backend dan frontend yang sama dengan U1.
- **Complexity**: XL (Unit terbesar — mencakup mayoritas fitur inti produk).
- **Kind**: service
- **Implementation notes and constraints**: Bergantung pada U2 karena rollback otomatis (US2.3) butuh data pasangan rollback yang sudah lengkap dari Library. Durasi timeout lock (FR10.1) belum ditentukan di `requirements.md` — nilai konkretnya ditentukan di Functional Design, bukan di sini.

## U4 — u4-user-accounts

- **Description**: Multi-akun pengguna dan autentikasi/sesi nyata, menggantikan sesi dev-mode dari U1.
- **Boundaries**: Mencakup FR9 dan US6.2 (lebih dari satu akun pengguna bisa login dan memakai seluruh fitur portal), serta penegakan NFR2 (setiap endpoint API mewajibkan sesi login valid) di semua endpoint yang sudah ada dari U1–U3. Model otorisasi detail (siapa boleh edit DDCL siapa) secara eksplisit Out of Scope di `requirements.md` untuk v1.
- **Responsibilities**: Entitas User penuh, alur login/logout, middleware penegakan sesi di seluruh endpoint, layar login dan manajemen akun dasar.
- **Deployment model**: Shared — bagian dari app backend dan frontend yang sama dengan U1.
- **Complexity**: M
- **Kind**: service
- **Implementation notes and constraints**: Begitu Unit ini selesai, dev-mode stub sesi dari U1 harus dicabut di seluruh endpoint yang sudah ada (U1, U2, U3) — ini adalah titik integrasi yang perlu diuji ulang (regresi) terhadap Unit yang sudah berjalan sebelumnya.

## U5 — u5-portal-reporting

- **Description**: Halaman rekap/dashboard seluruh DDCL.
- **Boundaries**: Mencakup FR8/FR8.1: daftar semua DDCL dengan judul/pembuat/tanggal/status (US5.1), filter berdasarkan status/tanggal dan pencarian berdasarkan judul (US5.2). Keputusan tampilan versi DDCL (terpisah vs dikelompokkan di bawah DDCL induk) — Open Question di `requirements.md` — diputuskan di Functional Design, bukan di sini.
- **Responsibilities**: Query/listing lintas-DdclDocument (membaca data dari U3, tidak memodifikasinya), layar Dashboard dengan filter dan pencarian.
- **Deployment model**: Shared — bagian dari app backend dan frontend yang sama dengan U1.
- **Complexity**: S
- **Kind**: service

## U6 — u6-excel-export-hardening

- **Description**: Pengerasan ExcelExportService dari U1 untuk kasus tepi yang teridentifikasi sebagai risiko teknis utama (NFR6).
- **Boundaries**: Mencakup AC4.1.3 (validasi kelengkapan DDCL sebelum ekspor, menolak dengan pesan jelas jika belum lengkap), AC4.1.4 (jumlah step melebihi baris yang disediakan template untuk satu fase tetap menghasilkan file valid tanpa merusak fase lain), AC4.1.5 (nilai object/parameter yang berpotensi merusak format sel, mis. diawali `=`, ditulis sebagai teks biasa apa adanya).
- **Responsibilities**: Validasi pra-ekspor, penanganan baris tambahan di luar kapasitas template per fase, sanitasi nilai sel terhadap karakter formula-like/baris baru.
- **Deployment model**: Shared — bagian dari app backend yang sama dengan U1 (tidak ada layar frontend baru; tombol "Unduh Excel" sudah ada dari U1).
- **Complexity**: M
- **Kind**: service
- **Implementation notes and constraints**: Bergantung pada U3 karena kasus-kasus tepi di atas (mis. jumlah step per fase) baru benar-benar muncul setelah DDCL bisa berisi banyak step dan diurutkan ulang (U3), bukan dari skenario satu-step di U1.
